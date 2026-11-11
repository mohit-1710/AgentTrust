export function easeOutExpo(value: number): number {
  return Math.min(1, 1.001 - 2 ** (-10 * value));
}
