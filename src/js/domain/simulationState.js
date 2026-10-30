/** Estado da simulação (entradas do usuário) e o exemplo carregado na primeira visita. */

import { distributeDemand } from "./demand.js";
import { DEFAULT_LUNCH_MINUTES, DEFAULT_LUNCH_START, Phase, Sex } from "./laborRules.js";
import { SEGMENTS, daysFromSegment } from "./segments.js";

/**
 * @typedef {object} Person
 * @property {string} name
 * @property {"F"|"M"} sex
 *
 * @typedef {object} BusinessDay
 * @property {boolean} open
 * @property {string} opensAt   "HH:MM"
 * @property {string} closesAt  "HH:MM"
 * @property {number} need      pessoas necessárias no dia
 *
 * @typedef {object} SimulationState
 * @property {number} segmentIndex          índice em SEGMENTS, -1 = personalizado
 * @property {"comercio"|"outros"} activityType
 * @property {string|null} workModel        exemplo de jornada 44h aplicado (WORK_MODELS)
 * @property {Person[]} team
 * @property {BusinessDay[]} days           7 dias, segunda primeiro
 * @property {boolean} autoDemand           pessoas por dia calculadas automaticamente
 * @property {boolean} autoShifts           quadro de turnos calculado automaticamente
 * @property {{start:string|undefined, auto:boolean}[]|null} shiftStarts
 * @property {number[][]|null} shiftHeadcount  [grupo de dias][turno]
 * @property {"44"|"42"|"40"} phase
 * @property {boolean} includeHires
 * @property {number} lunchMinutes
 * @property {string} lunchStart
 * @property {number} salary
 * @property {number} benefits
 * @property {Object<string, boolean>} overrides  ajustes manuais (ver overrides.js)
 * @property {Object<string, string>} hireNames   nomes dados às contratações sugeridas
 * @property {number} week                  semana exibida (0–3)
 * @property {string} mobileTab
 */

const EXAMPLE_TEAM = [
  ["Ana", Sex.FEMALE],
  ["Bruna", Sex.FEMALE],
  ["Carla", Sex.FEMALE],
  ["Daniela", Sex.FEMALE],
  ["Eduardo", Sex.MALE],
  ["Felipe", Sex.MALE],
  ["Gustavo", Sex.MALE],
  ["Henrique", Sex.MALE],
];
const EXAMPLE_SALARY = 2150;

/** @returns {SimulationState} */
export function createExampleState() {
  const segmentIndex = SEGMENTS.findIndex((seg) => seg.name.startsWith("Supermercado"));
  const seg = SEGMENTS[segmentIndex];
  const state = {
    segmentIndex,
    activityType: seg.activityType,
    workModel: null,
    team: EXAMPLE_TEAM.map(([name, sex]) => ({ name, sex })),
    days: daysFromSegment(seg),
    autoDemand: true,
    autoShifts: true,
    shiftStarts: null,
    shiftHeadcount: null,
    phase: Phase.TRANSITION,
    includeHires: true,
    lunchMinutes: DEFAULT_LUNCH_MINUTES,
    lunchStart: DEFAULT_LUNCH_START,
    salary: EXAMPLE_SALARY,
    benefits: 0,
    overrides: {},
    hireNames: {},
    week: 0,
    mobileTab: "ajustes",
  };
  distributeDemand(state);
  return state;
}
