import { test } from "node:test";
import assert from "node:assert/strict";
import { businessHours, formatClock, formatDuration, isClock, toMinutes } from "../../src/js/domain/time.js";

test("converte horário em minutos e de volta", () => {
  assert.equal(toMinutes("08:30"), 510);
  assert.equal(formatClock(510), "08:30");
  assert.equal(formatClock(1440 + 75), "01:15");
  assert.equal(formatClock(-30), "23:30");
});

test("formata duração em horas", () => {
  assert.equal(formatDuration(8), "8h");
  assert.equal(formatDuration(8.4), "8h24");
  assert.equal(formatDuration(0.5), "0h30");
});

test("expediente que fecha depois da meia-noite vira o dia seguinte", () => {
  assert.deepEqual(businessHours({ opensAt: "17:00", closesAt: "01:00" }), { opensAt: 1020, closesAt: 1500 });
  assert.deepEqual(businessHours({ opensAt: "08:00", closesAt: "18:00" }), { opensAt: 480, closesAt: 1080 });
});

test("valida horários HH:MM", () => {
  assert.ok(isClock("23:59"));
  assert.ok(!isClock("24:00"));
  assert.ok(!isClock("8:00"));
  assert.ok(!isClock("<script>"));
});
