type SectionTitleProps = {
  title: string;
  /** 1 for the page title, 2 for a section; keeps the heading order correct. */
  level: 1 | 2;
};

/** Centred title with the same text faintly repeated behind it and a short accent line below. */
export function SectionTitle({ title, level }: SectionTitleProps) {
  const Tag = `h${level}` as const;
  return (
    <div className="relative mx-auto mt-[clamp(2.5rem,6vw,4.5rem)] mb-[calc(clamp(2.5rem,6vw,4.5rem)*0.75)] w-[min(100%-2*var(--gutter),var(--container-page))] overflow-x-clip text-center [--t:clamp(1.5rem,2.2vw,2rem)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[calc(var(--t)*0.6)] left-1/2 -translate-1/2 text-[length:min(calc(var(--t)*2.3),7.4vw)] leading-none font-bold tracking-tight whitespace-nowrap text-[rgb(0_0_0/0.04)] select-none"
      >
        {title}
      </span>
      <Tag className="relative z-10 text-[length:var(--t)] leading-[1.2] font-bold tracking-tight text-ink after:mx-auto after:mt-3 after:block after:h-0.5 after:w-12 after:rounded-[2px] after:bg-accent after:content-['']">
        {title}
      </Tag>
    </div>
  );
}
