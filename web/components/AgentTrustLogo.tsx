export default function AgentTrustLogo({ href = "#home" }: { href?: string } = {}) {
  return (
    <a
      href={href}
      aria-label="AgentTrust home"
      className="group flex h-6 items-center gap-2 text-ink"
    >
      <svg
        aria-hidden="true"
        className="size-6 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 4.25 19.75 19.25H4.25L12 4.25Z"
          stroke="var(--accent)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="12" cy="4.25" r="2.35" fill="var(--accent)" />
        <circle cx="4.25" cy="19.25" r="2.35" fill="var(--accent)" />
        <circle cx="19.75" cy="19.25" r="2.35" fill="var(--accent)" />
      </svg>
      <span className="font-display text-[1.18rem] leading-6 tracking-[-0.04em] text-ink">
        AgentTrust
      </span>
    </a>
  );
}
