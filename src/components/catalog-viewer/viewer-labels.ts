export type ViewerLabels = {
  close: string;
  previous: string;
  next: string;
  /** Contains `{page}` and `{total}`. */
  page: string;
  /** Contains `{from}`, `{to}` and `{total}`. */
  pages: string;
  loading: string;
  error: string;
  download: string;
  /** Contains `{name}`. */
  book: string;
};
