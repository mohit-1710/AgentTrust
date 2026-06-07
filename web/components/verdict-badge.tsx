import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Decision } from "@/lib/gate";

const tone: Record<
  Decision,
  {
    ring: string;
    text: string;
    bg: string;
    chip: string;
    Icon: typeof CheckCircle2;
    label: string;
  }
> = {
  ALLOW: {
    ring: "border-allow/30",
    text: "text-allow",
    bg: "bg-[rgba(31,122,61,0.06)]",
    chip: "bg-[rgba(31,122,61,0.1)]",
    Icon: CheckCircle2,
    label: "ALLOW",
  },
  DENY: {
    ring: "border-deny/30",
    text: "text-deny",
    bg: "bg-[rgba(193,59,38,0.06)]",
    chip: "bg-[rgba(193,59,38,0.1)]",
    Icon: XCircle,
    label: "DENY",
  },
  REQUIRE_VALIDATION: {
    ring: "border-warn/30",
    text: "text-warn",
    bg: "bg-[rgba(176,125,18,0.07)]",
    chip: "bg-[rgba(176,125,18,0.12)]",
    Icon: AlertTriangle,
    label: "REQUIRE VALIDATION",
  },
};

export function VerdictPanel({
  decision,
  reason,
  source,
}: {
  decision: Decision;
  reason: string;
  source?: "onchain" | "preview";
}) {
  const t = tone[decision];
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[10px] border p-5 animate-fade-up",
        t.ring,
        t.bg
      )}
    >
      <div
        className={cn(
          "grid h-14 w-14 shrink-0 place-items-center rounded-lg",
          t.chip,
          t.text
        )}
      >
        <t.Icon className="h-8 w-8" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-display text-2xl font-semibold tracking-[-0.02em]",
              t.text
            )}
          >
            {t.label}
          </span>
          {source && (
            <span className="mono-label rounded-full border border-border bg-bg-elev px-2 py-0.5 text-[10px] text-ink-dim">
              {source === "onchain" ? "on-chain" : "preview"}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-sm text-ink-dim">{reason}</p>
      </div>
    </div>
  );
}
