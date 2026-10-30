/**
 * Paridade com o app original (tests/legacy/original/app.js), executado numa VM isolada.
 * Compara motor, horários, verificações e o estado normalizado em estados aleatórios
 * com semente fixa e nas entradas do golden.
 *
 * Paridade prova que o comportamento foi preservado, não que as regras trabalhistas estão corretas.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { fromPersisted, toPersisted } from "../../src/js/infrastructure/stateRepository.js";
import { clone, randomPersistedState, seededRandom } from "../helpers.js";
import { encodeWeek, snapshotWorkload } from "../support/snapshot.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_FILE = join(HERE, "original", "app.js");
const LEGACY_SHA256 = "836137d5705f8850304afd5d40f2637f902160b9b7e3392e0916bbe81fa154e1";
const RANDOM_SAMPLES = 3000;
const SEED = 99;
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKS = [0, 1, 2, 3];

const legacySource = readFileSync(LEGACY_FILE, "utf8");

/** Carrega só as partes de cálculo do app.js original (sem DOM) e expõe build/check. */
function loadLegacyEngine() {
  const lines = legacySource.split("\n");
  // Linhas 2–58: constantes, utilitários, segmentos, exemplo, autoNeed. Linhas 151–308: motor e verificações.
  const code = [
    "let S;",
    ...lines.slice(1, 58),
    ...lines.slice(150, 308),
    "globalThis.__run = (state) => { S = state; const R = build(); const C = check(R); return { R, C, S }; };",
    "globalThis.__example = exemplo;",
  ].join("\n");
  const context = vm.createContext({ document: { getElementById: () => null } });
  vm.runInContext(code, context);
  return { run: context.__run, example: context.__example };
}

function legacyProjection({ R, C, S }) {
  const P = R.P;
  return {
    workload: {
      workDays: P.K, dailyMinutes: P.min, weeklyLimitHours: P.lim, minDaysOff: P.folgas, weeklyHours: P.week,
      label: P.txt ?? null, minutesByDay: DAYS.map(P.dm),
    },
    roster: R.team.map((p) => [p.n, p.s, p.novo, p.id ?? null]),
    weeks: R.weeks.map(encodeWeek),
    demand: R.need, requiredHeadcount: R.req, hires: R.hires, teamSize: R.N, usesShifts: R.multi, span: R.span,
    assignments: WEEKS.map((w) => DAYS.map((d) => {
      const shifts = R.shift(w, d);
      return R.team.map((_, i) => (shifts[i] ? [shifts[i][0], shifts[i][1], shifts[i][2], shifts[i][3], shifts[i][4] ?? null, shifts[i][5] ?? null] : null));
    })),
    shiftShortages: R.multi ? Object.entries(R.falta).map(([key, missing]) => [...key.split("-").map(Number), missing]) : [],
    alerts: C.al.map((a) => [a[0], a[1], a[2]]),
    cellErrors: [...C.cellErr].sort(),
    weeksWithIssues: [...C.wkBad].sort(),
    normalized: { days: S.days, tt: S.tt ? S.tt.map((t) => [t.ini, t.auto !== false]) : null, tn: S.tn ?? null },
  };
}

function currentProjection(input) {
  const state = fromPersisted(clone(input));
  const R = buildSchedule(state);
  const C = evaluateCompliance(state, R);
  const persisted = toPersisted(state);
  return {
    workload: snapshotWorkload(R.workload),
    roster: R.roster.map((p) => [p.name, p.sex, p.isHire, p.id ?? null]),
    weeks: R.weeks.map(encodeWeek),
    demand: R.demand, requiredHeadcount: R.requiredHeadcount, hires: R.hires, teamSize: R.teamSize,
    usesShifts: R.usesShifts, span: R.span,
    assignments: WEEKS.map((w) => DAYS.map((d) => {
      const shifts = R.assignmentsFor(w, d);
      return R.roster.map((_, i) => {
        const a = shifts.get(i);
        return a ? [a.start, a.end, a.lunchStart, a.breakMinutes, a.shiftIndex ?? null, a.shiftName ?? null] : null;
      });
    })),
    shiftShortages: R.shiftShortages.map(({ week, day, shift, missing }) => [week, day, shift, missing]),
    alerts: C.alerts.map((a) => [a.level, a.title, a.detail]),
    cellErrors: [...C.cellErrors].sort(),
    weeksWithIssues: [...C.weeksWithIssues].sort(),
    normalized: {
      days: persisted.days,
      tt: persisted.tt ? persisted.tt.map((t) => [t.ini, t.auto]) : null,
      tn: persisted.tn ?? null,
    },
  };
}

/** Primeira divergência, com o nome do campo, para diagnóstico rápido. */
function firstDifference(expected, actual) {
  for (const key of Object.keys(expected)) {
    const a = JSON.stringify(expected[key]);
    const b = JSON.stringify(actual[key]);
    if (a !== b) return `${key}\n  legado: ${a.slice(0, 300)}\n  atual:  ${b.slice(0, 300)}`;
  }
  return null;
}

test("o app.js legado está íntegro (SHA-256)", () => {
  assert.equal(createHash("sha256").update(readFileSync(LEGACY_FILE)).digest("hex"), LEGACY_SHA256);
});

const legacy = loadLegacyEngine();

test("estado de exemplo idêntico ao original", () => {
  const original = clone(legacy.example());
  const current = toPersisted(createExampleState());
  assert.deepStrictEqual(current.days, original.days);
  assert.deepStrictEqual(current.team, original.team);
});

test(`paridade em ${RANDOM_SAMPLES} estados aleatórios (semente ${SEED})`, () => {
  const random = seededRandom(SEED);
  const failures = [];
  const coverage = { shifts: 0, hires: 0, violations: 0, overrides: 0 };
  for (let sample = 0; sample < RANDOM_SAMPLES; sample++) {
    const input = randomPersistedState(random);
    const expected = legacyProjection(legacy.run(clone(input)));
    const actual = currentProjection(input);
    const difference = firstDifference(expected, actual);
    if (difference) failures.push(`amostra ${sample}: ${difference}`);
    if (actual.usesShifts) coverage.shifts++;
    if (actual.hires) coverage.hires++;
    if (actual.alerts.some(([level]) => level === "bad")) coverage.violations++;
    if (Object.keys(input.ov).length) coverage.overrides++;
  }
  assert.deepStrictEqual(failures.slice(0, 3), [], `${failures.length} divergências`);
  // Garante que a amostra realmente exercita os caminhos importantes.
  for (const [path, count] of Object.entries(coverage)) assert.ok(count >= RANDOM_SAMPLES * 0.1, `cobertura baixa: ${path} = ${count}`);
});

test("as entradas do golden têm o mesmo resultado no app original", () => {
  const fixtures = join(HERE, "..", "fixtures", "golden");
  const failures = [];
  for (const file of readdirSync(fixtures).filter((name) => name.endsWith(".json"))) {
    const { input } = JSON.parse(readFileSync(join(fixtures, file), "utf8"));
    const difference = firstDifference(legacyProjection(legacy.run(clone(input))), currentProjection(input));
    if (difference) failures.push(`${file}: ${difference}`);
  }
  assert.deepStrictEqual(failures, []);
});
