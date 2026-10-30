/**
 * Benchmark do motor nos piores casos permitidos pelos limites (E2).
 * Objetivo de referência: montar escala + verificações em < 200 ms no pior caso.
 * É uma MEDIÇÃO documentada, não um critério de aprovação dos testes (tempo varia com a máquina).
 *
 *   npm run bench
 */

import os from "node:os";
import { performance } from "node:perf_hooks";
import { evaluateCompliance } from "../src/js/domain/compliance.js";
import { MAX_DAILY_DEMAND, MAX_PEOPLE } from "../src/js/domain/limits.js";
import { buildSchedule } from "../src/js/domain/scheduler.js";
import { createExampleState } from "../src/js/domain/simulationState.js";

const RUNS = 30;
const TARGET_MS = 200;
const teamOf = (size) => Array.from({ length: size }, (_, i) => ({ name: "P" + i, sex: i % 2 ? "M" : "F" }));

const scenarios = {
  "equipe de 200, 7 dias com turnos (sugestão automática)": () => ({ ...createExampleState(), team: teamOf(MAX_PEOPLE), phase: "40" }),
  "equipe de 10, demanda 200/dia, contratações até o limite": () => {
    const state = { ...createExampleState(), team: teamOf(10), phase: "40", autoDemand: false };
    state.days.forEach((day) => (day.need = MAX_DAILY_DEMAND));
    return state;
  },
  "equipe de 200 com ajustes manuais em todas as semanas": () => {
    const state = { ...createExampleState(), team: teamOf(MAX_PEOPLE), phase: "42" };
    for (let p = 0; p < MAX_PEOPLE; p += 3) for (let w = 0; w < 4; w++) state.overrides[`${p}-${w}-${(p + w) % 7}`] = p % 2 === 0;
    return state;
  },
};

const percentile = (values, p) => values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))];

console.log("Ambiente:", `Node ${process.version}`, `${os.type()} ${os.release()}`, `${os.cpus()[0].model} (${os.cpus().length} núcleos)`, `${Math.round(os.totalmem() / 2 ** 30)} GB RAM`);
console.log(`Método: ${RUNS} execuções por cenário após 3 de aquecimento; tempo de buildSchedule + evaluateCompliance.\n`);

let worstP95 = 0;
for (const [name, make] of Object.entries(scenarios)) {
  for (let i = 0; i < 3; i++) {
    const state = make();
    evaluateCompliance(state, buildSchedule(state));
  }
  const times = [];
  let roster = 0;
  for (let i = 0; i < RUNS; i++) {
    const state = make();
    const start = performance.now();
    const schedule = buildSchedule(state);
    evaluateCompliance(state, schedule);
    times.push(performance.now() - start);
    roster = schedule.roster.length;
  }
  const p95 = percentile(times, 95);
  worstP95 = Math.max(worstP95, p95);
  console.log(`${name}\n  pessoas na escala: ${roster} | mediana ${percentile(times, 50).toFixed(1)} ms | p95 ${p95.toFixed(1)} ms | máx ${Math.max(...times).toFixed(1)} ms`);
}
console.log(`\nPior p95: ${worstP95.toFixed(1)} ms — objetivo < ${TARGET_MS} ms: ${worstP95 < TARGET_MS ? "atingido" : "NÃO atingido"}`);
