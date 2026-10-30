/** Pequenos utilitários de coleção usados por todas as camadas. */

export const range = (length) => Array.from({ length }, (_, index) => index);

export const sum = (values) => values.reduce((total, value) => total + value, 0);

export const countWhere = (values, predicate) => values.filter(predicate).length;
