/**
 * Plano de turnos: usado quando a empresa abre os 7 dias e o expediente é maior que uma jornada.
 * Cada grupo de dias (seg–sex, sáb, dom) tem até 3 turnos com quantidade de pessoas própria.
 */

import { DAY_GROUPS, firstOpenDay } from "./calendar.js";
import { distributeDemand } from "./demand.js";
import { businessHours, formatClock, toMinutes } from "./time.js";
import { shiftSpan } from "./workload.js";
import { range, sum } from "../shared/collections.js";

export const SHIFT_COUNT = 3;
const FALLBACK_SUGGESTION = { count: 1, starts: [480, 720, 960] };
const SINGLE_SHIFT_TOLERANCE = 60;
const MIDDLE_SHIFT_OFFSET = 240;

export const emptyShiftHeadcount = () => range(SHIFT_COUNT).map(() => [0, 0, 0]);

export const shiftName = (shiftIndex) => "Turno " + (shiftIndex + 1);

export const shiftsOfDay = (state) =>
  state.shiftStarts.map((shift, index) => ({ name: shiftName(index), start: toMinutes(shift.start) }));

/**
 * Quantos turnos o expediente do dia comporta e em que horário cada um começa (minutos).
 * Sem dia informado, usa o primeiro dia aberto.
 */
export function suggestShifts(state, workload, day = firstOpenDay(state.days)) {
  if (day === undefined) return FALLBACK_SUGGESTION;

  const { opensAt, closesAt } = businessHours(state.days[day]);
  const span = shiftSpan(state, workload.minutesOnDay(day));
  const openMinutes = closesAt - opensAt;
  const count = openMinutes <= span + SINGLE_SHIFT_TOLERANCE ? 1 : openMinutes <= 2 * span ? 2 : 3;

  const latest = Math.max(opensAt, closesAt - span);
  const middle = Math.round((opensAt + (closesAt - span)) / 2 / 10) * 10;
  if (count === 3) return { count, starts: [opensAt, middle, latest] };
  if (count === 2) return { count, starts: [opensAt, latest, middle] };
  return { count, starts: [opensAt, Math.max(opensAt, Math.min(latest, opensAt + MIDDLE_SHIFT_OFFSET)), latest] };
}

/**
 * Atualiza horários e quantidades dos turnos conforme o modo automático e
 * sincroniza a demanda dos dias com o total dos turnos.
 * @returns {boolean} true quando a escala é organizada em turnos.
 */
export function applyShiftPlan(state, workload) {
  const suggestion = suggestShifts(state, workload);
  const usesShifts = state.days.every((day) => day.open) && suggestion.count > 1;
  if (!usesShifts) {
    if (state.autoDemand) distributeDemand(state);
    return false;
  }

  if (!state.shiftStarts || state.shiftStarts.length !== SHIFT_COUNT) {
    state.shiftStarts = range(SHIFT_COUNT).map(() => ({ start: undefined, auto: true }));
  }
  state.shiftStarts.forEach((shift, index) => {
    if (shift.auto) shift.start = formatClock(suggestion.starts[index]);
  });

  if (state.autoDemand) distributeDemand(state);
  if (!state.shiftHeadcount || state.shiftHeadcount.length !== SHIFT_COUNT) state.shiftHeadcount = emptyShiftHeadcount();

  DAY_GROUPS.forEach((group, groupIndex) => {
    const referenceDay = firstOpenDay(state.days, group.days);
    if (referenceDay === undefined) {
      state.shiftHeadcount[groupIndex] = [0, 0, 0];
      return;
    }
    const current = state.shiftHeadcount[groupIndex];
    if (state.autoShifts || !Array.isArray(current) || current.length !== SHIFT_COUNT) {
      const shiftCount = Math.min(suggestion.count, suggestShifts(state, workload, referenceDay).count);
      state.shiftHeadcount[groupIndex] = splitEvenly(state.days[referenceDay].need, shiftCount);
    }
    const total = sum(state.shiftHeadcount[groupIndex]);
    group.days.forEach((day) => {
      if (state.days[day].open) state.days[day].need = total;
    });
  });
  return true;
}

/** Divide `people` entre os primeiros `shiftCount` turnos, sobra nos primeiros. */
function splitEvenly(people, shiftCount) {
  const base = Math.floor(people / shiftCount);
  const remainder = people - base * shiftCount;
  return range(SHIFT_COUNT).map((index) => (index < shiftCount ? base + (index < remainder ? 1 : 0) : 0));
}
