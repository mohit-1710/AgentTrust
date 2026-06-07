// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Deploys PolicyVault against the live ERC-8004 registries.
/// @dev    Reads the registry addresses from the environment:
///           REPUTATION_REGISTRY  — ERC-8004 Reputation Registry
///           VALIDATION_REGISTRY  — ERC-8004 Validation Registry
///
///         Run later (with funds) against Monad testnet, e.g.:
///           export REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
///           export VALIDATION_REGISTRY=0x8004Cb1BF31DAf7788923b405b754f57acEB4272
///           forge script script/Deploy.s.sol:Deploy \
///             --rpc-url https://testnet-rpc.monad.xyz \
///             --private-key $PRIVATE_KEY \
///             --broadcast
contract Deploy is Script {
    function run() external returns (PolicyVault vault) {
        address reputation = vm.envAddress("REPUTATION_REGISTRY");
        address validation = vm.envAddress("VALIDATION_REGISTRY");

        console2.log("Reputation Registry:", reputation);
        console2.log("Validation Registry:", validation);

        vm.startBroadcast();
        vault = new PolicyVault(reputation, validation);
        vm.stopBroadcast();

        console2.log("PolicyVault deployed at:", address(vault));
    }
}
