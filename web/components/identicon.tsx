import { cn } from "@/lib/utils";

/**
 * Tiny deterministic identicon derived from an address. A 5x5 vertically
 * mirrored bit grid, tinted in the Monad purple ramp — enough to read as
 * "this specific account's avatar" without any dependency.
 */
export function Identicon({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const seed = hash(address.toLowerCase());
  // Two hues from the purple ramp, chosen by the seed.
  const fills = ["#836EF9", "#6B54E8", "#5840C4", "#9580FF"];
  const fg = fills[seed % fills.length];

  const cells: boolean[] = [];
  let h = seed;
  for (let i = 0; i < 15; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    cells.push((h & 1) === 1);
  }

  const rects: { x: number; y: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (cells[row * 3 + col]) {
        rects.push({ x: col, y: row });
        if (col < 2) rects.push({ x: 4 - col, y: row }); // mirror
      }
    }
  }

  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden rounded-md ring-1 ring-accent/30",
        className
      )}
      style={{ background: "var(--accent-soft)" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 5 5" className="h-full w-full">
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={1} height={1} fill={fg} />
        ))}
      </svg>
    </div>
  );
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h & 0x7fffffff;
}
