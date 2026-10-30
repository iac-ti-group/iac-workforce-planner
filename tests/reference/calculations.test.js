/**
 * Casos de referência com valores calculados À MÃO (fórmula no comentário de cada caso).
 * Diferente do golden/paridade, estes testes não usam o motor como fonte da verdade.
 *
 * Divergências encontradas na auditoria (Etapa A) estão como `todo`: documentam o resultado correto
 * esperado sem alterar regras de negócio antes da aprovação. Ver docs/calculos-e-regras.md.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost } from "../../src/js/domain/cost.js";
import { distributeDemand, requiredHeadcount } from "../../src/js/domain/demand.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { breakMinutes, shiftSpan, workloadFor } from "../../src/js/domain/workload.js";

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

test("jornada diária por fase (minutos = horas semanais × 60 ÷ dias trabalhados)", () => {
  const state = createExampleState();
  const cases = [
    // [fase, dias abertos, dias trabalhados, minutos/dia, horas/semana]
    ["44", 7, 6, (44 * 60) / 6, 44], // 440 = 7h20
    ["44", 6, 6, (44 * 60) / 6, 44],
    ["44", 5, 5, (44 * 60) / 5, 44], // 528 = 8h48
    ["42", 7, 5, (42 * 60) / 5, 42], // 504 = 8h24
    ["40", 7, 5, (40 * 60) / 5, 40], // 480 = 8h
    ["40", 5, 5, 480, 40],
  ];
  for (const [phase, open, days, minutes, hours] of cases) {
    const workload = workloadFor(state, phase, open);
    assert.equal(workload.workDays, days, `${phase}h/${open} dias`);
    close(workload.dailyMinutes, minutes, `${phase}h/${open} dias: minutos`);
    close(workload.weeklyHours, hours, `${phase}h/${open} dias: horas`);
  }
});

test("modelo 44h seg–sex 8h + sábado 4h: 5 × 8 + 4 = 44h", () => {
  const state = { ...createExampleState(), workModel: "6" };
  const workload = workloadFor(state, "44", 6);
  const week = [0, 1, 2, 3, 4, 5].reduce((total, day) => total + workload.minutesOnDay(day), 0);
  assert.equal(week, 5 * 480 + 240);
  assert.equal(workload.weeklyHours, 44);
});

test("intervalo intrajornada (CLT art. 71): até 4h sem pausa, até 6h 15 min, acima de 6h o almoço escolhido", () => {
  const state = { ...createExampleState(), lunchMinutes: 75 };
  assert.equal(breakMinutes(state, 240), 0);
  assert.equal(breakMinutes(state, 241), 15);
  assert.equal(breakMinutes(state, 360), 15);
  assert.equal(breakMinutes(state, 361), 75);
  assert.equal(shiftSpan(state, 504), 504 + 75); // entrada → saída
});

test("custo: exemplo de 8 pessoas, salário R$ 2.150, benefícios R$ 0, encargos 75%, fase 42h", () => {
  const state = createExampleState();
  const cost = estimateCost(state, buildSchedule(state));
  const perEmployee = 2150 * 1.75; // 3.762,50
  close(cost.costPerEmployee, perEmployee, "custo por pessoa");
  close(cost.payroll, 8 * perEmployee, "folha"); // 30.100
  close(cost.hourlyCostToday, perEmployee / 220, "hora hoje"); // 17,10
  close(cost.hourlyCostTarget, perEmployee / 210, "hora 42h"); // 17,92
  close(cost.hourlyIncreasePercent, (220 / 210 - 1) * 100, "aumento da hora"); // 4,76%
  assert.equal(cost.hoursLostPerMonth, 8 * (220 - 210)); // 80h
  assert.equal(cost.missingHeadcount, 2); // 10 necessárias − 8
  close(cost.hiringCost, 2 * perEmployee, "custo das contratações"); // 7.525
});

test("divisor mensal = horas semanais × 5 (220, 210, 200)", () => {
  const state = { ...createExampleState(), salary: 1000 };
  const byPhase = Object.fromEntries(estimateCost(state, buildSchedule(state)).hourlyCostByPhase.map((e) => [e.phase, e.hourlyCost]));
  const perEmployee = 1000 * 1.75;
  close(byPhase["44"], perEmployee / (44 * 5), "44h");
  close(byPhase["42"], perEmployee / (42 * 5), "42h");
  close(byPhase["40"], perEmployee / (40 * 5), "40h");
});

test("demanda sugerida com 7 dias: turnos = equipe × 6; domingo = 40% da equipe; resto em seg–sáb", () => {
  const state = createExampleState(); // 8 pessoas
  distributeDemand(state);
  // 8 × 6 = 48 turnos; domingo round(3,2) = 3; 45 ÷ 6 = 7 sobra 3 → seg, ter, qua com 8.
  assert.deepStrictEqual(state.days.map((d) => d.need), [8, 8, 8, 7, 7, 7, 3]);
  assert.equal(state.days.reduce((total, d) => total + d.need, 0), 48);
});

test("pessoas necessárias em 40h no exemplo = ⌈48 turnos ÷ 5 dias⌉ = 10", () => {
  const state = createExampleState();
  distributeDemand(state);
  assert.equal(requiredHeadcount(state, workloadFor(state, "40", 7)), Math.ceil(48 / 5));
});

test("capacidade de domingo: 4 mulheres cobrem 2 domingos/semana (alternado); 3 homens no comércio cobrem 2", () => {
  const state = createExampleState();
  state.team = [..."FFFF"].map((sex, i) => ({ name: "M" + i, sex }));
  state.days.forEach((d) => (d.need = 0));
  state.days[6].need = 2;
  assert.equal(requiredHeadcount(state, workloadFor(state, "40", 7)), 4); // 4 × 0,5 = 2: basta a equipe
  state.team = [..."MMM"].map((sex, i) => ({ name: "H" + i, sex }));
  assert.equal(requiredHeadcount(state, workloadFor(state, "40", 7)), 3); // 3 × 2/3 = 2
});

// ---- Divergências da auditoria (aguardam aprovação; ver docs/calculos-e-regras.md) ----

test("D1 — descanso mínimo de 11h entre jornadas (CLT art. 66) deveria ser verificado", {
  todo: "o exemplo em 40h tem 12 ocorrências de 9h entre jornadas e nenhum aviso",
}, () => {
  const state = { ...createExampleState(), phase: "40" };
  const schedule = buildSchedule(state);
  for (let week = 0; week < 4; week++) {
    for (let day = 0; day < 6; day++) {
      for (const [person, today] of schedule.assignmentsFor(week, day)) {
        const tomorrow = schedule.assignmentsFor(week, day + 1).get(person);
        if (tomorrow) assert.ok(tomorrow.start + 1440 - today.end >= 660);
      }
    }
  }
});

test("D3 — “Sem contratar” deveria custar as horas perdidas como hora extra (+50% e encargos)", {
  todo: "hoje usa a hora normal: R$ 1.433,33 em vez de R$ 2.150,00 no exemplo",
}, () => {
  const state = createExampleState();
  const cost = estimateCost(state, buildSchedule(state));
  close(cost.costToKeepCoverage, 80 * (2150 / 210) * 1.5 * 1.75, "80h × hora normal × 1,5 × encargos");
});

test("D4 — horas extras das contratações deveriam usar o mesmo mês do divisor (h semanais × 5)", {
  todo: "hoje usa 30/7 semanas (180 h/mês em 42h) e o divisor usa 210",
}, () => {
  const state = createExampleState();
  const cost = estimateCost(state, buildSchedule(state));
  close(cost.overtimeCost, 2 * 210 * (2150 / 210) * 1.5 * 1.75, "2 pessoas × 210h");
});

test("D5 — “Pessoas necessárias” deveria poder ser menor que a equipe atual", {
  todo: "demanda de 2 pessoas/dia em 40h precisa de 3 pessoas; o simulador mostra 8 (a equipe)",
}, () => {
  const state = { ...createExampleState(), phase: "40", autoDemand: false };
  state.days.forEach((d) => (d.need = 2));
  assert.equal(buildSchedule(state).requiredHeadcount, 3);
});
