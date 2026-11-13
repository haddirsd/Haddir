const DATE_LOCALE = "ar-SD-u-nu-latn";

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(DATE_LOCALE, options).format(date);
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function isValidDate(value: string | Date): boolean {
  return !Number.isNaN((value instanceof Date ? value : new Date(value)).getTime());
}
