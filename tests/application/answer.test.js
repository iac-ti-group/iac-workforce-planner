/** Resposta em linguagem simples e comparação das jornadas (valores conferidos à mão). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePhases, describeAnswer } from "../../src/js/application/answer.js";
import { evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { formatCurrency } from "../../src/js/shared/format.js";
import { clone } from "../helpers.js";

const answerFor = (changes = {}) => {
  const state = { ...createExampleState(), ...changes };
  const schedule = buildSchedule(state);
  return describeAnswer(state, schedule, evaluateCompliance(state, schedule));
};
const textOf = (answer, topic) => answer.lines.find((line) => line.topic === topic)?.text;

test("exemplo em 42h: rotina, equipe, contratações, custo e regras em frases simples", () => {
  const answer = answerFor();
  assert.equal(answer.title, "Na jornada de 42h");
  assert.equal(answer.tone, "ok");
  assert.equal(textOf(answer, "rotina"), "Cada pessoa trabalha 5 dias de 8h24 e folga 2 dias por semana.");
  assert.equal(textOf(answer, "equipe"), "Para cobrir os dias e horários informados, são necessárias 10 pessoas: 2 a mais do que a equipe atual de 8.");
  assert.equal(textOf(answer, "escala"), "A escala abaixo já inclui 2 contratações sugeridas.");
  // 8 × (2.150 × 1,75) = 30.100; + 2 × 3.762,50 = 37.625 (+25%)
  assert.equal(textOf(answer, "custo"), `Folha mensal estimada: ${formatCurrency(30100)} hoje e ${formatCurrency(37625)} com as contratações (+25%).`);
  assert.equal(textOf(answer, "regras"), "A escala está dentro das regras conferidas pelo simulador.");
});

test("sem incluir contratações: explica que a escala mostra só a equipe e aponta a falta", () => {
  const answer = answerFor({ includeHires: false });
  assert.match(textOf(answer, "escala"), /mostra só a equipe atual/);
  assert.equal(answer.tone, "warn");
  assert.equal(textOf(answer, "regras"), "Faltam pessoas em alguns dias ou turnos: veja “Pontos de atenção”.");
});

test("hoje (44h) com 7 dias abertos: 6 dias de 7h20 e uma folga", () => {
  const answer = answerFor({ phase: "44" });
  assert.equal(answer.title, "Hoje, na jornada de 44h");
  assert.equal(textOf(answer, "rotina"), "Cada pessoa trabalha 6 dias de 7h20 e folga 1 dia por semana.");
  assert.equal(textOf(answer, "custo"), `Folha mensal estimada hoje: ${formatCurrency(30100)}.`);
});

test("sem salário e sem equipe: diz o que preencher", () => {
  const answer = answerFor({ salary: 0, team: [] });
  assert.match(textOf(answer, "equipe"), /Informe a equipe atual/);
  assert.match(textOf(answer, "custo"), /Informe o salário médio/);
});

test("violação forçada aparece como ponto fora da regra (tom vermelho)", () => {
  const overrides = {};
  for (let day = 0; day < 7; day++) overrides[`0-0-${day}`] = true;
  const answer = answerFor({ phase: "40", overrides });
  assert.equal(answer.tone, "bad");
  assert.match(textOf(answer, "regras"), /^A escala tem \d+ pontos? fora da regra/);
});

test("comparação das jornadas: valores por fase e estado original intacto", () => {
  const state = createExampleState();
  const before = clone(state);
  const rows = comparePhases(state);
  assert.deepEqual(clone(state), before, "a comparação não altera o estado");
  const byPhase = Object.fromEntries(rows.map((row) => [row.phase, row]));

  assert.deepEqual([byPhase["44"].workDays, byPhase["44"].dailyMinutes, byPhase["44"].weeklyHours], [6, 440, 44]);
  assert.deepEqual([byPhase["42"].workDays, byPhase["42"].dailyMinutes, byPhase["42"].weeklyHours], [5, 504, 42]);
  assert.deepEqual([byPhase["40"].workDays, byPhase["40"].dailyMinutes, byPhase["40"].weeklyHours], [5, 480, 40]);
  // 40h: ⌈48 turnos ÷ 5 dias⌉ = 10 pessoas → 2 a contratar; folha 30.100 + 2 × 3.762,50.
  assert.equal(byPhase["40"].required, 10);
  assert.equal(byPhase["40"].missing, 2);
  assert.equal(byPhase["40"].monthlyCost, 30100 + 2 * 3762.5);
});

test("comparação ignora ajustes manuais (são de uma jornada só) e funciona sem salário", () => {
  const state = { ...createExampleState(), salary: 0, overrides: { "0-0-0": false } };
  const rows = comparePhases(state);
  assert.ok(rows.every((row) => row.monthlyCost === null));
  assert.deepEqual(state.overrides, { "0-0-0": false });
});
