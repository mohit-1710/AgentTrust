import type { JSX } from 'react';
import { PROGRAM_IDS } from '@/lib/constants';

const ROWS: ReadonlyArray<{ label: string; address: string }> = [
  { label: 'policy_vault', address: PROGRAM_IDS.devnet.policyVault },
  { label: 'trustgate', address: PROGRAM_IDS.devnet.trustgate },
  { label: 'validation_registry', address: PROGRAM_IDS.devnet.validationRegistry },
];

export function ProgramIdsTable(): JSX.Element {
  return (
    <div className="program-id-table" role="region" aria-label="Devnet program IDs">
      {ROWS.map(({ label, address }) => (
        <div className="program-id-row" key={label}>
          <span>{label}</span>
          <a
            href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="program-id-link"
            title="Open on Solana Explorer (devnet)"
          >
            <code>{address}</code>
          </a>
        </div>
      ))}
    </div>
  );
}
