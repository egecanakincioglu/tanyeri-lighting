type Props = { date: Date; locale: string; label: (date: string) => string };

// The day is stored as midnight UTC, so it is shown in UTC and never moves with the server's time zone.
export function PostDate({ date, locale, label }: Props) {
  const text = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  return <time dateTime={date.toISOString().slice(0, 10)}>{label(text)}</time>;
}
