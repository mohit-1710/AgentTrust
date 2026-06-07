// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interfaces for the canonical ERC-8004 ("Trustless Agents")
/// registries deployed on Monad. PolicyVault only needs the read paths.
/// Reputation:  0x8004B663056A597Dffe9eCcC1965A193B7388713 (Monad testnet)
/// Validation:  0x8004Cb1BF31DAf7788923b405b754f57acEB4272 (Monad testnet)
/// Identity:    0x8004A818BFB912233c491871b3d84c89A494BD9e (Monad testnet)

interface IReputationRegistry {
    /// @param agentId   ERC-8004 agent id (Identity NFT tokenId)
    /// @param clients   filter by client addresses; pass empty array for all
    /// @param tag1/tag2 optional category filters; pass "" for none
    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}

interface IValidationRegistry {
    function getSummary(
        uint256 agentId,
        address[] calldata validators,
        string calldata tag
    ) external view returns (uint64 count, uint8 averageResponse);
}

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
}
