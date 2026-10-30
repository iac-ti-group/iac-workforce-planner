/** Formatação e leitura de valores monetários e percentuais em pt-BR (usada pela aplicação e pela tela). */

const LOCALE = "pt-BR";

/** R$ 2.150 (sem centavos) */
export const formatCurrency = (value) =>
  value.toLocaleString(LOCALE, { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** R$ 2.150,00 */
export const formatCurrencyCents = (value) => value.toLocaleString(LOCALE, { style: "currency", currency: "BRL" });

/** 2.150,00 (valor do campo de texto) */
export const formatAmountInput = (value) =>
  value.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** +4,8% */
export const formatIncrease = (percent) => "+" + percent.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + "%";

export const formatInteger = (value) => value.toLocaleString(LOCALE);

/** Aceita "2.150,00", "2150,5", "2.150" e "2150.50"; valores inválidos ou negativos viram 0. */
export function parseAmountInput(input) {
  let digits = String(input || "").replace(/[^\d,.-]/g, "");
  if (digits.includes(",")) digits = digits.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(digits)) digits = digits.replace(/\./g, "");
  const amount = parseFloat(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
