import { createExampleState } from "../src/js/domain/simulationState.js";
import { SEGMENTS, daysFromSegment } from "../src/js/domain/segments.js";
import { distributeDemand } from "../src/js/domain/demand.js";
import { WORK_MODELS } from "../src/js/domain/workModels.js";

/** Gerador pseudoaleatório determinístico, para testes reproduzíveis. */
export function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

const LUNCH_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180];

const tools = (random) => {
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (items) => items[Math.floor(random() * items.length)];
  const clock = () => String(int(0, 23)).padStart(2, "0") + ":" + pick(["00", "10", "30", "45", "59"]);
  return { int, pick, clock };
};

/**
 * Estado de domínio válido e variado.
 * Por padrão gera só o que o motor sugere sozinho (sem ajustes manuais), para testar invariantes.
 * @param {() => number} random
 * @param {{ overrides?: boolean, manual?: boolean }} [options]
 *   overrides: inclui ajustes manuais (trabalho/folga forçados);
 *   manual:    inclui modelos de jornada, horários noturnos, demanda e turnos editados.
 */
export function randomState(random, { overrides = false, manual = false } = {}) {
  const { int, pick, clock } = tools(random);
  const segmentIndex = int(0, SEGMENTS.length - 1);
  const teamSize = int(0, 14);
  const state = {
    ...createExampleState(),
    segmentIndex,
    activityType: SEGMENTS[segmentIndex].activityType,
    days: daysFromSegment(SEGMENTS[segmentIndex]),
    team: Array.from({ length: teamSize }, (_, index) => ({ name: "P" + index, sex: pick(["F", "M"]) })),
    phase: pick(["44", "42", "40"]),
    includeHires: random() < 0.5,
    lunchMinutes: pick(manual ? LUNCH_OPTIONS : [30, 60, 90, 120]),
  };

  if (manual) {
    if (random() < 0.25) {
      state.workModel = pick(["5", "6", "7"]);
      state.segmentIndex = -1;
      state.days = state.days.map((_, day) => ({ ...WORK_MODELS[state.workModel](day), need: 0 }));
    }
    if (random() < 0.3) {
      // Expediente que atravessa a meia-noite em alguns dias.
      state.days.forEach((day) => {
        if (random() < 0.5) Object.assign(day, { opensAt: pick(["17:00", "18:00", "20:00"]), closesAt: pick(["01:00", "02:00", "00:30"]) });
      });
    }
    if (random() < 0.2) state.days.forEach((day) => (day.opensAt = clock()));
    if (random() < 0.3) state.lunchStart = clock();
  }

  distributeDemand(state);

  if (manual && random() < 0.3) {
    state.autoDemand = false;
    state.days.forEach((day) => (day.need = day.open ? int(0, teamSize + 2) : 0));
  }
  if (manual && random() < 0.3) {
    state.autoShifts = false;
    state.shiftStarts = [0, 1, 2].map(() => ({ start: clock(), auto: random() < 0.3 }));
    state.shiftHeadcount = [0, 1, 2].map(() => [int(0, 4), int(0, 4), int(0, 3)]);
  }
  if (overrides) {
    const count = int(0, 12);
    for (let index = 0; index < count; index++) {
      const person = random() < 0.2 ? "novo" + int(1, 3) : int(0, Math.max(0, teamSize - 1));
      state.overrides[`${person}-${int(0, 3)}-${int(0, 6)}`] = random() < 0.5;
    }
  }
  return state;
}

/** Estado no formato gravado no localStorage (v3), como o app original produzia. Usado na paridade com o legado. */
export function randomPersistedState(random) {
  const { int, pick, clock } = tools(random);
  const teamSize = int(0, 14);
  const team = Array.from({ length: teamSize }, (_, index) => ({ n: "P" + index, s: pick(["F", "M"]) }));
  const days = Array.from({ length: 7 }, () => ({
    on: random() < 0.8,
    a: random() < 0.7 ? pick(["06:00", "07:00", "08:00", "09:00", "10:00", "17:00"]) : clock(),
    f: random() < 0.7 ? pick(["12:00", "14:00", "18:00", "20:00", "22:00", "23:30", "23:59"]) : clock(),
    need: int(0, teamSize + 2),
  }));
  if (random() < 0.4) days.forEach((day) => (day.on = true));
  const raw = {
    seg: int(-1, 28), tipo: pick(["comercio", "outros"]), team, days, needAuto: random() < 0.5,
    fase: pick(["44", "42", "40"]), contratar: random() < 0.5, sal: 2000, enc: 75, ben: 0, ov: {},
    wk: int(0, 3), names: {}, modelo: pick([null, null, "5", "6", "7"]),
    alm: pick([30, 45, 60, 60, 75, 90, 120, 150, 180]), almIni: pick(["12:00", "11:30", "13:00", clock()]),
  };
  if (random() < 0.5) raw.tnAuto = random() < 0.5;
  if (random() < 0.4) raw.tt = [0, 1, 2].map(() => ({ auto: random() < 0.5, ini: clock() }));
  if (random() < 0.4) raw.tn = [0, 1, 2].map(() => [int(0, 4), int(0, 4), int(0, 3)]);
  const overrideCount = int(0, 12);
  for (let index = 0; index < overrideCount; index++) {
    const person = random() < 0.2 ? "novo" + int(1, 3) : int(0, teamSize);
    raw.ov[`${person}-${int(0, 3)}-${int(0, 6)}`] = random() < 0.5;
  }
  if (random() < 0.3) raw.names.novo1 = "Fulano";
  return raw;
}

export const clone = (value) => JSON.parse(JSON.stringify(value));
