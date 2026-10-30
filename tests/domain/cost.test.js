import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost } from "../../src/js/domain/cost.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";

test("sem salário não há estimativa", () => {
  const state = { ...createExampleState(), salary: 0 };
  assert.equal(estimateCost(state, buildSchedule(state)), null);
});

test("custo por pessoa inclui 75% de encargos e benefícios", () => {
  const state = { ...createExampleState(), salary: 2000, benefits: 100 };
  const cost = estimateCost(state, buildSchedule(state));
  assert.equal(cost.costPerEmployee, 2000 * 1.75 + 100);
  assert.equal(cost.payroll, 8 * cost.costPerEmployee);
});

test("divisor da hora: 44h → 220, 42h → 210, 40h → 200 (Súmula 431)", () => {
  const state = { ...createExampleState(), salary: 3000, phase: "42" };
  const cost = estimateCost(state, buildSchedule(state));
  assert.equal(cost.targetPhase, "42");
  assert.equal(cost.hoursLostPerMonth, 8 * 10);
  assert.ok(Math.abs(cost.hourlyIncreasePercent - (220 / 210 - 1) * 100) < 1e-9);
  assert.deepEqual(cost.hourlyCostByPhase.map((entry) => entry.phase), ["44", "42", "40"]);
});

test("na fase atual a comparação é feita com a meta de 40h", () => {
  const state = { ...createExampleState(), salary: 3000, phase: "44" };
  assert.equal(estimateCost(state, buildSchedule(state)).targetPhase, "40");
});
