import type { JSX } from 'react';
import { KANI_HARNESSES, KANI_TOTAL_SUB_CHECKS } from '@/lib/constants';

export function KaniProofBadge(): JSX.Element {
  return (
    <div className="kani-proof-badge">
      <div>
        <strong>{KANI_HARNESSES.length} / {KANI_HARNESSES.length} invariants formally verified</strong>
        <p>
          PolicyVault safety properties are machine-checked by Kani in CI —{' '}
          {KANI_TOTAL_SUB_CHECKS.toLocaleString()} sub-checks, zero failures.
        </p>
      </div>
      <ul>
        {KANI_HARNESSES.map((harness) => (
          <li key={harness}>
            <code>{harness}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
