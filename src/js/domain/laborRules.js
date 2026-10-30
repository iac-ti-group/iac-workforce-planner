/**
 * Parâmetros legais da simulação (EC 141/2026, CLT e jurisprudência citadas na aba "Regras").
 * Altere aqui para ajustar as regras sem mexer no motor.
 */

export const ActivityType = Object.freeze({ COMMERCE: "comercio", OTHER: "outros" });

/** Jornada semanal simulada: hoje (44h), transição (42h) e final (40h). */
export const Phase = Object.freeze({ CURRENT: "44", TRANSITION: "42", FINAL: "40" });
export const PHASES = [Phase.CURRENT, Phase.TRANSITION, Phase.FINAL];

/** "N" = contratação sugerida, sexo ainda indefinido (segue a regra mais restritiva de domingo). */
export const Sex = Object.freeze({ FEMALE: "F", MALE: "M", UNDEFINED: "N" });

/** OJ 410 SDI-1: o 7º dia seguido de trabalho é irregular. */
export const MAX_CONSECUTIVE_WORKDAYS = 6;

/** Lei 10.101/2000 art. 6º: homens folgam 1 domingo a cada 3 semanas no comércio e a cada 7 nas demais. */
export const maxConsecutiveSundaysForMen = (activityType) =>
  activityType === ActivityType.COMMERCE ? 2 : 6;

/** Fração dos domingos que cada sexo consegue trabalhar sem violar o revezamento. */
export const SUNDAY_AVAILABILITY_WOMEN = 0.5;
export const sundayAvailabilityForMen = (activityType) =>
  activityType === ActivityType.COMMERCE ? 2 / 3 : 6 / 7;

/** CLT art. 71: intervalo intrajornada conforme a duração do trabalho. */
export const LONG_WORKDAY_MINUTES = 360;
export const MEDIUM_WORKDAY_MINUTES = 240;
export const SHORT_BREAK_MINUTES = 15;
export const DEFAULT_LUNCH_MINUTES = 60;
export const DEFAULT_LUNCH_START = "12:00";
export const MIN_LUNCH_WITHOUT_AGREEMENT = 60;
export const MAX_LUNCH_WITHOUT_AGREEMENT = 120;

/** Encargos e provisões sobre o salário (INSS, FGTS, 13º, férias + 1/3 e reflexos). */
export const PAYROLL_CHARGES_PERCENT = 75;

/** TST Súmula 431: divisor mensal de horas por jornada. */
export const MONTHLY_HOURS_DIVISOR = Object.freeze({ "44": 220, "42": 210, "40": 200 });

export const OVERTIME_PREMIUM = 1.5;
export const WEEKS_PER_MONTH = 30 / 7;
