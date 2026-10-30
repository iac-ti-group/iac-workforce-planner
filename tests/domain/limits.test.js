/** Limites operacionais (E2): equipe, demanda, contratações, almoço e nomes. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as actions from "../../src/js/application/actions.js";
import { AlertCode, evaluateCompliance } from "../../src/js/domain/compliance.js";
import { MAX_DAILY_DEMAND, MAX_PEOPLE, hireCapacity, maxOverrides } from "../../src/js/domain/limits.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { fromPersisted, toPersisted } from "../../src/js/infrastructure/stateRepository.js";
import { clone } from "../helpers.js";

const teamOf = (size) => Array.from({ length: size }, (_, i) => ({ name: "P" + i, sex: i % 2 ? "M" : "F" }));

test("valores dos limites acordados", () => {
  assert.equal(MAX_PEOPLE, 200);
  assert.equal(MAX_DAILY_DEMAND, 200);
  assert.equal(hireCapacity(150), 50);
  assert.equal(hireCapacity(250), 0);
  assert.equal(maxOverrides(10), 10 * 4 * 7);
});

test("equipe: não passa de 200 pessoas", () => {
  const state = { ...createExampleState(), team: teamOf(200) };
  actions.addTeamMember(state, "F");
  assert.equal(state.team.length, 200);
  actions.removeTeamMember(state, "F");
  assert.equal(state.team.length, 199);
  actions.addTeamMember(state, "F");
  assert.equal(state.team.length, 200);
});

test("demanda por dia e soma dos turnos não passam de 200", () => {
  const state = createExampleState();
  state.days[0].need = 200;
  actions.changeDayDemand(state, 0, 1);
  assert.equal(state.days[0].need, 200);
  actions.changeDayDemand(state, 0, -1);
  assert.equal(state.days[0].need, 199);

  buildSchedule(state);
  state.shiftHeadcount[0] = [150, 50, 0];
  actions.changeShiftHeadcount(state, 0, 2, 1);
  assert.deepEqual(state.shiftHeadcount[0], [150, 50, 0]);
  actions.changeShiftHeadcount(state, 0, 0, -1);
  assert.deepEqual(state.shiftHeadcount[0], [149, 50, 0]);
});

test("contratações limitadas à capacidade restante: aviso explícito e sem “escala dentro das regras”", () => {
  const state = { ...createExampleState(), phase: "40", team: teamOf(10), autoDemand: false };
  state.days.forEach((day) => (day.need = 200));
  const schedule = buildSchedule(state);
  // Semana: ⌈1.400 turnos ÷ 5 dias⌉ = 280. Domingo pesa mais: 200 no domingo, capacidade da equipe
  // = 5 mulheres × 0,5 + 5 homens × 2/3 = 5,83 → reforço ⌈(200 − 5,83) ÷ 0,5⌉ = 389 → 10 + 389 = 399.
  // Cabem 190 contratações além das 10 pessoas; 399 − 200 = 199 contratações não cabem no limite.
  assert.equal(schedule.requiredHeadcount, 399);
  assert.equal(schedule.hires, 190);
  assert.equal(schedule.unmetHires, 399 - 10 - 190);
  assert.equal(schedule.roster.length, 200);

  const alerts = evaluateCompliance(state, schedule).alerts;
  assert.equal(alerts[0].code, AlertCode.HIRES_CAPPED);
  assert.equal(alerts[0].title, "Contratações limitadas a 200 pessoas no total");
  assert.match(alerts[0].detail, /pede 399 pessoas.*Faltam 199/);
  assert.ok(alerts.some((alert) => alert.code === AlertCode.COVERAGE_GAP), "a falta de cobertura também aparece");
  assert.ok(!alerts.some((alert) => alert.code === AlertCode.COMPLIANT));
});

test("estado salvo extremo (demanda 20.000) vira no máximo 200 pessoas na escala", () => {
  const raw = toPersisted({ ...createExampleState(), phase: "40", autoDemand: false });
  raw.days.forEach((day) => (day.need = 20000));
  const state = fromPersisted(clone(raw));
  const schedule = buildSchedule(state);
  assert.ok(state.days.every((day) => day.need <= 200));
  assert.ok(schedule.roster.length <= 200);
});

test("almoço só aceita as opções do seletor; horários só HH:MM válidos", () => {
  const state = createExampleState();
  actions.setLunchMinutes(state, 37);
  assert.equal(state.lunchMinutes, 60);
  actions.setLunchMinutes(state, 90);
  assert.equal(state.lunchMinutes, 90);

  for (const invalid of ["", "25:00", "8:00", null]) {
    actions.setLunchStart(state, invalid);
    actions.setDayHours(state, 0, "opensAt", invalid);
    actions.setGroupHours(state, [1, 2], "closesAt", invalid);
  }
  assert.equal(state.lunchStart, "12:00");
  assert.equal(state.days[0].opensAt, "07:00");
  assert.equal(state.days[1].closesAt, "22:00");
});

test("nome limitado a 80 caracteres", () => {
  const state = createExampleState();
  const schedule = buildSchedule(state);
  actions.renamePerson(state, schedule, 0, "  " + "a".repeat(120) + "  ");
  assert.equal(state.team[0].name, "a".repeat(80));
});
