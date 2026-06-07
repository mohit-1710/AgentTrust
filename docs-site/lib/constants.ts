export const CHAIN = {
  chainId: 10143,
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  explorerUrl: 'https://testnet.monadexplorer.com',
  x402Facilitator: 'https://x402-facilitator.molandak.org',
} as const;

export const CONTRACT_ADDRESSES = {
  testnet: {
    policyVault: '0x34b3bB1a99377128126201359749FE7614275E37',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    validationRegistry: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
    usdc: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
  },
} as const;

export const SDK_PACKAGE = '@monad-agenttrust-sdk/sdk';
export const GITHUB_REPO = 'github.com/mohit-1710/AgentTrust';
export const LICENSE = 'MIT';

export const POLICY_CHECKS = [
  'KillSwitch',
  'PerTxCap',
  'DailyCap',
  'Velocity',
  'CounterpartyReputation',
  'CapabilityValidation',
] as const;

export const DENY_REASON_NAMES = [
  'KillSwitchEngaged',
  'PerTxCapExceeded',
  'DailyCapExceeded',
  'VelocityExceeded',
  'ReputationBelowMin',
] as const;
