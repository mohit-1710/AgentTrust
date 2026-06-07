import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-monad-500/15 ring-1 ring-monad-500/40">
        {/* shield + check mark */}
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-monad-300" fill="none">
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
      <span className="text-[15px] font-semibold tracking-tight">
        Agent<span className="text-monad-300">Trust</span>
      </span>
    </div>
  );
}
