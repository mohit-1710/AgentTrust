import type { JSX } from 'react';
import { CHAIN, CONTRACT_ADDRESSES } from '@/lib/constants';

const ROWS: ReadonlyArray<{ label: string; address: string }> = [
  { label: 'PolicyVault', address: CONTRACT_ADDRESSES.testnet.policyVault },
  { label: 'IdentityRegistry', address: CONTRACT_ADDRESSES.testnet.identityRegistry },
  { label: 'ReputationRegistry', address: CONTRACT_ADDRESSES.testnet.reputationRegistry },
  { label: 'ValidationRegistry', address: CONTRACT_ADDRESSES.testnet.validationRegistry },
  { label: 'USDC', address: CONTRACT_ADDRESSES.testnet.usdc },
];

export function ProgramIdsTable(): JSX.Element {
  return (
    <div className="program-id-table" role="region" aria-label="Monad testnet contract addresses">
      {ROWS.map(({ label, address }) => (
        <div className="program-id-row" key={label}>
          <span>{label}</span>
          <a
            href={`${CHAIN.explorerUrl}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="program-id-link"
            title="Open on Monad Explorer (testnet)"
          >
            <code>{address}</code>
          </a>
        </div>
      ))}
    </div>
  );
}
