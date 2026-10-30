/** Horários de entrada, saída e almoço de cada pessoa em cada dia trabalhado. */

import { DAYS_PER_WEEK, groupIndexOfDay } from "./calendar.js";
import { shiftsOfDay } from "./shiftPlan.js";
import { businessHours, toMinutes, MINUTES_PER_DAY } from "./time.js";
import { breakMinutes, shiftSpan } from "./workload.js";
import { range, sum } from "../shared/collections.js";

const MIN_LUNCH_FOR_FIXED_TIME = 30;
const LUNCH_AFTER_ENTRY = 240;
const LUNCH_MARGIN = 60;
const STAGGER_ROUNDING = 10;
const EPSILON = 1e-9;

/**
 * @typedef {object} Assignment
 * @property {number} start          entrada (minutos)
 * @property {number} end            saída (minutos)
 * @property {number|null} lunchStart início do almoço, null quando não há almoço
 * @property {number} breakMinutes
 * @property {number} [shiftIndex]   apenas na escala por turnos
 * @property {string} [shiftName]
 */

/**
 * Calcula os horários de todas as semanas de uma vez.
 * @returns {{ assignmentsFor:(week:number, day:number)=>Map<number, Assignment>, shiftShortages:object[] }}
 */
export function computeAssignments(state, { roster, weeks, workload, usesShifts }) {
  const shiftShortages = [];
  const preferredShift = usesShifts ? preferredShiftPerPerson(state, roster.length) : null;

  const byWeek = weeks.map((grid, week) =>
    range(DAYS_PER_WEEK).map((day) => {
      const workers = roster.map((_, index) => index).filter((index) => grid[index][day]);
      const context = { state, day, workers, workMinutes: workload.minutesOnDay(day) };
      if (!usesShifts) return staggeredAssignments(context);
      const { assignments, shortages } = shiftAssignments({ ...context, preferredShift });
      shortages.forEach(({ shift, missing }) => shiftShortages.push({ week, day, shift, missing }));
      return assignments;
    }),
  );

  return { assignmentsFor: (week, day) => byWeek[week][day], shiftShortages };
}

/** Sem turnos: entradas escalonadas de 10 em 10 min entre a abertura e o último horário que cabe a jornada. */
function staggeredAssignments({ state, day, workers, workMinutes }) {
  const span = shiftSpan(state, workMinutes);
  const pause = breakMinutes(state, workMinutes);
  const { opensAt, closesAt } = businessHours(state.days[day]);
  const room = closesAt - opensAt - span;
  const assignments = new Map();
  workers.forEach((person, position) => {
    const start =
      room <= 0 || workers.length < 2
        ? opensAt
        : opensAt + Math.round((room * position) / (workers.length - 1) / STAGGER_ROUNDING) * STAGGER_ROUNDING;
    assignments.set(person, {
      start,
      end: start + span,
      lunchStart: lunchStartFor(state, start, span, pause),
      breakMinutes: pause,
    });
  });
  return assignments;
}

/** Com turnos: cada pessoa fica no seu turno preferido enquanto houver vaga; o excedente vai para o turno mais vazio. */
function shiftAssignments({ state, day, workers, workMinutes, preferredShift }) {
  const shifts = shiftsOfDay(state);
  const capacity = (state.shiftHeadcount[groupIndexOfDay(day)] || []).slice(0, shifts.length);
  const slots = (shift) => capacity[shift] || 0;
  const span = shiftSpan(state, workMinutes);
  const pause = breakMinutes(state, workMinutes);

  const members = shifts.map(() => []);
  const overflow = [];
  workers.forEach((person) => {
    const shift = Math.min(preferredShift[person], shifts.length - 1);
    if (members[shift].length < slots(shift)) members[shift].push(person);
    else overflow.push(person);
  });

  const staffedShifts = shifts.map((_, index) => index).filter((index) => slots(index) > 0);
  const candidates = staffedShifts.length ? staffedShifts : [0];
  overflow.forEach((person) => {
    let target = candidates[0];
    let lowestLoad = Infinity;
    candidates.forEach((shift) => {
      const load = (members[shift].length + 1) / Math.max(0.5, slots(shift));
      if (load < lowestLoad) {
        lowestLoad = load;
        target = shift;
      }
    });
    members[target].push(person);
  });

  const shortages = shifts
    .map((_, shift) => ({ shift, missing: slots(shift) - members[shift].length }))
    .filter(({ missing }) => missing > 0);

  const { opensAt, closesAt } = businessHours(state.days[day]);
  const latestStart = Math.max(opensAt, closesAt - span);
  const clampToBusinessHours = (minutes) => Math.max(opensAt, Math.min(minutes, latestStart));

  const assignments = new Map();
  members.forEach((people, shift) =>
    people.forEach((person) => {
      const start = clampToBusinessHours(shifts[shift].start);
      assignments.set(person, {
        start,
        end: start + span,
        lunchStart: lunchStartFor(state, start, span, pause),
        breakMinutes: pause,
        shiftIndex: shift,
        shiftName: shifts[shift].name,
      });
    }),
  );
  return { assignments, shortages };
}

/** Turno preferido de cada pessoa (fica no mesmo turno ao longo das semanas), proporcional ao quadro de seg–sex. */
function preferredShiftPerPerson(state, rosterSize) {
  const headcount = state.shiftHeadcount;
  const base = (headcount[0] && headcount[0].length ? headcount[0] : headcount.find((row) => row && row.length)) || [1];
  const total = sum(base) || 1;
  let accumulated = 0;
  const cutoffs = base.map((value) => (accumulated += value) / total);
  return range(rosterSize).map((person) => {
    const position = (person + 0.5) / rosterSize;
    return Math.max(0, cutoffs.findIndex((cutoff) => position <= cutoff + EPSILON));
  });
}

/**
 * Almoço no horário fixo escolhido quando ele cabe com 1h de folga da entrada e da saída;
 * senão, 4h depois da entrada. Intervalos menores que 30 min não têm horário de almoço.
 */
function lunchStartFor(state, start, span, pause) {
  if (pause < MIN_LUNCH_FOR_FIXED_TIME) return null;
  let fixed = toMinutes(state.lunchStart);
  if (fixed < start) fixed += MINUTES_PER_DAY;
  const fitsFixedTime = fixed >= start + LUNCH_MARGIN && fixed + pause <= start + span - LUNCH_MARGIN;
  return fitsFixedTime ? fixed : start + LUNCH_AFTER_ENTRY;
}
