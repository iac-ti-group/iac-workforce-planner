/** Calendário da simulação: dias da semana, grupos de dias e horizonte simulado. */

export const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const DAYS_PER_WEEK = 7;
export const SATURDAY = 5;
export const SUNDAY = 6;
export const SIMULATED_WEEKS = 4;

/** Segunda a sábado: dias em que a demanda é distribuída livremente (domingo tem regra própria). */
export const MONDAY_TO_SATURDAY = [0, 1, 2, 3, 4, 5];

/** Grupos de dias que compartilham horário de funcionamento e quadro de turnos. */
export const DAY_GROUPS = [
  { name: "Seg a Sex", fullName: "Seg a Sex", days: [0, 1, 2, 3, 4] },
  { name: "Sáb", fullName: "Sábado", days: [SATURDAY] },
  { name: "Dom", fullName: "Domingo", days: [SUNDAY] },
];

export const groupIndexOfDay = (day) => (day < SATURDAY ? 0 : day === SATURDAY ? 1 : 2);

export const firstOpenDay = (days, candidates = days.map((_, index) => index)) =>
  candidates.find((day) => days[day].open);
