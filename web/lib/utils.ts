import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddr(addr: string, chars = 4): string {
  if (!addr || addr.length < 2 + chars * 2) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

/** Format a 6dp USDC atomic amount as a human string. */
export function formatUsdc(atomic: bigint): string {
  const neg = atomic < 0n;
  const v = neg ? -atomic : atomic;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : `${whole}`;
  return `${neg ? "-" : ""}${s}`;
}

/** Parse a human USDC string into a 6dp atomic bigint. */
export function parseUsdc(input: string): bigint {
  const [whole, frac = ""] = input.trim().split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}
