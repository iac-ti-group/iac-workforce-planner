import { test } from "node:test";
import assert from "node:assert/strict";
import { SUNDAY } from "../../src/js/domain/calendar.js";
import { AlertCode, evaluateCompliance } from "../../src/js/domain/compliance.js";
import { MAX_CONSECUTIVE_WORKDAYS, maxConsecutiveSundaysForMen } from "../../src/js/domain/laborRules.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { workloadFor } from "../../src/js/domain/workload.js";
import { randomState, seededRandom } from "../helpers.js";

const SAMPLES = 300;

/** Estados variados (modelos de jornada, horário noturno, demanda e turnos editados), sem ajustes manuais. */
function forEachRandomSchedule(callback) {
  const random = seededRandom(42);
  for (let sample = 0; sample < SAMPLES; sample++) {
    const state = randomState(random, { manual: true });
    callback(state, buildSchedule(state));
  }
}

test("ajustes manuais sempre prevalecem nos dias abertos e são ignorados nos fechados", () => {
  const random = seededRandom(7);
  let checked = 0;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const state = randomState(random, { manual: true, overrides: true });
    const schedule = buildSchedule(state);
    for (const [key, value] of Object.entries(state.overrides)) {
      const [person, week, day] = key.split("-");
      const index = schedule.roster.findIndex((member, position) => (member.id || String(position)) === person);
      if (index < 0) continue; // pessoa/contratação inexistente: o ajuste fica sem efeito
      const expected = state.days[day].open ? value : false;
      assert.equal(schedule.weeks[week][index][day], expected, `amostra ${sample}, ajuste ${key}`);
      checked++;
    }
  }
  assert.ok(checked > 500, `poucos ajustes verificados: ${checked}`);
});

test("exemplo: supermercado em 42h é organizado em turnos e sugere contratações", () => {
  const state = createExampleState();
  const schedule = buildSchedule(state);
  assert.equal(schedule.weeks.length, 4);
  assert.equal(schedule.teamSize, 8);
  assert.ok(schedule.usesShifts);
  assert.equal(schedule.roster.length, schedule.teamSize + schedule.hires);
  assert.ok(schedule.roster.slice(schedule.teamSize).every((person) => person.isHire && person.sex === "N"));
});

test("jornadas por fase seguem a EC 141", () => {
  const state = createExampleState();
  assert.equal(workloadFor(state, "44", 6).weeklyHours, 44);
  assert.equal(workloadFor(state, "42", 7).dailyMinutes, 504);
  assert.equal(workloadFor(state, "40", 7).dailyMinutes, 480);
  assert.equal(workloadFor(state, "40", 7).minDaysOff, 2);
  assert.equal(workloadFor({ ...state, workModel: "6" }, "44", 6).label, "8h + sáb 4h");
});

test("sem ajustes manuais, ninguém trabalha 7 dias seguidos (inclusive na virada da semana)", () => {
  forEachRandomSchedule((_, schedule) => {
    schedule.roster.forEach((_, person) => {
      let run = 0;
      schedule.weeks.forEach((grid) =>
        grid[person].forEach((works) => {
          run = works ? run + 1 : 0;
          assert.ok(run <= MAX_CONSECUTIVE_WORKDAYS);
        }),
      );
    });
  });
});

test("sem ajustes manuais, o revezamento de domingos é respeitado", () => {
  forEachRandomSchedule((state, schedule) => {
    const maxForMen = maxConsecutiveSundaysForMen(state.activityType);
    schedule.roster.forEach((person, index) => {
      let streak = 0;
      schedule.weeks.forEach((grid) => {
        streak = grid[index][SUNDAY] ? streak + 1 : 0;
        assert.ok(streak <= (person.sex === "M" ? maxForMen : 1), `${person.sex} com ${streak} domingos seguidos`);
      });
    });
  });
});

test("cada pessoa tem ao menos as folgas mínimas da jornada", () => {
  forEachRandomSchedule((_, schedule) => {
    schedule.weeks.forEach((grid) =>
      grid.forEach((row) => assert.ok(row.filter((works) => !works).length >= schedule.workload.minDaysOff)),
    );
  });
});

test("ajuste manual prevalece e a verificação aponta a violação", () => {
  const state = createExampleState();
  state.phase = "40";
  const schedule = buildSchedule(state);
  // Força a primeira pessoa a trabalhar todos os dias da semana 1.
  for (let day = 0; day < 7; day++) state.overrides[`0-0-${day}`] = true;
  const adjusted = buildSchedule(state);
  assert.ok(adjusted.weeks[0][0].every(Boolean));
  assert.notDeepEqual(adjusted.weeks[0][0], schedule.weeks[0][0]);

  const report = evaluateCompliance(state, adjusted);
  const codes = report.alerts.filter((alert) => alert.personIndex === 0).map((alert) => alert.code);
  assert.ok(codes.includes(AlertCode.DAYS_OFF));
  assert.ok(codes.includes(AlertCode.CONSECUTIVE_DAYS));
  assert.ok(report.weeksWithIssues.has(0));
  assert.ok(!report.alerts.some((alert) => alert.code === AlertCode.COMPLIANT));
});

test("todo dia trabalhado tem horário de entrada e saída", () => {
  forEachRandomSchedule((_, schedule) => {
    schedule.weeks.forEach((grid, week) =>
      grid.forEach((row, person) =>
        row.forEach((works, day) => {
          if (!works) return;
          const assignment = schedule.assignmentsFor(week, day).get(person);
          assert.ok(assignment, `semana ${week} dia ${day} pessoa ${person}`);
          assert.ok(assignment.end > assignment.start);
        }),
      ),
    );
  });
});
