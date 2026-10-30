import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDayOffChange } from "../../src/js/application/changeFeedback.js";
import { weekSummaryText } from "../../src/js/application/weekSummary.js";
import { AlertLevel, evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";

/** Exemplo em 40h com ajustes manuais opcionais, já com escala e verificações. */
function scenario(overrides = {}, week = 0) {
  const state = createExampleState();
  state.phase = "40";
  state.week = week;
  Object.assign(state.overrides, overrides);
  const schedule = buildSchedule(state);
  const compliance = evaluateCompliance(state, schedule);
  const describe = (change) => describeDayOffChange(state, schedule, compliance, change);
  const hasViolation = (personIndex) =>
    compliance.alerts.some((alert) => alert.level === AlertLevel.VIOLATION && alert.personIndex === personIndex);
  return { state, schedule, describe, hasViolation };
}

test("violação de domingo tem prioridade e orienta a devolver a folga", () => {
  const { describe } = scenario({ "0-0-6": true, "0-1-6": true }, 1);
  const feedback = describe({ personIndex: 0, day: 6, worksNow: true });
  assert.equal(feedback.level, "bad");
  assert.equal(feedback.title, "Regra do domingo: dois domingos seguidos");
  assert.equal(
    feedback.text,
    "Mulheres folgam em domingos alternados (semana 2). Devolva a folga para o domingo ou troque com outra pessoa.",
  );
});

test("outra violação: mostra a primeira violação da pessoa", () => {
  const sevenDays = { "2-0-3": true, "2-0-4": true, "2-0-5": true, "2-0-6": true, "2-1-0": true, "2-1-1": true, "2-1-2": true };
  const { describe } = scenario(sevenDays);
  const feedback = describe({ personIndex: 2, day: 3, worksNow: true });
  assert.deepStrictEqual(feedback, {
    level: "bad",
    title: "Carla: só 1 folga na semana 1",
    text: "O mínimo nesta jornada é 2 folgas por semana.",
  });
});

/** Primeira semana em que alguém do sexo informado trabalha no domingo sem ter violações. */
function sundayWorker(sex) {
  for (let week = 0; week < 4; week++) {
    const context = scenario({}, week);
    const { schedule, hasViolation } = context;
    const person = schedule.roster.findIndex(
      (candidate, index) => candidate.sex === sex && schedule.weeks[week][index][6] && !hasViolation(index),
    );
    if (person >= 0) return { ...context, person, week };
  }
  throw new Error(`nenhuma pessoa do sexo ${sex} trabalha no domingo sem violações`);
}

test("sem violação, mas a mulher passa a trabalhar no domingo: lembra o revezamento alternado", () => {
  const { schedule, describe, person, week } = sundayWorker("F");
  assert.deepStrictEqual(describe({ personIndex: person, day: 6, worksNow: true }), {
    level: "warn",
    title: `${schedule.roster[person].name} vai trabalhar no domingo da semana ${week + 1}`,
    text: "Mulheres folgam em domingos alternados: no domingo seguinte esta pessoa precisa folgar. O simulador confere as 4 semanas e avisa se a regra quebrar.",
  });
});

test("sem violação, homem no comércio perde a folga do domingo: lembra a regra de 1 a cada 3", () => {
  const { describe, person } = sundayWorker("M");
  const feedback = describe({ personIndex: person, day: 2, worksNow: false, fromDay: 6 });
  assert.equal(feedback.level, "warn");
  assert.equal(
    feedback.text,
    "Homens no comércio precisam folgar ao menos 1 domingo a cada 3 semanas. O simulador confere as 4 semanas e avisa se a regra quebrar.",
  );
});

test("sem violação e sem domingo envolvido: confirma o ajuste com a origem e o destino", () => {
  const { schedule, describe, hasViolation } = scenario();
  const person = schedule.roster.findIndex((_, index) => !hasViolation(index));
  assert.ok(person >= 0);
  const name = schedule.roster[person].name;
  assert.deepStrictEqual(describe({ personIndex: person, day: 2, worksNow: false, fromDay: 1 }), {
    level: "ok",
    title: "Folga ajustada de Ter para Qua",
    text: `${name} continua dentro das regras nesta escala.`,
  });
  assert.equal(describe({ personIndex: person, day: 2, worksNow: false }).title, "Folga ajustada");
});

test("domingo fechado: não há aviso de domingo", () => {
  const state = createExampleState();
  state.phase = "40";
  state.days[6].open = false;
  const schedule = buildSchedule(state);
  const feedback = describeDayOffChange(state, schedule, evaluateCompliance(state, schedule), { personIndex: 0, day: 6, worksNow: true });
  assert.notEqual(feedback.level, "warn");
});

test("texto da semana lista cada dia aberto, horários, almoço e folgas", () => {
  const state = createExampleState();
  const schedule = buildSchedule(state);
  const text = weekSummaryText(state, schedule);
  const lines = text.split("\n");
  assert.equal(lines[0], "*Escala 42h · 5x2 · Semana 1*");
  assert.deepStrictEqual(lines.filter((line) => /^\*\w+\*$/u.test(line) || /^\*S[áa]b\*$/.test(line)).length, 7);
  assert.match(text, /^Ana: \d\d:\d\d às \d\d:\d\d( \(almoço \d\d:\d\d\))?$/m);
  assert.match(text, /^Folga: /m);
});

test("texto da semana omite dias fechados e usa o rótulo da fase atual", () => {
  const state = createExampleState();
  state.phase = "44";
  state.days[6].open = false;
  const text = weekSummaryText(state, buildSchedule(state));
  assert.match(text, /^\*Escala 44h \(hoje\) · Semana 1\*/);
  assert.doesNotMatch(text, /\*Dom\*/);
});
