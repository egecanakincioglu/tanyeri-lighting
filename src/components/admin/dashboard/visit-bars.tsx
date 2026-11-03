type VisitBar = {
  day: string;
  // The hover text of the day, already in the reader's language.
  title: string;
  views: number;
};

type Props = {
  bars: readonly VisitBar[];
  /** The text alternative of the whole chart. */
  summary: string;
  startLabel: string;
  endLabel: string;
};

/** Daily page views as plain bars: no script, one series, a real value axis (0 and the peak) and the two end dates. */
export function VisitBars({ bars, summary, startLabel, endLabel }: Props) {
  const max = Math.max(1, ...bars.map((bar) => bar.views));
  return (
    <div role="img" aria-label={summary} className="flex h-full flex-col">
      <div className="flex flex-1 gap-2">
        <div aria-hidden="true" className="flex w-8 flex-none flex-col justify-between text-right text-xs text-muted">
          <span className="tabular-nums">{max}</span>
          <span className="tabular-nums">0</span>
        </div>
        <div className="flex min-h-36 min-w-0 flex-1 items-end gap-0.5 border-t border-b border-hairline">
          {bars.map((bar) => (
            <div key={bar.day} title={bar.title} className="flex h-full min-w-0 flex-1 items-end hover:bg-accent-tint">
              <div
                className={`w-full rounded-t-[3px] ${bar.views > 0 ? 'bg-accent' : 'bg-hairline'}`}
                style={{ height: bar.views > 0 ? `${Math.max(2, (bar.views / max) * 100)}%` : '2px' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between pl-10 text-xs text-muted">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
