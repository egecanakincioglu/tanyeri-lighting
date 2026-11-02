import { Link } from '../../i18n/navigation.ts';

type Props = { title: string; text: string; signIn: string };

/** Shown instead of a recovery form when the site sends no e-mail or runs as the demo. */
export function ResetUnavailable({ title, text, signIn }: Props) {
  return (
    <section aria-labelledby="reset-unavailable" className="flex flex-col gap-3">
      <h2 id="reset-unavailable" className="text-lg font-bold">
        {title}
      </h2>
      <p className="leading-6">{text}</p>
      <Link
        href="/dashboard/sign-in"
        prefetch={false}
        className="inline-flex min-h-touch items-center font-medium text-ink underline underline-offset-4"
      >
        {signIn}
      </Link>
    </section>
  );
}
