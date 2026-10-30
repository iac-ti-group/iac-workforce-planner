/**
 * Persistência do estado no localStorage do navegador.
 *
 * - Grava em `iac-escala5x2-v4` ({ schemaVersion: 4, ...campos }).
 * - Lê a chave da versão anterior (`iac-escala5x2-v3`) só se a v4 não existir; a v3 nunca é alterada.
 * - Cópias de segurança ficam em `iac-escala5x2-backup-<data>` (as 5 mais recentes).
 *
 * O formato dos campos (chaves curtas) é o mesmo da versão anterior. Este módulo valida e traduz
 * esse formato; toda correção aplicada é relatada em `issues` (nunca silenciosa).
 */

import { DAY_NAMES, DAYS_PER_WEEK, SIMULATED_WEEKS } from "../domain/calendar.js";
import { ActivityType, DEFAULT_LUNCH_MINUTES, DEFAULT_LUNCH_START, PHASES, Phase, Sex } from "../domain/laborRules.js";
import { MAX_DAILY_DEMAND, MAX_NAME_LENGTH, MAX_PEOPLE, isLunchOption, maxOverrides } from "../domain/limits.js";
import { CUSTOM_SEGMENT, SEGMENTS } from "../domain/segments.js";
import { SHIFT_COUNT } from "../domain/shiftPlan.js";
import { isClock } from "../domain/time.js";
import { isWorkModel } from "../domain/workModels.js";
import { sum } from "../shared/collections.js";

export const STORAGE_KEY = "iac-escala5x2-v4";
export const LEGACY_STORAGE_KEY = "iac-escala5x2-v3";
export const BACKUP_KEY_PREFIX = "iac-escala5x2-backup-";
export const SCHEMA_VERSION = 4;
const MAX_BACKUPS = 5;

const OVERRIDE_KEY = new RegExp(`^(\\d{1,3}|novo\\d{1,3})-[0-${SIMULATED_WEEKS - 1}]-[0-${DAYS_PER_WEEK - 1}]$`);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isAbsent = (value) => value === undefined || value === null;
const isNonNegativeInt = (value) => Number.isInteger(value) && value >= 0;

const isShiftHeadcountShape = (value) =>
  Array.isArray(value) &&
  value.length === SHIFT_COUNT &&
  value.every((row) => Array.isArray(row) && row.length === SHIFT_COUNT && row.every(isNonNegativeInt));

/**
 * Valida o JSON gravado e converte no estado de domínio.
 * @returns {{ state: object|null, issues: string[] }} state null = dados inutilizáveis.
 */
