/**
 * Caracterização dos ajustes manuais (overrides) — registra o comportamento ATUAL, inclusive limitações.
 * Pré-requisito da E6 (identidade estável): a migração precisa preservar estes resultados de negócio,
 * exceto os marcados "LIMITAÇÃO ATUAL", que a E6 corrige com aprovação.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as actions from "../../src/js/application/actions.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { fromPersisted, toPersisted } from "../../src/js/infrastructure/stateRepository.js";
import { clone } from "../helpers.js";

/** Exemplo em 40h (com contratações) já normalizado pelo build. */
function scenario() {
  const state = createExampleState();
  state.phase = "40";
  const schedule = buildSchedule(state);
  return { state, schedule };
}

const firstOffDay = (row) => row.findIndex((works, day) => !works && day < 6);
const firstWorkday = (row) => row.findIndex((works, day) => works && day < 6);

test("a chave do ajuste é a POSIÇÃO da pessoa na lista: `${posição}-${semana}-${dia}`", () => {
  const { state, schedule } = scenario();
  state.week = 2;
  const worked = schedule.weeks[2][3][4];
  actions.toggleWorkday(state, schedule, 3, 4);
  assert.deepStrictEqual(state.overrides, { "3-2-4": !worked });
});

test("contratações sugeridas usam o id `novoN` na chave", () => {
  const { state, schedule } = scenario();
  const hireIndex = schedule.roster.findIndex((person) => person.isHire);
  assert.ok(hireIndex >= 0, "o cenário precisa ter contratações");
  actions.toggleWorkday(state, schedule, hireIndex, 0);
  assert.deepStrictEqual(Object.keys(state.overrides), [`${schedule.roster[hireIndex].id}-0-0`]);
  assert.match(schedule.roster[hireIndex].id, /^novo\d+$/);
});

test("inverter duas vezes mantém o ajuste explícito (não volta a 'sem ajuste')", () => {
  let { state, schedule } = scenario();
  const original = schedule.weeks[0][1][2];
  actions.toggleWorkday(state, schedule, 1, 2);
  schedule = buildSchedule(state);
  assert.equal(schedule.weeks[0][1][2], !original);
  actions.toggleWorkday(state, schedule, 1, 2);
  assert.deepStrictEqual(state.overrides, { "1-0-2": original });
});

test("mover folga grava origem = trabalha e destino = folga", () => {
  const { state, schedule } = scenario();
  const row = schedule.weeks[0][0];
  const from = firstOffDay(row);
  const to = firstWorkday(row);
  actions.moveDayOff(state, schedule, 0, from, to);
  assert.deepStrictEqual(state.overrides, { [`0-0-${from}`]: true, [`0-0-${to}`]: false });
  const updated = buildSchedule(state);
  assert.equal(updated.weeks[0][0][from], true);
  assert.equal(updated.weeks[0][0][to], false);
});

test("o ajuste prevalece sobre o motor mesmo quando viola regra", () => {
  const { state } = scenario();
  for (let day = 0; day < 7; day++) state.overrides[`0-0-${day}`] = true;
  assert.ok(buildSchedule(state).weeks[0][0].every(Boolean));
});

test("o ajuste só vale em dia aberto", () => {
  const { state } = scenario();
  state.days[6].open = false;
  state.overrides["0-0-6"] = true;
  assert.equal(buildSchedule(state).weeks[0][0][6], false);
  assert.deepStrictEqual(state.overrides, { "0-0-6": true }, "a chave continua gravada");
});

test("ajustes são independentes por semana", () => {
  const { state, schedule } = scenario();
  const before = schedule.weeks.map((grid) => grid[0].slice());
  state.overrides["0-1-0"] = !before[1][0];
  const after = buildSchedule(state);
  assert.equal(after.weeks[1][0][0], !before[1][0]);
  assert.deepStrictEqual(after.weeks[0][0], before[0]);
});

