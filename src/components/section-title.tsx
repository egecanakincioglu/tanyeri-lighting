type SectionTitleProps = {
  title: string;
  level: 1 | 2;
};

/** The repeated text is drawn by CSS from `data-title`, so it is in the HTML once;
 * the empty alternative keeps it out of the accessibility tree. */
export function SectionTitle({ title, level }: SectionTitleProps) {
  const Tag = `h${level}` as const;
  return (
    <div
      data-title={title}
      className="relative mx-auto mt-[clamp(2.5rem,6vw,4.5rem)] mb-[calc(clamp(2.5rem,6vw,4.5rem)*0.75)] w-[min(100%-2*var(--gutter),var(--container-page))] overflow-x-clip text-center [--t:clamp(1.5rem,2.2vw,2rem)] before:pointer-events-none before:absolute before:top-[calc(var(--t)*0.6)] before:left-1/2 before:-translate-1/2 before:text-[length:min(calc(var(--t)*2.3),7.4vw)] before:leading-none before:font-bold before:tracking-tight before:whitespace-nowrap before:text-[rgb(0_0_0/0.04)] before:select-none before:content-[attr(data-title)_/_'']"
    >
      <Tag className="relative z-10 text-[length:var(--t)] leading-[1.2] font-bold tracking-tight text-ink after:mx-auto after:mt-3 after:block after:h-0.5 after:w-12 after:rounded-[2px] after:bg-accent after:content-['']">
        {title}
      </Tag>
    </div>
  );
}
