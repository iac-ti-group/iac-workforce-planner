/** Caracterização de suggestShifts e applyShiftPlan (comportamento atual). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyShiftPlan, suggestShifts } from "../../src/js/domain/shiftPlan.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { workloadFor } from "../../src/js/domain/workload.js";
import { clone } from "../helpers.js";

/** Exemplo (supermercado, todos os dias abertos) em 42h: 8h24 de trabalho + 1h de almoço = 564 min. */
function example() {
  const state = createExampleState();
  return { state, workload: workloadFor(state, "42", 7) };
}

const setHours = (state, opensAt, closesAt) => state.days.forEach((day) => Object.assign(day, { opensAt, closesAt }));

test("expediente até jornada + 1h: 1 turno", () => {
  const { state, workload } = example();
  setHours(state, "08:00", "18:00"); // 600 min ≤ 564 + 60
  assert.deepStrictEqual(suggestShifts(state, workload), { count: 1, starts: [480, 516, 516] });
});

test("expediente até 2 jornadas: 2 turnos (abertura e fechamento; o 3º fica no meio)", () => {
  const { state, workload } = example(); // seg 07:00–22:00 = 900 min
  // último início = 22:00 − 564 = 12:36 (756); meio = round((420 + 756) / 2, dezena) = 590
  assert.deepStrictEqual(suggestShifts(state, workload), { count: 2, starts: [420, 756, 590] });
});

test("expediente maior que 2 jornadas, atravessando a meia-noite: 3 turnos", () => {
  const { state, workload } = example();
  setHours(state, "05:00", "01:00"); // 300 → 1500 = 1200 min
  assert.deepStrictEqual(suggestShifts(state, workload), { count: 3, starts: [300, 620, 936] });
});

test("dia específico: usa o horário daquele dia", () => {
  const { state, workload } = example(); // domingo 08:00–14:00 = 360 min
  assert.deepStrictEqual(suggestShifts(state, workload, 6), { count: 1, starts: [480, 480, 480] });
});

test("nenhum dia aberto: sugestão padrão", () => {
  const { state, workload } = example();
  state.days.forEach((day) => (day.open = false));
  assert.deepStrictEqual(suggestShifts(state, workload), { count: 1, starts: [480, 720, 960] });
});

test("todos os dias abertos e expediente longo: organiza em turnos e sincroniza a demanda com os turnos", () => {
  const { state, workload } = example();
  assert.equal(applyShiftPlan(state, workload), true);
  assert.deepStrictEqual(state.shiftStarts, [
    { start: "07:00", auto: true },
    { start: "12:36", auto: true },
    { start: "09:50", auto: true },
  ]);
  // Demanda sugerida [8,8,8,7,7,7,3]; seg–sex usa a de segunda (8) em 2 turnos, sáb 7 em 2, dom 3 em 1 turno.
  assert.deepStrictEqual(state.shiftHeadcount, [[4, 4, 0], [4, 3, 0], [3, 0, 0]]);
  // Qui e sex sobem de 7 para 8 porque o grupo seg–sex compartilha o quadro de turnos.
  assert.deepStrictEqual(state.days.map((day) => day.need), [8, 8, 8, 8, 8, 7, 3]);
});

test("algum dia fechado: não usa turnos, recalcula a demanda e não cria turnos", () => {
  const { state, workload } = example();
  state.days[6].open = false;
  assert.equal(applyShiftPlan(state, workload), false);
  assert.equal(state.shiftStarts, null);
  assert.equal(state.shiftHeadcount, null);
  assert.deepStrictEqual(state.days.map((day) => day.need), [8, 8, 8, 8, 8, 8, 0]);
});

test("expediente curto mesmo com 7 dias abertos: não usa turnos", () => {
  const { state, workload } = example();
  setHours(state, "08:00", "18:00");
  assert.equal(applyShiftPlan(state, workload), false);
});

test("modo manual: preserva o quadro de turnos e a demanda passa a ser o total de cada grupo", () => {
  const { state, workload } = example();
  state.autoShifts = false;
  state.autoDemand = false;
  state.shiftHeadcount = [[2, 1, 1], [1, 1, 0], [0, 2, 0]];
  applyShiftPlan(state, workload);
  assert.deepStrictEqual(state.shiftHeadcount, [[2, 1, 1], [1, 1, 0], [0, 2, 0]]);
  assert.deepStrictEqual(state.days.map((day) => day.need), [4, 4, 4, 4, 4, 2, 2]);
});

test("horário de turno editado (auto = false) é preservado; os automáticos são recalculados", () => {
  const { state, workload } = example();
  state.shiftStarts = [{ start: "06:00", auto: false }, { start: "23:00", auto: true }, { start: "23:00", auto: true }];
  applyShiftPlan(state, workload);
  assert.deepStrictEqual(state.shiftStarts.map((shift) => shift.start), ["06:00", "12:36", "09:50"]);
});

test("quadro de turnos com formato inválido é recriado", () => {
  const { state, workload } = example();
  state.autoShifts = false;
  state.shiftHeadcount = [[1, 2]];
  applyShiftPlan(state, workload);
  assert.equal(state.shiftHeadcount.length, 3);
  assert.ok(state.shiftHeadcount.every((row) => row.length === 3));
});

test("aplicar duas vezes dá o mesmo resultado (idempotente)", () => {
  for (const configure of [
    () => {},
    (state) => Object.assign(state, { autoDemand: false }),
    (state) => Object.assign(state, { autoShifts: false, shiftHeadcount: [[3, 3, 1], [2, 2, 0], [1, 1, 0]] }),
  ]) {
    const { state, workload } = example();
    configure(state);
    applyShiftPlan(state, workload);
    const once = clone(state);
    applyShiftPlan(state, workload);
    assert.deepStrictEqual(clone(state), once);
  }
});

test("applyShiftPlan muta o estado recebido (comportamento atual; a E3 separa a normalização)", () => {
  const { state, workload } = example();
  const before = clone(state);
  applyShiftPlan(state, workload);
  assert.notDeepStrictEqual(clone(state), before);
});
