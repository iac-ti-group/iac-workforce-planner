/**
 * Motor da escala: distribui trabalho e folgas de cada pessoa ao longo de 4 semanas
 * respeitando a demanda, o revezamento de domingos e o limite de dias seguidos.
 */

import { DAYS_PER_WEEK, MONDAY_TO_SATURDAY, SIMULATED_WEEKS, SUNDAY } from "./calendar.js";
import { demandPerDay, requiredHeadcount } from "./demand.js";
import { MAX_CONSECUTIVE_WORKDAYS, Phase, Sex, maxConsecutiveSundaysForMen } from "./laborRules.js";
import { hireCapacity } from "./limits.js";
import { overrideKey } from "./overrides.js";
import { applyShiftPlan } from "./shiftPlan.js";
import { computeAssignments } from "./assignments.js";
import { workloadFor, shiftSpan } from "./workload.js";
import { countWhere, range } from "../shared/collections.js";

const FILL_ITERATION_LIMIT = 500;
const REBALANCE_ITERATION_LIMIT = 200;
/** Desloca a ordem de prioridade a cada semana para revezar quem trabalha nos dias disputados. */
const ROTATION_STEP = 3;

/**
 * @typedef {boolean[][]} WeekGrid  grid[pessoa][dia] = true quando trabalha
 * @typedef {object} Schedule
 * @property {import("./workload.js").Workload} workload
 * @property {object[]} roster          equipe + contratações sugeridas
 * @property {WeekGrid[]} weeks
 * @property {number[]} demand          pessoas necessárias por dia
 * @property {number} requiredHeadcount
 * @property {number} hires             contratações incluídas na escala (até o limite de pessoas)
 * @property {number} unmetHires        contratações necessárias que não couberam no limite
 * @property {number} teamSize          equipe atual (sem contratações)
 * @property {number} span              entrada → saída em um dia típico (minutos)
 * @property {boolean} usesShifts
 * @property {{week:number, day:number, shift:number, missing:number}[]} shiftShortages
 * @property {(week:number, day:number)=>Map<number, import("./assignments.js").Assignment>} assignmentsFor
 */

/** @returns {Schedule} */
export function buildSchedule(state) {
  const openDayCount = countWhere(state.days, (day) => day.open);
  const workload = workloadFor(state, state.phase, openDayCount || 1);
  const usesShifts = applyShiftPlan(state, workload);

  const teamSize = state.team.length;
  const required = requiredHeadcount(state, workload);
  const hiresNeeded = state.phase !== Phase.CURRENT && state.includeHires ? Math.max(0, required - teamSize) : 0;
  // Nunca passa do limite de pessoas; o que faltar fica explícito em unmetHires (e vira aviso).
  const hires = Math.min(hiresNeeded, hireCapacity(teamSize));
  const roster = buildRoster(state, hires);
  const demand = demandPerDay(state);
  const weeks = planWeeks(state, roster, demand, workload);

  const { assignmentsFor, shiftShortages } = computeAssignments(state, { roster, weeks, workload, usesShifts });

  return {
    workload,
    roster,
    weeks,
    demand,
    requiredHeadcount: required,
    hires,
    unmetHires: hiresNeeded - hires,
    teamSize,
    span: shiftSpan(state, workload.dailyMinutes),
    usesShifts,
    shiftShortages,
    assignmentsFor,
  };
}

function buildRoster(state, hires) {
  const roster = state.team.map((person) => ({ ...person, isHire: false }));
  for (let index = 1; index <= hires; index++) {
    const id = "novo" + index;
    roster.push({ name: state.hireNames[id] || "Nova contratação " + index, sex: Sex.UNDEFINED, isHire: true, id });
  }
  return roster;
}

function planWeeks(state, roster, demand, workload) {
  const history = roster.map(() => ({ trailingWorkdays: 0, workedLastSunday: false, sundayStreak: 0, sundaysWorked: 0 }));
  return range(SIMULATED_WEEKS).map((week) => {
    const grid = planWeek({ state, roster, demand, workload, history, week });
    updateHistory(history, grid);
    return grid;
  });
}

function planWeek({ state, roster, demand, workload, history, week }) {
  const grid = roster.map(() => new Array(DAYS_PER_WEEK).fill(false));
  const people = roster.map((_, index) => index);
  const rotation = (index) => (index + week * ROTATION_STEP) % Math.max(1, roster.length);

  /** Não forma 7 dias seguidos, contando os dias trabalhados no fim da semana anterior. */
  const canWork = (person, day) => {
    let run = history[person].trailingWorkdays;
    let longestRun = 0;
    for (let other = 0; other < DAYS_PER_WEEK; other++) {
      run = other === day || grid[person][other] ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
    }
    return longestRun <= MAX_CONSECUTIVE_WORKDAYS;
  };

  assignSundays({ state, roster, demand, history, grid, people, rotation });

  const daysLeft = people.map((person) => workload.workDays - (grid[person][SUNDAY] ? 1 : 0));
  const assigned = demand.map((_, day) => countWhere(grid, (row) => row[day]));
  const assign = (person, day) => {
    grid[person][day] = true;
    daysLeft[person]--;
    assigned[day]++;
  };

  coverDemand({ demand, assigned, grid, people, daysLeft, rotation, canWork, assign });
  fillRemainingWorkdays({ demand, assigned, grid, people, daysLeft, canWork, assign });
  rebalanceCoverage({ demand, assigned, grid, people, canWork });
  applyOverrides(state, roster, grid, week);
  return grid;
}

