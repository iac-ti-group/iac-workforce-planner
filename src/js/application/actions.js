/**
 * Casos de uso: cada função aplica uma intenção do usuário ao estado.
 * Regra geral: mudanças que alteram a escala descartam os ajustes manuais, que deixariam de fazer sentido.
 * Valores fora dos limites (domain/limits.js) ou horários inválidos são recusados: o estado não muda.
 * A interface consulta os mesmos limites para explicar a recusa ao usuário.
 */

import { distributeDemand } from "../domain/demand.js";
import { DEFAULT_LUNCH_MINUTES, Phase, Sex } from "../domain/laborRules.js";
import {
  MAX_NAME_LENGTH,
  canAddTeamMember,
  canIncreaseDayDemand,
  canIncreaseShiftHeadcount,
  isLunchOption,
} from "../domain/limits.js";
import { overrideKey } from "../domain/overrides.js";
import { CUSTOM_SEGMENT, daysFromSegment, defaultHoursForDay, segmentAt } from "../domain/segments.js";
import { createExampleState } from "../domain/simulationState.js";
import { isClock } from "../domain/time.js";
import { WORK_MODELS } from "../domain/workModels.js";

const clearOverrides = (state) => {
  state.overrides = {};
};

const refreshDemandIfAuto = (state) => {
  if (state.autoDemand) distributeDemand(state);
};

export function selectSegment(state, segmentIndex) {
  state.segmentIndex = segmentIndex;
  state.workModel = null;
  state.autoShifts = true;
  const seg = segmentAt(segmentIndex);
  if (seg) {
    state.activityType = seg.activityType;
    state.days = daysFromSegment(seg);
    state.autoDemand = true;
    distributeDemand(state);
  }
  clearOverrides(state);
}

export function setActivityType(state, activityType) {
  state.activityType = activityType;
  clearOverrides(state);
}

export function addTeamMember(state, sex) {
  if (!canAddTeamMember(state)) return;
  const sameSexCount = state.team.filter((person) => person.sex === sex).length;
  const label = sex === Sex.FEMALE ? "Colaboradora " : "Colaborador ";
  state.team.push({ name: label + (sameSexCount + 1), sex });
  refreshDemandIfAuto(state);
  clearOverrides(state);
}

/** Remove a última pessoa do sexo informado. */
export function removeTeamMember(state, sex) {
  const index = state.team.map((person) => person.sex).lastIndexOf(sex);
  if (index >= 0) state.team.splice(index, 1);
  refreshDemandIfAuto(state);
  clearOverrides(state);
}

export function applyWorkModel(state, model) {
  state.workModel = model;
  state.segmentIndex = CUSTOM_SEGMENT;
  state.days = state.days.map((_, day) => ({ ...WORK_MODELS[model](day), need: 0 }));
  state.autoDemand = true;
  distributeDemand(state);
  clearOverrides(state);
  state.phase = Phase.CURRENT;
  state.lunchMinutes = DEFAULT_LUNCH_MINUTES;
}

export function toggleBusinessDay(state, dayIndex) {
  const day = state.days[dayIndex];
  day.open = !day.open;
  if (day.open && !state.workModel) Object.assign(day, defaultHoursForDay(state, dayIndex));
  state.workModel = null;
  if (state.autoDemand) distributeDemand(state);
  else day.need = day.open ? Math.max(1, day.need) : 0;
  clearOverrides(state);
}

/** Horário de abertura/fechamento de um grupo de dias (seg–sex, sáb ou dom). */
export function setGroupHours(state, dayIndexes, field, value) {
  if (!isClock(value)) return;
  dayIndexes.forEach((day) => (state.days[day][field] = value));
  state.workModel = null;
  clearOverrides(state);
}

/** Ajuste fino de um dia específico (mantém os ajustes manuais da escala). */
export function setDayHours(state, dayIndex, field, value) {
  if (!isClock(value)) return;
  state.days[dayIndex][field] = value;
  state.workModel = null;
}

export function setLunchMinutes(state, minutes) {
  if (!isLunchOption(minutes)) return;
  state.lunchMinutes = minutes;
}

export function setLunchStart(state, clock) {
  if (!isClock(clock)) return;
  state.lunchStart = clock;
}

export function changeDayDemand(state, dayIndex, delta) {
  if (delta > 0 && !canIncreaseDayDemand(state, dayIndex)) return;
  const day = state.days[dayIndex];
  day.need = Math.max(0, day.need + delta);
  state.autoDemand = false;
  clearOverrides(state);
}

export function changeShiftHeadcount(state, groupIndex, shiftIndex, delta) {
  if (delta > 0 && !canIncreaseShiftHeadcount(state, groupIndex)) return;
  state.autoShifts = false;
  state.autoDemand = false;
  const row = state.shiftHeadcount[groupIndex];
  row[shiftIndex] = Math.max(0, (row[shiftIndex] || 0) + delta);
  clearOverrides(state);
}

export function setShiftStart(state, shiftIndex, clock) {
  if (!isClock(clock)) return;
  state.shiftStarts[shiftIndex] = { start: clock, auto: false };
  clearOverrides(state);
}

export function restoreSuggestedShifts(state) {
  state.autoShifts = true;
  state.autoDemand = true;
  distributeDemand(state);
  (state.shiftStarts || []).forEach((shift) => (shift.auto = true));
  clearOverrides(state);
}

export function restoreSuggestedDemand(state) {
  state.autoDemand = true;
  state.autoShifts = true;
  distributeDemand(state);
  clearOverrides(state);
}

export function setIncludeHires(state, include) {
  state.includeHires = include;
  clearOverrides(state);
}

export function setPhase(state, phase) {
  state.phase = phase;
  clearOverrides(state);
}

export function setSalary(state, value) {
  state.salary = value;
}

export function setBenefits(state, value) {
  state.benefits = value;
}

export function undoManualAdjustments(state) {
  clearOverrides(state);
}

export function selectWeek(state, week) {
  state.week = week;
}

export function setMobileTab(state, tab) {
  state.mobileTab = tab;
}

/** Inverte trabalho/folga de uma pessoa em um dia da semana exibida. */
export function toggleWorkday(state, schedule, personIndex, dayIndex) {
  const person = schedule.roster[personIndex];
  const worksToday = schedule.weeks[state.week][personIndex][dayIndex];
  state.overrides[overrideKey(person, personIndex, state.week, dayIndex)] = !worksToday;
}

/** Leva a folga de `fromDay` para `toDay` na semana exibida. */
export function moveDayOff(state, schedule, personIndex, fromDay, toDay) {
  const person = schedule.roster[personIndex];
  state.overrides[overrideKey(person, personIndex, state.week, fromDay)] = true;
  state.overrides[overrideKey(person, personIndex, state.week, toDay)] = false;
}

export function toggleSex(state, personIndex) {
  const person = state.team[personIndex];
  if (!person) return;
  person.sex = person.sex === Sex.FEMALE ? Sex.MALE : Sex.FEMALE;
  clearOverrides(state);
}

/** Renomeia alguém da equipe ou uma contratação sugerida; nome vazio mantém o atual. */
export function renamePerson(state, schedule, personIndex, rawName) {
  const person = schedule.roster[personIndex];
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || person.name;
  if (person.isHire) state.hireNames[person.id] = name;
  else state.team[personIndex].name = name;
}

/** Recomeça do exemplo, preservando a aba aberta no celular. */
export function loadExample(state) {
  return { ...createExampleState(), mobileTab: state.mobileTab };
}