test("ações que APAGAM todos os ajustes", () => {
  const prepared = () => {
    const { state, schedule } = scenario();
    state.overrides = { "0-0-0": false, "novo1-1-2": true };
    return { state, schedule };
  };
  const clearing = {
    selectSegment: (s) => actions.selectSegment(s, 5),
    setActivityType: (s) => actions.setActivityType(s, "outros"),
    addTeamMember: (s) => actions.addTeamMember(s, "F"),
    removeTeamMember: (s) => actions.removeTeamMember(s, "M"),
    applyWorkModel: (s) => actions.applyWorkModel(s, "6"),
    toggleBusinessDay: (s) => actions.toggleBusinessDay(s, 6),
    setGroupHours: (s) => actions.setGroupHours(s, [0, 1, 2, 3, 4], "opensAt", "08:00"),
    changeDayDemand: (s) => actions.changeDayDemand(s, 0, 1),
    changeShiftHeadcount: (s) => actions.changeShiftHeadcount(s, 0, 0, 1),
    setShiftStart: (s) => actions.setShiftStart(s, 1, "10:00"),
    restoreSuggestedShifts: (s) => actions.restoreSuggestedShifts(s),
    restoreSuggestedDemand: (s) => actions.restoreSuggestedDemand(s),
    setIncludeHires: (s) => actions.setIncludeHires(s, false),
    setPhase: (s) => actions.setPhase(s, "42"),
    undoManualAdjustments: (s) => actions.undoManualAdjustments(s),
    toggleSex: (s) => actions.toggleSex(s, 0),
  };
  for (const [name, run] of Object.entries(clearing)) {
    const { state } = prepared();
    run(state);
    assert.deepStrictEqual(state.overrides, {}, `${name} deveria apagar os ajustes`);
  }
});

test("ações que PRESERVAM os ajustes", () => {
  const preserving = {
    setDayHours: (s) => actions.setDayHours(s, 2, "closesAt", "21:00"),
    setLunchMinutes: (s) => actions.setLunchMinutes(s, 90),
    setLunchStart: (s) => actions.setLunchStart(s, "13:00"),
    setSalary: (s) => actions.setSalary(s, 3000),
    setBenefits: (s) => actions.setBenefits(s, 200),
    selectWeek: (s) => actions.selectWeek(s, 3),
    setMobileTab: (s) => actions.setMobileTab(s, "custo"),
    renamePerson: (s, schedule) => actions.renamePerson(s, schedule, 0, "Ana Maria"),
    setShiftStartVazio: (s) => actions.setShiftStart(s, 1, ""),
    toggleSexInexistente: (s) => actions.toggleSex(s, 999),
  };
  for (const [name, run] of Object.entries(preserving)) {
    const { state, schedule } = scenario();
    state.overrides = { "0-0-0": false, "novo1-1-2": true };
    run(state, schedule);
    assert.deepStrictEqual(state.overrides, { "0-0-0": false, "novo1-1-2": true }, `${name} deveria preservar os ajustes`);
  }
});

test("renomear preserva o ajuste e ele continua valendo para a mesma pessoa", () => {
  const { state, schedule } = scenario();
  const original = schedule.weeks[0][0][1];
  state.overrides["0-0-1"] = !original;
  actions.renamePerson(state, schedule, 0, "Ana Maria");
  const after = buildSchedule(state);
  assert.equal(after.roster[0].name, "Ana Maria");
  assert.equal(after.weeks[0][0][1], !original);
});

test("LIMITAÇÃO ATUAL (corrigida na E6): reordenar a equipe transfere o ajuste para quem ocupa a posição", () => {
  const { state, schedule } = scenario();
  const original = schedule.weeks[0][0][1];
  state.overrides["0-0-1"] = !original;
  [state.team[0], state.team[1]] = [state.team[1], state.team[0]];
  const after = buildSchedule(state);
  assert.equal(after.roster[0].name, "Bruna");
  assert.equal(after.weeks[0][0][1], !original, "o ajuste de Ana agora vale para Bruna");
});

test("LIMITAÇÃO ATUAL (corrigida na E6): o nome da contratação segue a posição entre as contratações", () => {
  const { state } = scenario();
  state.hireNames = { novo1: "Maria (nova)" };
  assert.equal(buildSchedule(state).roster.find((person) => person.id === "novo1").name, "Maria (nova)");
});

test("ajustes sobrevivem à gravação e leitura (formato v3)", () => {
  const { state } = scenario();
  state.overrides = { "0-0-0": false, "novo1-1-2": true };
  assert.deepStrictEqual(fromPersisted(clone(toPersisted(state))).overrides, state.overrides);
});