export function readPersisted(raw) {
  const issues = [];
  const invalid = (reason) => ({ state: null, issues: [reason] });
  if (!isPlainObject(raw) || !Array.isArray(raw.team) || !Array.isArray(raw.days) || raw.days.length !== DAYS_PER_WEEK) {
    return invalid("A estrutura dos dados salvos está incompleta (equipe ou dias da semana ausentes).");
  }
  if (raw.team.length > MAX_PEOPLE) {
    return invalid(`A equipe salva tem ${raw.team.length} pessoas; o simulador comporta até ${MAX_PEOPLE}.`);
  }

  /** Valor presente e inválido vira o padrão e gera aviso; ausente vira o padrão sem aviso (dados antigos). */
  const field = (value, isValid, fallback, message) => {
    if (isAbsent(value)) return fallback;
    if (isValid(value)) return value;
    issues.push(message);
    return fallback;
  };

  const people = raw.team.filter(isPlainObject);
  if (people.length < raw.team.length) issues.push(`${raw.team.length - people.length} registro(s) inválido(s) da equipe foram ignorados.`);
  const team = people.map((person, index) => {
    let name = String(person.n ?? "");
    if (name.length > MAX_NAME_LENGTH) {
      issues.push(`O nome da pessoa ${index + 1} tinha mais de ${MAX_NAME_LENGTH} caracteres e foi encurtado.`);
      name = name.slice(0, MAX_NAME_LENGTH);
    }
    const sex = field(person.s, (s) => s === Sex.FEMALE || s === Sex.MALE, Sex.FEMALE, `Sexo inválido na pessoa ${index + 1}; considerado mulher.`);
    return { name, sex };
  });

  const days = raw.days.map((day, index) => {
    const entry = isPlainObject(day) ? day : {};
    const label = DAY_NAMES[index];
    let need = field(entry.need, isNonNegativeInt, 0, `${label}: quantidade de pessoas inválida; considerado 0.`);
    if (need > MAX_DAILY_DEMAND) {
      issues.push(`${label}: ${need} pessoas por dia foram ajustadas para o máximo de ${MAX_DAILY_DEMAND}.`);
      need = MAX_DAILY_DEMAND;
    }
    return {
      open: Boolean(entry.on),
      opensAt: field(entry.a, isClock, "08:00", `${label}: horário de abertura inválido; usado 08:00.`),
      closesAt: field(entry.f, isClock, "18:00", `${label}: horário de fechamento inválido; usado 18:00.`),
      need,
    };
  });

  let autoShifts = raw.tnAuto !== false;
  let shiftHeadcount = null;
  if (!isAbsent(raw.tn)) {
    if (!isShiftHeadcountShape(raw.tn)) {
      issues.push("O quadro de turnos salvo era inválido e será recalculado.");
      autoShifts = true;
    } else if (raw.tn.some((row) => sum(row) > MAX_DAILY_DEMAND)) {
      issues.push(`O quadro de turnos passava de ${MAX_DAILY_DEMAND} pessoas por dia e será recalculado.`);
      autoShifts = true;
    } else {
      shiftHeadcount = raw.tn.map((row) => [...row]);
    }
  }

  let shiftStarts = null;
  if (!isAbsent(raw.tt)) {
    if (Array.isArray(raw.tt) && raw.tt.length === SHIFT_COUNT) {
      shiftStarts = raw.tt.map((shift, index) => {
        const start = isPlainObject(shift) && isClock(shift.ini) ? shift.ini : undefined;
        const manual = isPlainObject(shift) && shift.auto === false;
        if (manual && !start) issues.push(`Turno ${index + 1}: horário de entrada inválido; voltou ao sugerido.`);
        return { start, auto: !(manual && start) };
      });
    } else {
      issues.push("Os horários de turno salvos eram inválidos e serão recalculados.");
    }
  }

  const overrides = {};
  let droppedOverrides = 0;
  if (isPlainObject(raw.ov)) {
    for (const [key, value] of Object.entries(raw.ov)) {
      if (OVERRIDE_KEY.test(key) && typeof value === "boolean") overrides[key] = value;
      else droppedOverrides++;
    }
  } else if (!isAbsent(raw.ov)) {
    issues.push("Os ajustes manuais salvos eram inválidos e foram descartados.");
  }
  if (droppedOverrides) issues.push(`${droppedOverrides} ajuste(s) manual(is) inválido(s) foram descartados.`);
  if (Object.keys(overrides).length > maxOverrides(MAX_PEOPLE)) {
    return invalid(`Há mais ajustes manuais salvos do que o máximo possível (${maxOverrides(MAX_PEOPLE)}).`);
  }

  const hireNames = {};
  if (isPlainObject(raw.names)) {
    for (const [id, name] of Object.entries(raw.names)) {
      if (typeof name !== "string" || !/^novo\d{1,3}$/.test(id)) {
        issues.push("Um nome de contratação salvo era inválido e foi descartado.");
        continue;
      }
      if (name.length > MAX_NAME_LENGTH) issues.push(`O nome de uma contratação tinha mais de ${MAX_NAME_LENGTH} caracteres e foi encurtado.`);
      hireNames[id] = name.slice(0, MAX_NAME_LENGTH);
    }
  }

  const isNonNegativeNumber = (value) => Number.isFinite(value) && value >= 0;
  const state = {
    segmentIndex: field(raw.seg, (s) => Number.isInteger(s) && s >= CUSTOM_SEGMENT && s < SEGMENTS.length, CUSTOM_SEGMENT, "Ramo de atividade inválido; usado “Outro”."),
    activityType: field(raw.tipo, (t) => Object.values(ActivityType).includes(t), ActivityType.OTHER, "Tipo de atividade inválido; usado “Outras”."),
    workModel: field(raw.modelo, isWorkModel, null, "Exemplo de jornada inválido; ignorado."),
    team,
    days,
    autoDemand: raw.needAuto !== false,
    autoShifts,
    shiftStarts,
    shiftHeadcount,
    phase: field(raw.fase, (p) => PHASES.includes(p), Phase.TRANSITION, "Jornada (44h/42h/40h) inválida; usada 42h."),
    includeHires: Boolean(raw.contratar),
    lunchMinutes: field(raw.alm, isLunchOption, DEFAULT_LUNCH_MINUTES, "Duração do almoço fora das opções; usada 1h."),
    lunchStart: field(raw.almIni, isClock, DEFAULT_LUNCH_START, "Horário de início do almoço inválido; usado 12:00."),
    salary: field(raw.sal, isNonNegativeNumber, 0, "Salário inválido; deixado em branco."),
    benefits: field(raw.ben, isNonNegativeNumber, 0, "Benefícios inválidos; deixados em branco."),
    overrides,
    hireNames,
    week: field(raw.wk, (w) => Number.isInteger(w) && w >= 0 && w < SIMULATED_WEEKS, 0, "Semana exibida inválida; usada a semana 1."),
    mobileTab: typeof raw.mtab === "string" ? raw.mtab : "ajustes",
  };
  return { state, issues };
}

