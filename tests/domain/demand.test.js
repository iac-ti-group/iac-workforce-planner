/** Caracterização de distributeDemand e requiredHeadcount (comportamento atual). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { distributeDemand, requiredHeadcount } from "../../src/js/domain/demand.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { workloadFor } from "../../src/js/domain/workload.js";

const teamOf = (size) => Array.from({ length: size }, (_, index) => ({ name: "P" + index, sex: index % 2 ? "M" : "F" }));

function stateWith({ teamSize, openDays }) {
  const state = createExampleState();
  state.team = teamOf(teamSize);
  state.days.forEach((day, index) => (day.open = openDays.includes(index)));
  return state;
}

const needs = (state) => state.days.map((day) => day.need);

test("7 dias abertos: domingo com ~40% da equipe e o restante dividido entre seg e sáb (sobra nos primeiros dias)", () => {
  const state = stateWith({ teamSize: 8, openDays: [0, 1, 2, 3, 4, 5, 6] });
  distributeDemand(state);
  // 8 pessoas × 6 dias = 48 turnos; domingo = round(3,2) = 3; 45 / 6 = 7 com sobra 3.
  assert.deepStrictEqual(needs(state), [8, 8, 8, 7, 7, 7, 3]);
});

test("até 6 dias abertos: cada dia aberto recebe a equipe inteira; fechados ficam com 0", () => {
  const state = stateWith({ teamSize: 8, openDays: [0, 1, 2, 3, 4, 5] });
  distributeDemand(state);
  assert.deepStrictEqual(needs(state), [8, 8, 8, 8, 8, 8, 0]);

  const fiveDays = stateWith({ teamSize: 3, openDays: [0, 1, 2, 3, 4] });
  distributeDemand(fiveDays);
  assert.deepStrictEqual(needs(fiveDays), [3, 3, 3, 3, 3, 0, 0]);
});

test("equipe de 1 pessoa com 7 dias: domingo garante 1 e sábado fica sem ninguém", () => {
  const state = stateWith({ teamSize: 1, openDays: [0, 1, 2, 3, 4, 5, 6] });
  distributeDemand(state);
  assert.deepStrictEqual(needs(state), [1, 1, 1, 1, 1, 0, 1]);
});

test("equipe vazia: tudo 0", () => {
  const state = stateWith({ teamSize: 0, openDays: [0, 1, 2, 3, 4, 5, 6] });
  distributeDemand(state);
  assert.deepStrictEqual(needs(state), [0, 0, 0, 0, 0, 0, 0]);
});

test("nenhum dia aberto: a demanda anterior é mantida sem alteração", () => {
  const state = stateWith({ teamSize: 4, openDays: [] });
  state.days.forEach((day, index) => (day.need = index));
  distributeDemand(state);
  assert.deepStrictEqual(needs(state), [0, 1, 2, 3, 4, 5, 6]);
});

test("pessoas necessárias: maior entre turnos da semana, pico do dia e reforço para o domingo", () => {
  const state = stateWith({ teamSize: 8, openDays: [0, 1, 2, 3, 4, 5, 6] });
  distributeDemand(state);
  // 40h: 5 dias por pessoa. Demanda total 48 → ceil(48 / 5) = 10.
  assert.equal(requiredHeadcount(state, workloadFor(state, "40", 7)), 10);
  // 44h: 6 dias por pessoa → 48 / 6 = 8 (a equipe atual).
  assert.equal(requiredHeadcount(state, workloadFor(state, "44", 7)), 8);
});

test("domingo acima da capacidade de revezamento exige reforço", () => {
  const state = stateWith({ teamSize: 4, openDays: [0, 1, 2, 3, 4, 5, 6] });
  state.team = teamOf(4).map((person) => ({ ...person, sex: "F" }));
  state.days.forEach((day) => (day.need = 0));
  state.days[6].need = 4;
  // 4 mulheres cobrem 2 domingos (alternados); faltam 2 → (4 - 2) / 0,5 = 4 pessoas a mais.
  assert.equal(requiredHeadcount(state, workloadFor(state, "40", 7)), 8);
});
