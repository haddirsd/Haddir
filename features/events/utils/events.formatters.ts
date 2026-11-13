export const formatEventDate = (value: string) =>
  new Intl.DateTimeFormat("ar-SD-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));

export const currencyLabel = (currency: string) =>
  ({ SDG: "ج.س", SAR: "ر.س", AED: "د.إ", USD: "$", EGP: "ج.م" }[
    currency.trim().toUpperCase()
  ] || currency.trim().toUpperCase());

export const formatMoney = (value: number, currency = "SDG") =>
  new Intl.NumberFormat("ar-SD-u-nu-latn").format(value) + " " + currencyLabel(currency);
