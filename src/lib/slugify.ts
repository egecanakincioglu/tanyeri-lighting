const TURKISH_LETTERS: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

/** An address-safe form of a name: Turkish letters become their Latin twins, anything else becomes a single hyphen. */
export function slugify(text: string): string {
  return (
    text
      // Lowered by hand: the default lowering of İ leaves a combining dot behind, and a plain I is a dotless ı in Turkish.
      .replaceAll('İ', 'i')
      .replaceAll('I', 'ı')
      .toLocaleLowerCase('tr')
      .replace(/[çğıöşü]/g, (letter) => TURKISH_LETTERS[letter] ?? letter)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}
