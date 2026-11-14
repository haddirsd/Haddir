/** Convert Arabic-Indic digits to ASCII and remove spaces and common separators. */
export function normalizePhone(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s()-]/g, "");
}

export function normalizeSudanesePhone(value: string): string {
  return normalizePhone(value);
}

/** Sudanese mobile numbers in the app use 10 digits and start with zero. */
export function isValidSudanesePhone(value: string): boolean {
  return /^0\d{9}$/.test(normalizeSudanesePhone(value));
}
