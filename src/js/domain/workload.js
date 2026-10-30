/** Jornada de trabalho por fase: dias trabalhados, minutos por dia, limite semanal e intervalos. */

import { SATURDAY } from "./calendar.js";
import {
  LONG_WORKDAY_MINUTES,
  MEDIUM_WORKDAY_MINUTES,
  Phase,
  SHORT_BREAK_MINUTES,
} from "./laborRules.js";
import { MON_TO_SAT_MODEL } from "./workModels.js";

const EIGHT_HOURS = 480;
const FOUR_HOURS = 240;
const CURRENT_WEEKLY_HOURS = 44;

/**
 * @typedef {object} Workload
 * @property {number} workDays            dias trabalhados por pessoa na semana
 * @property {number} dailyMinutes        minutos de trabalho em um dia típico
 * @property {number} weeklyLimitHours    teto legal da semana
 * @property {number} minDaysOff          folgas mínimas por semana
 * @property {(day:number)=>number} minutesOnDay minutos trabalhados no dia informado
 * @property {number} weeklyHours         horas semanais efetivas
 * @property {string} [label]             rótulo especial da jornada (ex.: "8h + sáb 4h")
 */

/** @returns {Workload} */
export function workloadFor(state, phase, openDayCount) {
  const workload =
    phase === Phase.CURRENT ? currentWorkload(state, openDayCount) : fiveByTwoWorkload(Number(phase), openDayCount);
  return {
    minutesOnDay: () => workload.dailyMinutes,
    weeklyHours: (workload.dailyMinutes * workload.workDays) / 60,
    ...workload,
  };
}

/** Hoje: 6x1 com 44h, ou 8h + sábado 4h quando esse modelo foi escolhido. */
function currentWorkload(state, openDayCount) {
  const workDays = Math.min(6, openDayCount);
  const common = { workDays, weeklyLimitHours: CURRENT_WEEKLY_HOURS, minDaysOff: 1 };
  if (state.workModel === MON_TO_SAT_MODEL && workDays === 6 && state.days[SATURDAY].open) {
    return {
      ...common,
      dailyMinutes: EIGHT_HOURS,
      minutesOnDay: (day) => (day === SATURDAY ? FOUR_HOURS : EIGHT_HOURS),
      weeklyHours: CURRENT_WEEKLY_HOURS,
      label: "8h + sáb 4h",
    };
  }
  const weeklyMinutes = CURRENT_WEEKLY_HOURS * 60;
  const maxDailyMinutes = 528; // 8h48: 44h em 5 dias
  const dailyMinutes = workDays >= 6 ? 440 : Math.min(maxDailyMinutes, Math.round(weeklyMinutes / Math.max(1, workDays)));
  return { ...common, dailyMinutes };
}

/** 5x2 da EC 141: 42h exige 8h24 por dia (com convenção), 40h fica em 8h. */
function fiveByTwoWorkload(weeklyLimitHours, openDayCount) {
  const workDays = Math.min(5, openDayCount);
  const allowedDailyMinutes = EIGHT_HOURS * (weeklyLimitHours === 42 ? 1.05 : 1);
  const dailyMinutes = Math.min(allowedDailyMinutes, Math.round((weeklyLimitHours * 60) / 5));
  return { workDays, dailyMinutes, weeklyLimitHours, minDaysOff: 2 };
}

/** Intervalo intrajornada (CLT art. 71): almoço acima de 6h, 15 min acima de 4h. */
export function breakMinutes(state, workMinutes) {
  if (workMinutes > LONG_WORKDAY_MINUTES) return state.lunchMinutes;
  return workMinutes > MEDIUM_WORKDAY_MINUTES ? SHORT_BREAK_MINUTES : 0;
}

/** Tempo entre entrada e saída: trabalho + intervalo. */
export const shiftSpan = (state, workMinutes) => workMinutes + breakMinutes(state, workMinutes);

export const isLongWorkday = (workload) => workload.dailyMinutes > LONG_WORKDAY_MINUTES;
