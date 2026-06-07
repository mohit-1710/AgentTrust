import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Decision } from "@/lib/gate";

const tone: Record<
  Decision,
  { ring: string; text: string; bg: string; Icon: typeof CheckCircle2; label: string }
> = {
  ALLOW: {
    ring: "ring-allow/40",
    text: "text-allow",
    bg: "bg-allow/10",
    Icon: CheckCircle2,
    label: "ALLOW",
  },
  DENY: {
    ring: "ring-deny/40",
    text: "text-deny",
    bg: "bg-deny/10",
    Icon: XCircle,
    label: "DENY",
  },
  REQUIRE_VALIDATION: {
    ring: "ring-warn/40",
    text: "text-warn",
    bg: "bg-warn/10",
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
        "flex items-center gap-4 rounded-2xl p-5 ring-2 animate-fade-up",
        t.ring,
        t.bg
      )}
    >
      <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-background/40", t.text)}>
        <t.Icon className="h-8 w-8" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-2xl font-bold tracking-tight", t.text)}>
            {t.label}
          </span>
          {source && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
              {source === "onchain" ? "on-chain" : "preview"}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-sm text-muted-foreground">
          {reason}
        </p>
      </div>
    </div>
  );
}
