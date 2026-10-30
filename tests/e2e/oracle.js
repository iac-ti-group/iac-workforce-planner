/**
 * Oráculo dos testes de navegador: calcula no Node, com o próprio domínio, o que a tela deveria mostrar.
 * Assim os testes verificam valores (horários, pessoas, alertas) em vez de comparar HTML.
 */

import { evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";

/** Exemplo inicial (com alterações opcionais) já calculado. */
export function expectedExample(changes = {}) {
  const state = { ...createExampleState(), ...changes };
  const schedule = buildSchedule(state);
  return { state, schedule, compliance: evaluateCompliance(state, schedule) };
}

export const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Primeiro par (folga, trabalho) de seg a sáb para a pessoa na semana. */
export function dayOffAndWorkday(schedule, week, person) {
  const row = schedule.weeks[week][person];
  const off = row.findIndex((works, day) => !works && day < 6);
  const work = row.findIndex((works, day) => works && day < 6);
  return { off, work };
}
