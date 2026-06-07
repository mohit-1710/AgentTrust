// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyVault} from "../src/PolicyVault.sol";
import {IReputationRegistry, IValidationRegistry} from "../src/interfaces/IERC8004.sol";

/// @notice Configurable mock of the ERC-8004 Reputation Registry.
///         Returns a fixed (count, summaryValue, decimals) regardless of the
///         queried agentId / clients / tags, which is all PolicyVault reads.
contract MockReputationRegistry is IReputationRegistry {
    uint64 public count;
    int128 public summaryValue;
    uint8 public decimals;

    function set(uint64 count_, int128 summaryValue_, uint8 decimals_) external {
        count = count_;
        summaryValue = summaryValue_;
        decimals = decimals_;
    }

    function getSummary(uint256, address[] calldata, string calldata, string calldata)
        external
        view
        override
        returns (uint64, int128, uint8)
    {
        return (count, summaryValue, decimals);
    }
}

/// @notice Configurable mock of the ERC-8004 Validation Registry.
contract MockValidationRegistry is IValidationRegistry {
    uint64 public count;
    uint8 public averageResponse;

    function set(uint64 count_, uint8 averageResponse_) external {
        count = count_;
        averageResponse = averageResponse_;
    }

    function getSummary(uint256, address[] calldata, string calldata)
        external
        view
        override
        returns (uint64, uint8)
    {
        return (count, averageResponse);
    }
}

