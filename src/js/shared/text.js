/** Utilitários de texto em português. */

export const plural = (count, singular, pluralForm = singular + "s") => (count === 1 ? singular : pluralForm);

/** Plural só acima de 1: zero fica no singular ("0 pessoa"). */
export const pluralIfMany = (count, singular, pluralForm = singular + "s") => (count > 1 ? pluralForm : singular);
