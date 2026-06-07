export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <div className="mono-label text-[11px] text-accent">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-ink md:text-[2.6rem]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg leading-relaxed text-ink-dim">{subtitle}</p>
      )}
    </div>
  );
}
