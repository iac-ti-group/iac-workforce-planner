/** Demanda: quantas pessoas cada dia precisa e quantas a empresa precisa ter para cobrir a semana. */

import { SUNDAY } from "./calendar.js";
import { SUNDAY_AVAILABILITY_WOMEN, Sex, sundayAvailabilityForMen } from "./laborRules.js";
import { countWhere, sum } from "../shared/collections.js";

const SUNDAY_SHARE_OF_TEAM = 0.4;
const EPSILON = 1e-9;

export const demandPerDay = (state) => state.days.map((day) => (day.open ? day.need : 0));

/**
 * Sugere pessoas por dia a partir do tamanho da equipe (6 dias trabalhados por pessoa).
 * Abrindo os 7 dias, o domingo recebe ~40% da equipe e o restante é dividido entre seg e sáb.
 */
export function distributeDemand(state) {
  const teamSize = state.team.length;
  const openDayCount = countWhere(state.days, (day) => day.open);
  if (!openDayCount) return;

  const totalShifts = teamSize * Math.min(6, openDayCount);
  if (openDayCount <= 6) {
    const perDay = Math.min(teamSize, Math.round(totalShifts / openDayCount));
    state.days.forEach((day) => (day.need = day.open ? perDay : 0));
    return;
  }

  const sundayNeed = Math.max(teamSize ? 1 : 0, Math.round(teamSize * SUNDAY_SHARE_OF_TEAM));
  const weekdayShifts = totalShifts - sundayNeed;
  const perWeekday = Math.floor(weekdayShifts / 6);
  let leftover = weekdayShifts - perWeekday * 6;
  state.days.forEach((day, index) => {
    if (!day.open) day.need = 0;
    else if (index === SUNDAY) day.need = sundayNeed;
    else day.need = Math.min(teamSize, perWeekday + (leftover-- > 0 ? 1 : 0));
  });
}

/**
 * Pessoas necessárias para cobrir a demanda: o maior entre o total de turnos da semana,
 * o pico diário e a equipe atual acrescida de quem falta para o revezamento de domingo.
 */
export function requiredHeadcount(state, workload) {
  const teamSize = state.team.length;
  const women = countWhere(state.team, (person) => person.sex === Sex.FEMALE);
  const men = teamSize - women;
  const demand = demandPerDay(state);

  const sundayCapacity = women * SUNDAY_AVAILABILITY_WOMEN + men * sundayAvailabilityForMen(state.activityType);
  const sundayGap = demand[SUNDAY] - sundayCapacity;
  const extraForSunday = sundayGap > 0 ? Math.ceil(sundayGap / SUNDAY_AVAILABILITY_WOMEN - EPSILON) : 0;

  const forWeeklyShifts = workload.workDays ? Math.ceil(sum(demand) / workload.workDays - EPSILON) : 0;
  return Math.max(forWeeklyShifts, Math.max(0, ...demand), teamSize + extraForSunday);
}
