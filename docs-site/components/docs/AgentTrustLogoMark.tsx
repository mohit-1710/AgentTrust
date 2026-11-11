import type { JSX } from 'react';

interface AgentTrustLogoMarkProps {
  className?: string;
}

export function AgentTrustLogoMark({ className }: AgentTrustLogoMarkProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4.25 19.75 19.25H4.25L12 4.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="4.25" fill="currentColor" r="2.35" />
      <circle cx="4.25" cy="19.25" fill="currentColor" r="2.35" />
      <circle cx="19.75" cy="19.25" fill="currentColor" r="2.35" />
    </svg>
  );
}
