/** Cálculos de apresentação compartilhados pela grade (desktop) e pelos cartões (celular). */

import { Sex } from "../domain/laborRules.js";

const HOURS_TOLERANCE = 0.01;

export const SEX_TITLE = { [Sex.FEMALE]: "Mulher", [Sex.MALE]: "Homem", [Sex.UNDEFINED]: "Contratação, sexo a definir" };

export const sexBadge = (sex) => (sex === Sex.UNDEFINED ? "?" : sex);

/** Horas trabalhadas por uma pessoa na semana. */
export const weeklyHoursOf = (schedule, grid, personIndex) =>
  grid[personIndex].reduce((hours, works, day) => hours + (works ? schedule.workload.minutesOnDay(day) / 60 : 0), 0);

export const exceedsWeeklyLimit = (schedule, hours) => hours > schedule.workload.weeklyLimitHours + HOURS_TOLERANCE;
