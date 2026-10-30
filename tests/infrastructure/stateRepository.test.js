import { test } from "node:test";
import assert from "node:assert/strict";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import {
  BACKUP_KEY_PREFIX,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createLocalStorageRepository,
  decodeStoredState,
  fromPersisted,
  readPersisted,
  toPersisted,
} from "../../src/js/infrastructure/stateRepository.js";
import { clone } from "../helpers.js";

/** localStorage em memória; `failOn(key)` faz a gravação daquela chave falhar. */
export function memoryStorage(initial = {}, failOn = () => false) {
  const data = { ...initial };
  return new Proxy(data, {
    get(target, prop) {
      if (prop === "getItem") return (key) => (key in target ? target[key] : null);
      if (prop === "setItem") return (key, value) => {
        if (failOn(key)) throw new Error("QuotaExceededError");
        target[key] = String(value);
      };
      if (prop === "removeItem") return (key) => delete target[key];
      return target[prop];
    },
  });
}

test("ida e volta preserva o estado", () => {
  const state = createExampleState();
  assert.deepEqual(fromPersisted(clone(toPersisted(state))), state);
});

test("lê o formato gravado pela versão anterior (chaves curtas)", () => {
  const legacy = {
    seg: 20, tipo: "comercio", team: [{ n: "Ana", s: "F" }], needAuto: true, fase: "42", contratar: true,
    sal: 2150, enc: 75, ben: 0, ov: { "0-0-1": true }, wk: 2, names: {},
    days: Array.from({ length: 7 }, () => ({ on: true, a: "07:00", f: "22:00", need: 1 })),
  };
  const { state, issues } = readPersisted(legacy);
  assert.deepEqual(issues, []);
  assert.equal(state.segmentIndex, 20);
  assert.equal(state.team[0].name, "Ana");
  assert.equal(state.days[0].opensAt, "07:00");
  assert.equal(state.autoShifts, true);
  assert.equal(state.lunchMinutes, 60);
  assert.equal(state.week, 2);
  assert.deepEqual(state.overrides, { "0-0-1": true });
});

test("estrutura inválida é rejeitada com o motivo", () => {
  assert.equal(fromPersisted(null), null);
  assert.equal(fromPersisted({ team: [], days: [] }), null);
  assert.equal(fromPersisted({ team: "x", days: new Array(7).fill({}) }), null);
  assert.match(readPersisted(null).issues[0], /estrutura/);
});

test("equipe acima de 200 pessoas torna os dados inutilizáveis (não corta pessoas)", () => {
  const raw = toPersisted(createExampleState());
  raw.team = Array.from({ length: 201 }, (_, i) => ({ n: "P" + i, s: "F" }));
  const { state, issues } = readPersisted(raw);
  assert.equal(state, null);
  assert.match(issues[0], /201 pessoas; o simulador comporta até 200/);
});

test("valores adulterados são corrigidos E relatados (nunca em silêncio)", () => {
  const { state, issues } = readPersisted({
    seg: 999, tipo: "x", fase: "99", wk: 10, alm: -5, modelo: "__proto__",
    team: [{ n: "x".repeat(500), s: "Z" }, "lixo"],
    days: Array.from({ length: 7 }, () => ({ on: 1, a: '"><img src=x onerror=alert(1)>', f: "25:00", need: -3 })),
    ov: { a: true, b: "sim", "0-0-1": false }, names: { novo1: 42 }, tn: [[1, 2]], tt: [{ ini: "x" }],
  });
  assert.equal(state.segmentIndex, -1);
  assert.equal(state.activityType, "outros");
  assert.equal(state.phase, "42");
  assert.equal(state.week, 0);
  assert.equal(state.lunchMinutes, 60);
  assert.equal(state.workModel, null);
  assert.equal(state.team.length, 1);
  assert.equal(state.team[0].name.length, 80);
  assert.equal(state.team[0].sex, "F");
  assert.equal(state.days[0].opensAt, "08:00");
  assert.equal(state.days[0].closesAt, "18:00");
  assert.equal(state.days[0].need, 0);
  // Chaves de ajuste fora do formato `${pessoa}-${semana}-${dia}` são descartadas (limite de overrides da E2).
  assert.deepEqual(state.overrides, { "0-0-1": false });
  assert.deepEqual(state.hireNames, {});
  assert.equal(state.shiftHeadcount, null);
  assert.equal(state.shiftStarts, null);

  const expectedTopics = [/Ramo/, /Tipo de atividade/, /Jornada/, /Semana exibida/, /almoço/, /Exemplo de jornada/,
    /registro\(s\) inválido/, /mais de 80 caracteres/, /Sexo inválido/, /Seg: horário de abertura/, /Seg: horário de fechamento/,
    /Seg: quantidade de pessoas/, /2 ajuste\(s\) manual/, /nome de contratação/, /quadro de turnos/, /horários de turno/i];
  for (const topic of expectedTopics) assert.ok(issues.some((issue) => topic.test(issue)), `sem aviso para ${topic}`);
  assert.ok(issues.every((issue) => !issue.includes("<img")), "o aviso não repete o conteúdo adulterado");
});