/** Domingo primeiro: quem trabalhou menos domingos e ainda pode trabalhar pela regra do sexo. */
function assignSundays({ state, roster, demand, history, grid, people, rotation }) {
  if (demand[SUNDAY] <= 0) return;
  const maxSundaysForMen = maxConsecutiveSundaysForMen(state.activityType);
  const isEligible = (person) =>
    roster[person].sex === Sex.MALE
      ? history[person].sundayStreak < maxSundaysForMen
      : !history[person].workedLastSunday;

  people
    .filter(isEligible)
    .sort((a, b) => history[a].sundaysWorked - history[b].sundaysWorked || rotation(a) - rotation(b))
    .slice(0, demand[SUNDAY])
    .forEach((person) => (grid[person][SUNDAY] = true));
}

/** Preenche sempre o dia com maior falta, com quem ainda tem mais dias a cumprir. */
function coverDemand({ demand, assigned, grid, people, daysLeft, rotation, canWork, assign }) {
  const exhausted = new Set();
  for (let iteration = 0; iteration < FILL_ITERATION_LIMIT; iteration++) {
    const day = dayWithLargestGap(demand, assigned, exhausted);
    if (day < 0) return;
    const candidates = people
      .filter((person) => daysLeft[person] > 0 && !grid[person][day] && canWork(person, day))
      .sort((a, b) => daysLeft[b] - daysLeft[a] || rotation(a) - rotation(b));
    if (!candidates.length) {
      exhausted.add(day);
      continue;
    }
    assign(candidates[0], day);
  }
}

function dayWithLargestGap(demand, assigned, exhausted) {
  let bestDay = -1;
  let bestGap = 0;
  for (const day of MONDAY_TO_SATURDAY) {
    if (exhausted.has(day)) continue;
    const gap = demand[day] - assigned[day];
    if (gap > bestGap) {
      bestGap = gap;
      bestDay = day;
    }
  }
  return bestDay;
}

/** Quem ainda tem dias a cumprir trabalha onde há menos gente proporcionalmente. */
function fillRemainingWorkdays({ demand, assigned, grid, people, daysLeft, canWork, assign }) {
  people.forEach((person) => {
    while (daysLeft[person] > 0) {
      let bestDay = -1;
      let bestRatio = Infinity;
      for (const day of MONDAY_TO_SATURDAY) {
        if (!demand[day] || grid[person][day] || !canWork(person, day)) continue;
        const ratio = assigned[day] / demand[day];
        if (ratio < bestRatio) {
          bestRatio = ratio;
          bestDay = day;
        }
      }
      if (bestDay < 0) return;
      assign(person, bestDay);
    }
  });
}

/** Move alguém de um dia com sobra para um dia com falta até não haver mais troca possível. */
function rebalanceCoverage({ demand, assigned, grid, people, canWork }) {
  const tryMove = () => {
    for (const shortDay of MONDAY_TO_SATURDAY) {
      if (assigned[shortDay] >= demand[shortDay]) continue;
      for (const surplusDay of MONDAY_TO_SATURDAY) {
        if (surplusDay === shortDay || assigned[surplusDay] <= demand[surplusDay]) continue;
        for (const person of people) {
          if (!grid[person][surplusDay] || grid[person][shortDay]) continue;
          grid[person][surplusDay] = false;
          if (canWork(person, shortDay)) {
            grid[person][shortDay] = true;
            assigned[shortDay]++;
            assigned[surplusDay]--;
            return true;
          }
          grid[person][surplusDay] = true;
        }
      }
    }
    return false;
  };
  for (let iteration = 0; iteration < REBALANCE_ITERATION_LIMIT && tryMove(); iteration++);
}

/** Ajustes manuais prevalecem sobre o motor, apenas em dias em que a empresa abre. */
function applyOverrides(state, roster, grid, week) {
  roster.forEach((person, index) => {
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const override = state.overrides[overrideKey(person, index, week, day)];
      if (override !== undefined && state.days[day].open) grid[index][day] = override;
    }
  });
}

function updateHistory(history, grid) {
  history.forEach((record, person) => {
    const row = grid[person];
    record.trailingWorkdays = row.reduce((run, works) => (works ? run + 1 : 0), record.trailingWorkdays);
    record.workedLastSunday = row[SUNDAY];
    record.sundayStreak = row[SUNDAY] ? record.sundayStreak + 1 : 0;
    if (row[SUNDAY]) record.sundaysWorked++;
  });
}