contract PolicyVaultTest is Test {
    PolicyVault internal vault;
    MockReputationRegistry internal rep;
    MockValidationRegistry internal val;

    address internal payer = makeAddr("payer");
    uint256 internal constant PAYEE = 42; // ERC-8004 agent id of the counterparty

    // A couple of trusted attestors. Their exact addresses are irrelevant to the
    // mocks, but a non-empty set is what flips "no trusted attestors" off.
    address internal attestorA = makeAddr("attestorA");
    address internal attestorB = makeAddr("attestorB");

    function setUp() public {
        rep = new MockReputationRegistry();
        val = new MockValidationRegistry();
        vault = new PolicyVault(address(rep), address(val));
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _clients() internal view returns (address[] memory) {
        address[] memory c = new address[](2);
        c[0] = attestorA;
        c[1] = attestorB;
        return c;
    }

    function _emptyClients() internal pure returns (address[] memory) {
        return new address[](0);
    }

    /// @dev Sets a "happy path" policy as `payer`: generous caps, low rep bar,
    ///      trusted attestors present, validation not required.
    function _setHealthyPolicy() internal {
        vm.prank(payer);
        vault.setPolicy(
            100 ether, // perTxCap
            1000 ether, // dailyCap
            int128(50), // minReputation (average)
            uint64(1), // minFeedbackCount
            false, // requireValidation
            _clients()
        );
    }

    function _assertDecision(PolicyVault.Decision expected, uint256 amount) internal view {
        (PolicyVault.Decision d,) = vault.gate(payer, PAYEE, amount);
        assertEq(uint8(d), uint8(expected));
    }

    // ---------------------------------------------------------------
    // No policy
    // ---------------------------------------------------------------

    function test_NoPolicy_Denies() public view {
        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "no policy");
    }

    // ---------------------------------------------------------------
    // Killswitch
    // ---------------------------------------------------------------

    function test_KillSwitch_Denies() public {
        _setHealthyPolicy();
        rep.set(3, int128(100), 0); // avg 100, healthy

        // Sanity: allowed before the killswitch.
        _assertDecision(PolicyVault.Decision.ALLOW, 1 ether);

        vm.prank(payer);
        vault.setKillSwitch(true);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "killswitch active");
    }

    function test_KillSwitch_RequiresExistingPolicy() public {
        vm.prank(payer);
        vm.expectRevert(bytes("no policy"));
        vault.setKillSwitch(true);
    }

    function test_KillSwitch_CanBeReenabled() public {
        _setHealthyPolicy();
        rep.set(3, int128(100), 0);

        vm.prank(payer);
        vault.setKillSwitch(true);
        _assertDecision(PolicyVault.Decision.DENY, 1 ether);

        vm.prank(payer);
        vault.setKillSwitch(false);
        _assertDecision(PolicyVault.Decision.ALLOW, 1 ether);
    }

    // ---------------------------------------------------------------
    // Per-tx cap
    // ---------------------------------------------------------------

    function test_PerTxCap_Exceeded_Denies() public {
        _setHealthyPolicy();
        rep.set(3, int128(100), 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 100 ether + 1);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "exceeds per-tx cap");
    }

    function test_PerTxCap_ExactlyAtCap_Allows() public {
        _setHealthyPolicy();
        rep.set(3, int128(100), 0);
        _assertDecision(PolicyVault.Decision.ALLOW, 100 ether);
    }

    // ---------------------------------------------------------------
    // Daily cap / velocity (recordSpend + window reset)
    // ---------------------------------------------------------------

    function test_DailyCap_AccumulatedSpend_Denies() public {
        // perTxCap 100, dailyCap 150. First spend of 100 leaves 50 of headroom.
        vm.prank(payer);
        vault.setPolicy(100 ether, 150 ether, int128(0), uint64(0), false, _clients());
        rep.set(3, int128(100), 0);

        // Record a 100 ether spend in the current window.
        vm.prank(payer);
        vault.recordSpend(100 ether);

        // 100 already spent; 60 more would breach the 150 daily cap.
        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 60 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "exceeds daily cap");

        // 50 more is exactly at the cap -> allowed.
        _assertDecision(PolicyVault.Decision.ALLOW, 50 ether);
    }

    function test_DailyCap_WindowResetsAfter24h() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 150 ether, int128(0), uint64(0), false, _clients());
        rep.set(3, int128(100), 0);

        vm.prank(payer);
        vault.recordSpend(100 ether);

        // Within the window, 60 more is denied.
        _assertDecision(PolicyVault.Decision.DENY, 60 ether);

        // Advance past 24h. recordSpend would reset, and gate's _windowSpend
        // already treats the elapsed window as zero spend.
        vm.warp(block.timestamp + 1 days);

        // Fresh window: full daily headroom restored.
        _assertDecision(PolicyVault.Decision.ALLOW, 100 ether);

        // And recordSpend after the window resets spentInWindow.
        vm.prank(payer);
        vault.recordSpend(100 ether);
        PolicyVault.Policy memory p = vault.getPolicy(payer);
        assertEq(p.spentInWindow, 100 ether);
    }

    function test_RecordSpend_AccumulatesWithinWindow() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(0), uint64(0), false, _clients());

        vm.startPrank(payer);
        vault.recordSpend(30 ether);
        vault.recordSpend(20 ether);
        vm.stopPrank();

        PolicyVault.Policy memory p = vault.getPolicy(payer);
        assertEq(p.spentInWindow, 50 ether);
    }

    function test_RecordSpend_RequiresPolicy() public {
        vm.prank(payer);
        vm.expectRevert(bytes("no policy"));
        vault.recordSpend(1 ether);
    }

    // ---------------------------------------------------------------
    // Trusted attestor set / feedback count -> REQUIRE_VALIDATION
    // ---------------------------------------------------------------

    function test_EmptyAcceptedClients_RequiresValidation() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(0), uint64(0), false, _emptyClients());

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.REQUIRE_VALIDATION));
        assertEq(reason, "no trusted attestors configured");
    }

    function test_InsufficientFeedbackCount_RequiresValidation() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(0), uint64(5), false, _clients());
        // Only 2 feedback entries, but policy demands >= 5.
        rep.set(2, int128(100), 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.REQUIRE_VALIDATION));
        assertEq(reason, "payee: insufficient feedback from trusted attestors");
    }

    // ---------------------------------------------------------------
    // Reputation average -> DENY / ALLOW
    // ---------------------------------------------------------------

    function test_AverageBelowMinReputation_Denies() public {
        vm.prank(payer);
        // minReputation 80.
        vault.setPolicy(100 ether, 1000 ether, int128(80), uint64(1), false, _clients());
        // count 4, sum 200 -> average 50 < 80.
        rep.set(4, int128(50), 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "payee: reputation below threshold");
    }

    function test_HealthyReputation_Allows() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(80), uint64(1), false, _clients());
        // count 4, sum 400 -> average 100 >= 80.
        rep.set(4, int128(100), 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.ALLOW));
        assertEq(reason, "ok");
    }

    function test_AverageExactlyAtThreshold_Allows() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(50), uint64(1), false, _clients());
        // count 4, sum 200 -> average exactly 50 >= 50.
        rep.set(4, int128(50), 0);
        _assertDecision(PolicyVault.Decision.ALLOW, 1 ether);
    }

    function test_NegativeAverageReputation_Denies() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(0), uint64(1), false, _clients());
        // count 2, sum -10 -> average -5 < 0.
        rep.set(2, int128(-5), 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.DENY));
        assertEq(reason, "payee: reputation below threshold");
    }

    // ---------------------------------------------------------------
    // requireValidation flag
    // ---------------------------------------------------------------

    function test_RequireValidation_NoValidation_RequiresValidation() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(50), uint64(1), true, _clients());
        rep.set(4, int128(100), 0); // healthy reputation
        val.set(0, 0); // no validation on record

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.REQUIRE_VALIDATION));
        assertEq(reason, "payee: validation required");
    }

    function test_RequireValidation_ZeroAverage_RequiresValidation() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(50), uint64(1), true, _clients());
        rep.set(4, int128(100), 0);
        // Count present but average response is 0 -> still treated as no valid attestation.
        val.set(2, 0);

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.REQUIRE_VALIDATION));
        assertEq(reason, "payee: validation required");
    }

    function test_RequireValidation_WithValidation_Allows() public {
        vm.prank(payer);
        vault.setPolicy(100 ether, 1000 ether, int128(50), uint64(1), true, _clients());
        rep.set(4, int128(100), 0); // healthy reputation
        val.set(1, 100); // positive validation on record

        (PolicyVault.Decision d, string memory reason) = vault.gate(payer, PAYEE, 1 ether);
        assertEq(uint8(d), uint8(PolicyVault.Decision.ALLOW));
        assertEq(reason, "ok");
    }

    // ---------------------------------------------------------------
    // getPolicy view
    // ---------------------------------------------------------------

    function test_GetPolicy_ReturnsStoredValues() public {
        _setHealthyPolicy();
        PolicyVault.Policy memory p = vault.getPolicy(payer);
        assertTrue(p.exists);
        assertFalse(p.paused);
        assertEq(p.perTxCap, 100 ether);
        assertEq(p.dailyCap, 1000 ether);
        assertEq(p.minReputation, int128(50));
        assertEq(p.minFeedbackCount, uint64(1));
        assertFalse(p.requireValidation);
        assertEq(p.acceptedClients.length, 2);
        assertEq(p.acceptedClients[0], attestorA);
        assertEq(p.acceptedClients[1], attestorB);
    }
}