test("demanda acima de 200 é ajustada para 200 e relatada", () => {
  const raw = toPersisted(createExampleState());
  raw.days[0].need = 20000;
  const { state, issues } = readPersisted(raw);
  assert.equal(state.days[0].need, 200);
  assert.deepEqual(issues, ["Seg: 20000 pessoas por dia foram ajustadas para o máximo de 200."]);
});

test("quadro de turnos com mais de 200 pessoas num dia é recalculado (modo automático)", () => {
  const raw = { ...toPersisted(createExampleState()), tnAuto: false, tn: [[150, 60, 0], [1, 1, 0], [1, 0, 0]] };
  const { state, issues } = readPersisted(raw);
  assert.equal(state.shiftHeadcount, null);
  assert.equal(state.autoShifts, true);
  assert.match(issues[0], /passava de 200 pessoas por dia/);
});

test("almoço fora das opções do seletor volta para 1h com aviso", () => {
  const { state, issues } = readPersisted({ ...toPersisted(createExampleState()), alm: 37 });
  assert.equal(state.lunchMinutes, 60);
  assert.deepEqual(issues, ["Duração do almoço fora das opções; usada 1h."]);
});

test("JSON corrompido é inutilizável", () => {
  const { state, issues } = decodeStoredState("{não é json");
  assert.equal(state, null);
  assert.match(issues[0], /corrompidos/);
});

test("o repositório lê a v4; sem v4, lê a v3; e nunca grava na v3", () => {
  const v3 = JSON.stringify(toPersisted(createExampleState()));
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: v3 });
  const repository = createLocalStorageRepository(storage);
  assert.deepEqual(repository.loadRecord(), { source: "v3", text: v3 });

  assert.equal(repository.save(createExampleState()), true);
  assert.equal(storage[LEGACY_STORAGE_KEY], v3, "v3 intacta");
  const saved = JSON.parse(storage[STORAGE_KEY]);
  assert.equal(saved.schemaVersion, 4);
  assert.equal(repository.loadRecord().source, "v4");
});

test("falha de gravação não lança exceção e é informada", () => {
  const repository = createLocalStorageRepository(memoryStorage({}, () => true));
  assert.equal(repository.save(createExampleState()), false);
  assert.equal(repository.backup("x"), false);
});

test("backup guarda o texto original e mantém só as 5 cópias mais recentes", () => {
  let second = 0;
  const storage = memoryStorage();
  const repository = createLocalStorageRepository(storage, () => new Date(Date.UTC(2026, 9, 30, 12, 0, second++)));
  for (let i = 0; i < 7; i++) assert.equal(repository.backup(`dados ${i}`), true);
  const keys = repository.listBackups();
  assert.equal(keys.length, 5);
  assert.ok(keys.every((key) => key.startsWith(BACKUP_KEY_PREFIX)));
  assert.deepEqual(keys.map((key) => storage[key]), ["dados 2", "dados 3", "dados 4", "dados 5", "dados 6"]);
});
