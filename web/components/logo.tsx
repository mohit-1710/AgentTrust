import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-md bg-accent-soft ring-1 ring-accent/30">
        {/* shield + check mark */}
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-accent" fill="none">
          <path
            d="M12 2.5 4.5 5.5v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9v-6L12 2.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m8.8 12 2.2 2.2 4.2-4.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">
        AgentTrust
      </span>
    </div>
  );
}
