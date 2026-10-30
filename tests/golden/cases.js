/**
 * Entradas do golden. Usado SOMENTE pelo gerador quando ainda não existem fixtures
 * (ou com --new-inputs); depois disso as entradas gravadas em fixtures/ são a referência.
 */

import { createExampleState } from "../../src/js/domain/simulationState.js";
import { SEGMENTS, daysFromSegment } from "../../src/js/domain/segments.js";
import { distributeDemand } from "../../src/js/domain/demand.js";
import { WORK_MODELS } from "../../src/js/domain/workModels.js";
import { toPersisted } from "../../src/js/infrastructure/stateRepository.js";
import { clone, randomState, seededRandom } from "../helpers.js";

const MIXED_TEAM = ["F", "F", "M", "F", "M", "M", "F", "M", "F", "M"].map((sex, index) => ({ name: "Pessoa " + (index + 1), sex }));

const withChanges = (changes) => {
  const state = { ...createExampleState(), ...changes };
  if (!changes.days && changes.segmentIndex !== undefined && changes.segmentIndex >= 0) {
    state.days = daysFromSegment(SEGMENTS[changes.segmentIndex]);
    state.activityType = SEGMENTS[changes.segmentIndex].activityType;
  }
  if (state.autoDemand) distributeDemand(state);
  return state;
};

function curatedCases() {
  const cases = [];
  const add = (name, state) => cases.push({ name, input: toPersisted(clone(state)) });

  for (const phase of ["44", "42", "40"]) {
    add(`exemplo-${phase}h-com-contratacoes`, withChanges({ phase }));
    add(`exemplo-${phase}h-sem-contratacoes`, withChanges({ phase, includeHires: false }));
  }
  SEGMENTS.forEach((seg, segmentIndex) =>
    add(`ramo-${String(segmentIndex).padStart(2, "0")}-40h`, withChanges({ segmentIndex, team: clone(MIXED_TEAM), phase: "40" })),
  );
  for (const model of Object.keys(WORK_MODELS)) {
    const state = withChanges({ workModel: model, segmentIndex: -1, phase: "44" });
    state.days = state.days.map((_, day) => ({ ...WORK_MODELS[model](day), need: 0 }));
    distributeDemand(state);
    add(`modelo-${model}-44h`, state);
  }

  const overrides = withChanges({ phase: "40" });
  Object.assign(overrides.overrides, { "0-0-0": true, "0-0-1": true, "0-0-2": true, "0-0-3": true, "0-0-4": true, "0-0-5": true, "0-0-6": true, "1-1-6": true, "1-2-6": true, "novo1-0-2": false });
  add("ajustes-manuais-com-violacoes", overrides);

  const forced = (name, phase, keys) => {
    const state = withChanges({ phase });
    keys.forEach((key) => (state.overrides[key] = true));
    add(name, state);
  };
  forced("violacao-domingos-seguidos-mulher", "40", ["0-0-6", "0-1-6"]);
  forced("violacao-domingos-seguidos-homem-comercio", "40", ["4-0-6", "4-1-6", "4-2-6"]);
  forced("violacao-7-dias-na-virada-da-semana", "40", ["2-0-3", "2-0-4", "2-0-5", "2-0-6", "2-1-0", "2-1-1", "2-1-2"]);
  forced("violacao-horas-e-folgas-44h", "44", ["0-1-0", "0-1-1", "0-1-2", "0-1-3", "0-1-4", "0-1-5", "0-1-6"]);

  const manualShifts = withChanges({ phase: "42", autoShifts: false, autoDemand: false });
  manualShifts.shiftStarts = [{ start: "06:00", auto: false }, { start: "11:00", auto: false }, { start: "15:30", auto: true }];
  manualShifts.shiftHeadcount = [[3, 2, 0], [2, 2, 1], [1, 1, 1]];
  add("turnos-editados", manualShifts);

  const overnight = withChanges({ segmentIndex: 6, team: clone(MIXED_TEAM), phase: "42" });
  overnight.days.forEach((day) => Object.assign(day, { opensAt: "18:00", closesAt: "02:00" }));
  add("expediente-noturno", overnight);

  add("almoco-30min", withChanges({ lunchMinutes: 30, phase: "40" }));
  add("almoco-150min-inicio-13h30", withChanges({ lunchMinutes: 150, lunchStart: "13:30", phase: "42" }));
  add("equipe-vazia", withChanges({ team: [], phase: "40" }));
  add("todos-os-dias-fechados", withChanges({ days: createExampleState().days.map((day) => ({ ...day, open: false, need: 0 })), phase: "40" }));
  add("demanda-manual-alta", withChanges({ autoDemand: false, days: createExampleState().days.map((day) => ({ ...day, need: 6 })), phase: "40" }));
  add("contratacoes-nomeadas", withChanges({ phase: "40", hireNames: { novo1: "Maria (nova)", novo2: "João (novo)" } }));
  add("semana-3-selecionada", withChanges({ phase: "42", week: 2 }));
  return cases;
}

function randomCases() {
  const random = seededRandom(2026);
  return Array.from({ length: 20 }, (_, index) => ({
    name: `aleatorio-${String(index).padStart(2, "0")}`,
    input: toPersisted(randomState(random, { overrides: true, manual: true })),
  }));
}

export const buildCaseInputs = () =>
  [...curatedCases(), ...randomCases()].map((testCase) => ({ ...testCase, input: { ...testCase.input, sal: testCase.input.sal || 2150, ben: 150 } }));
