// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReputationRegistry, IValidationRegistry} from "./interfaces/IERC8004.sol";

/// @title PolicyVault
/// @notice The non-custodial pre-payment policy gate for AI-agent payments on Monad.
///         It reads the PAYEE's on-chain ERC-8004 reputation/validation and enforces
///         the PAYER's own spending policy, returning Allow / Deny / RequireValidation.
///         It NEVER takes custody of funds — it only answers "should this payment happen?"
///         `gate()` is a `view`, so it is free to call (eth_call) inline in the
///         x402 verify→settle path. `recordSpend()` updates the velocity window after a
///         successful settlement.
contract PolicyVault {
    enum Decision {
        ALLOW,
        DENY,
        REQUIRE_VALIDATION
    }

    struct Policy {
        bool exists;
        bool paused; // killswitch — emergency pause for this payer
        uint256 perTxCap; // max amount per single payment (token atomic units, e.g. USDC 6dp)
        uint256 dailyCap; // max cumulative amount per rolling 24h window
        int128 minReputation; // payee AVERAGE ERC-8004 feedback value must be >= this (feedback decimal scale; v1 uses 0 decimals)
        uint64 minFeedbackCount; // payee must have >= this many feedback entries
        bool requireValidation; // payee must hold a positive ERC-8004 validation
        // --- velocity state (maintained by recordSpend) ---
        uint256 windowStart; // unix ts marking the start of the current 24h window
        uint256 spentInWindow; // cumulative spent within the current window
        // --- Sybil-resistant trust set ---
        address[] acceptedClients; // feedback authors whose ERC-8004 ratings this payer trusts
    }

    IReputationRegistry public immutable reputation;
    IValidationRegistry public immutable validation;

    /// @dev Each payer manages their own policy. Fully self-sovereign — no admin keys.
    mapping(address => Policy) public policies;

    event PolicySet(
        address indexed payer,
        uint256 perTxCap,
        uint256 dailyCap,
        int128 minReputation,
        uint64 minFeedbackCount,
        bool requireValidation
    );
    event KillSwitchSet(address indexed payer, bool paused);
    event SpendRecorded(address indexed payer, uint256 amount, uint256 spentInWindow);

    constructor(address reputation_, address validation_) {
        reputation = IReputationRegistry(reputation_);
        validation = IValidationRegistry(validation_);
    }

    // ----------------------------------------------------------------
    // Policy management — every payer sets and owns their own policy
    // ----------------------------------------------------------------

    function setPolicy(
        uint256 perTxCap,
        uint256 dailyCap,
        int128 minReputation,
        uint64 minFeedbackCount,
        bool requireValidation,
        address[] calldata acceptedClients
    ) external {
        Policy storage p = policies[msg.sender];
        p.exists = true;
        p.perTxCap = perTxCap;
        p.dailyCap = dailyCap;
        p.minReputation = minReputation;
        p.minFeedbackCount = minFeedbackCount;
        p.requireValidation = requireValidation;
        p.acceptedClients = acceptedClients;
        emit PolicySet(msg.sender, perTxCap, dailyCap, minReputation, minFeedbackCount, requireValidation);
    }

    function setKillSwitch(bool paused) external {
        require(policies[msg.sender].exists, "no policy");
        policies[msg.sender].paused = paused;
        emit KillSwitchSet(msg.sender, paused);
    }

    // ----------------------------------------------------------------
    // The gate — view, free, inline in the x402 verify→settle path
    // ----------------------------------------------------------------

    /// @param payer        the agent operator about to pay
    /// @param payeeAgentId the ERC-8004 agent id of the counterparty being paid
    /// @param amount       payment amount in token atomic units
    function gate(address payer, uint256 payeeAgentId, uint256 amount)
        public
        view
        returns (Decision decision, string memory reason)
    {
        Policy storage p = policies[payer];
        if (!p.exists) return (Decision.DENY, "no policy");
        if (p.paused) return (Decision.DENY, "killswitch active");
        if (amount > p.perTxCap) return (Decision.DENY, "exceeds per-tx cap");

        uint256 spent = _windowSpend(p);
        if (spent + amount > p.dailyCap) return (Decision.DENY, "exceeds daily cap");

        // Counterparty reputation gate (ERC-8004 Reputation Registry).
        // The deployed registry REQUIRES an explicit set of feedback authors —
        // Sybil-resistant by design: the payer chooses whose ratings it trusts.
        // getSummary returns the SUM of those authors' feedback + the entry count,
        // so we gate on the AVERAGE. No trusted set / thin history -> require an
        // explicit capability validation instead of a hard deny.
        if (p.acceptedClients.length == 0) {
            return (Decision.REQUIRE_VALIDATION, "no trusted attestors configured");
        }
        (uint64 count, int128 summaryValue,) =
            reputation.getSummary(payeeAgentId, p.acceptedClients, "", "");
        if (count < p.minFeedbackCount) {
            return (Decision.REQUIRE_VALIDATION, "payee: insufficient feedback from trusted attestors");
        }
        int256 avgValue = int256(summaryValue) / int256(uint256(count));
        if (avgValue < int256(p.minReputation)) {
            return (Decision.DENY, "payee: reputation below threshold");
        }

        // Optional capability validation (ERC-8004 Validation Registry)
        if (p.requireValidation) {
            (uint64 vCount, uint8 vAvg) = validation.getSummary(payeeAgentId, none, "");
            if (vCount == 0 || vAvg == 0) {
                return (Decision.REQUIRE_VALIDATION, "payee: validation required");
            }
        }

        return (Decision.ALLOW, "ok");
    }

    // ----------------------------------------------------------------
    // Velocity bookkeeping — called by the settle path after an ALLOW
    // ----------------------------------------------------------------

    function recordSpend(uint256 amount) external {
        Policy storage p = policies[msg.sender];
        require(p.exists, "no policy");
        if (block.timestamp >= p.windowStart + 1 days) {
            p.windowStart = block.timestamp;
            p.spentInWindow = 0;
        }
        p.spentInWindow += amount;
        emit SpendRecorded(msg.sender, amount, p.spentInWindow);
    }

    // ----------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------

    function _windowSpend(Policy storage p) internal view returns (uint256) {
        if (block.timestamp >= p.windowStart + 1 days) return 0;
        return p.spentInWindow;
    }

    function getPolicy(address payer) external view returns (Policy memory) {
        return policies[payer];
    }
}