/** Compatibilidade: estado validado ou null (sem a lista de correções). */
export const fromPersisted = (raw) => readPersisted(raw).state;

/** Converte o estado de domínio no formato gravado (mesmos campos da versão anterior). */
export function toPersisted(state) {
  return {
    seg: state.segmentIndex,
    tipo: state.activityType,
    modelo: state.workModel,
    team: state.team.map((person) => ({ n: person.name, s: person.sex })),
    days: state.days.map((day) => ({ on: day.open, a: day.opensAt, f: day.closesAt, need: day.need })),
    needAuto: state.autoDemand,
    tnAuto: state.autoShifts,
    tt: state.shiftStarts && state.shiftStarts.map((shift) => ({ ini: shift.start, auto: shift.auto })),
    tn: state.shiftHeadcount,
    fase: state.phase,
    contratar: state.includeHires,
    alm: state.lunchMinutes,
    almIni: state.lunchStart,
    sal: state.salary,
    ben: state.benefits,
    ov: state.overrides,
    names: state.hireNames,
    wk: state.week,
    mtab: state.mobileTab,
  };
}

/** Interpreta o texto gravado: JSON inválido também é "dados inutilizáveis". */
export function decodeStoredState(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { state: null, issues: ["Os dados salvos estão corrompidos (não são um JSON válido)."] };
  }
  return readPersisted(raw);
}

/**
 * Acesso ao localStorage. Nenhuma operação lança exceção: falhas (modo privado, cota cheia,
 * armazenamento bloqueado) viram valores de retorno para a camada de aplicação decidir.
 */
export function createLocalStorageRepository(storage = globalThis.localStorage, now = () => new Date()) {
  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, value);
      return storage.getItem(key) === value;
    } catch {
      return false;
    }
  };
  const backupKeys = () => {
    try {
      return Object.keys(storage).filter((key) => key.startsWith(BACKUP_KEY_PREFIX)).sort();
    } catch {
      return [];
    }
  };

  return {
    /** Texto gravado e de onde veio: v4, ou v3 se a v4 não existir. */
    loadRecord() {
      const current = read(STORAGE_KEY);
      if (current !== null) return { source: "v4", text: current };
      const legacy = read(LEGACY_STORAGE_KEY);
      if (legacy !== null) return { source: "v3", text: legacy };
      return { source: null, text: null };
    },
    readCurrent: () => read(STORAGE_KEY),
    /** Grava o estado na chave v4. Nunca escreve na v3. */
    save(state) {
      return write(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...toPersisted(state) }));
    },
    /** Guarda uma cópia do texto original; só remove cópias antigas depois que a nova foi confirmada. */
    backup(text) {
      const key = BACKUP_KEY_PREFIX + now().toISOString();
      if (!write(key, text)) return false;
      const old = backupKeys().filter((existing) => existing !== key);
      old.slice(0, Math.max(0, old.length - (MAX_BACKUPS - 1))).forEach((existing) => {
        try {
          storage.removeItem(existing);
        } catch {
          // Cópia antiga que não pôde ser removida não impede o uso.
        }
      });
      return true;
    },
    listBackups: backupKeys,
  };
}
