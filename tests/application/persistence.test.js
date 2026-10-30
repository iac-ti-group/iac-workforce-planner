/** Política de persistência: modo seguro, backup antes de gravar e somente leitura se o backup falhar. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { LoadStatus } from "../../src/js/application/persistence.js";
import { createSimulator } from "../../src/js/application/simulator.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import {
  BACKUP_KEY_PREFIX,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createLocalStorageRepository,
  toPersisted,
} from "../../src/js/infrastructure/stateRepository.js";
import { memoryStorage } from "../infrastructure/stateRepository.test.js";

const validText = () => JSON.stringify({ schemaVersion: 4, ...toPersisted(createExampleState()) });
const backups = (storage) => Object.keys(storage).filter((key) => key.startsWith(BACKUP_KEY_PREFIX));
const simulatorOn = (storage) => createSimulator(createLocalStorageRepository(storage));

test("primeira visita: exemplo, gravável", () => {
  const { session } = simulatorOn(memoryStorage());
  assert.equal(session.status, LoadStatus.EMPTY);
  assert.equal(session.writable, true);
});

test("dados v4 válidos: abre como estão, sem backup", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: validText() });
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.OK);
  assert.equal(simulator.state.team.length, 8);
  assert.equal(backups(storage).length, 0);
});

test("dados v3: migrados para a v4 ao salvar; a v3 nunca é alterada", () => {
  const v3 = JSON.stringify(toPersisted(createExampleState()));
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: v3 });
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.MIGRATED);
  simulator.recalculate();
  assert.equal(simulator.save(), true);
  assert.equal(storage[LEGACY_STORAGE_KEY], v3);
  assert.ok(storage[STORAGE_KEY]);
});

test("dados inválidos: exemplo em modo seguro, nada é gravado e o original continua intacto", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{corrompido" });
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.INVALID);
  assert.equal(simulator.session.writable, false);
  assert.equal(simulator.session.originalText, "{corrompido");
  simulator.recalculate();
  assert.equal(simulator.save(), false);
  assert.equal(storage[STORAGE_KEY], "{corrompido");
});

test("modo seguro → começar com o exemplo: faz backup do original e só então grava", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{corrompido" });
  const simulator = simulatorOn(storage);
  const result = simulator.session.restoreExample();
  assert.equal(result.ok, true);
  assert.deepEqual(backups(storage).map((key) => storage[key]), ["{corrompido"]);
  assert.equal(JSON.parse(storage[STORAGE_KEY]).team.length, 8);
  assert.equal(simulator.session.writable, true);
});

test("modo seguro → se o backup falhar, nada é sobrescrito", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{corrompido" }, (key) => key.startsWith(BACKUP_KEY_PREFIX));
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.restoreExample().ok, false);
  assert.equal(storage[STORAGE_KEY], "{corrompido");
  assert.equal(simulator.session.writable, false);
});

test("dados v4 com valores fora do limite: backup do original ANTES de gravar a versão corrigida", () => {
  const raw = { schemaVersion: 4, ...toPersisted(createExampleState()), needAuto: false };
  raw.days[0].need = 20000;
  const original = JSON.stringify(raw);
  const storage = memoryStorage({ [STORAGE_KEY]: original });
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.REPAIRED);
  assert.deepEqual(backups(storage).map((key) => storage[key]), [original]);
  assert.equal(simulator.session.writable, true);
  simulator.recalculate();
  assert.equal(simulator.save(), true);
  assert.equal(JSON.parse(storage[STORAGE_KEY]).days[0].need, 200);
});

test("dados com correção e backup impossível: somente leitura, original preservado", () => {
  const raw = { schemaVersion: 4, ...toPersisted(createExampleState()), alm: 37 };
  const original = JSON.stringify(raw);
  const storage = memoryStorage({ [STORAGE_KEY]: original }, (key) => key.startsWith(BACKUP_KEY_PREFIX));
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.REPAIRED);
  assert.equal(simulator.session.writable, false);
  simulator.recalculate();
  assert.equal(simulator.save(), false);
  assert.equal(storage[STORAGE_KEY], original);
});

test("dados v3 com correção não precisam de backup: a própria v3 é preservada", () => {
  const raw = { ...toPersisted(createExampleState()), alm: 37 };
  const v3 = JSON.stringify(raw);
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: v3 }, (key) => key.startsWith(BACKUP_KEY_PREFIX));
  const simulator = simulatorOn(storage);
  assert.equal(simulator.session.status, LoadStatus.REPAIRED);
  assert.equal(simulator.session.writable, true);
  simulator.recalculate();
  assert.equal(simulator.save(), true);
  assert.equal(storage[LEGACY_STORAGE_KEY], v3);
});

test("apagar dados salvos: backup do atual, exemplo gravado, v3 preservada", () => {
  const state = createExampleState();
  state.phase = "40";
  const current = JSON.stringify({ schemaVersion: 4, ...toPersisted(state) });
  const storage = memoryStorage({ [STORAGE_KEY]: current, [LEGACY_STORAGE_KEY]: "v3 antiga" });
  const simulator = simulatorOn(storage);
  const result = simulator.session.clearSavedData();
  assert.equal(result.ok, true);
  assert.deepEqual(backups(storage).map((key) => storage[key]), [current]);
  assert.equal(JSON.parse(storage[STORAGE_KEY]).fase, "42");
  assert.equal(storage[LEGACY_STORAGE_KEY], "v3 antiga");
});

test("apagar dados salvos sem conseguir fazer backup: nada muda", () => {
  const current = validText();
  const storage = memoryStorage({ [STORAGE_KEY]: current }, (key) => key.startsWith(BACKUP_KEY_PREFIX));
  assert.equal(simulatorOn(storage).session.clearSavedData().ok, false);
  assert.equal(storage[STORAGE_KEY], current);
});

test("transação com erro: estado anterior volta e nada é gravado", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: validText() });
  const simulator = simulatorOn(storage);
  simulator.recalculate();
  const before = storage[STORAGE_KEY];
  let renders = 0;
  const result = simulator.transact(
    () => simulator.apply((state) => void (state.phase = "40")),
    () => {
      renders++;
      if (renders === 1) throw new Error("falha simulada na tela");
    },
  );
  assert.equal(result.ok, false);
  assert.equal(simulator.state.phase, "42");
  assert.equal(simulator.schedule.workload.weeklyLimitHours, 42);
  assert.equal(storage[STORAGE_KEY], before);
  assert.equal(renders, 2, "a tela é redesenhada com o estado anterior");
});

test("transação bem-sucedida grava", () => {
  const storage = memoryStorage();
  const simulator = simulatorOn(storage);
  const result = simulator.transact(() => simulator.apply((state) => void (state.phase = "40")), () => {});
  assert.deepEqual(result, { ok: true, saved: true });
  assert.equal(JSON.parse(storage[STORAGE_KEY]).fase, "40");
});
