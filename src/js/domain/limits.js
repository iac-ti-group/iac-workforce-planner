/**
 * Limites operacionais do simulador (não são regras trabalhistas).
 * Protegem o navegador de estados que levariam a processamento excessivo e deixam explícito
 * o que o simulador consegue calcular.
 */

import { DAYS_PER_WEEK, SIMULATED_WEEKS } from "./calendar.js";
import { sum } from "../shared/collections.js";

/** Equipe + contratações sugeridas. */
export const MAX_PEOPLE = 200;
/** Pessoas por dia, e também a soma dos turnos de um grupo de dias. */
export const MAX_DAILY_DEMAND = 200;
export const MAX_NAME_LENGTH = 80;
/** Opções do seletor de almoço (minutos). */
export const LUNCH_OPTIONS = Object.freeze([30, 45, 60, 75, 90, 120, 150, 180]);

/** Ajustes manuais possíveis: uma chave por pessoa, semana e dia. */
export const maxOverrides = (rosterSize) => rosterSize * SIMULATED_WEEKS * DAYS_PER_WEEK;

/** Quantas contratações ainda cabem no limite, dada a equipe atual. */
export const hireCapacity = (teamSize) => Math.max(0, MAX_PEOPLE - teamSize);

export const canAddTeamMember = (state) => state.team.length < MAX_PEOPLE;

export const canIncreaseDayDemand = (state, dayIndex) => state.days[dayIndex].need < MAX_DAILY_DEMAND;

export const canIncreaseShiftHeadcount = (state, groupIndex) =>
  Boolean(state.shiftHeadcount) && sum(state.shiftHeadcount[groupIndex]) < MAX_DAILY_DEMAND;

export const isLunchOption = (minutes) => LUNCH_OPTIONS.includes(minutes);

export const LIMIT_MESSAGES = Object.freeze({
  team: {
    title: `Limite de ${MAX_PEOPLE} pessoas`,
    text: `O simulador comporta até ${MAX_PEOPLE} pessoas, somando a equipe e as contratações sugeridas.`,
  },
  demand: {
    title: `Máximo de ${MAX_DAILY_DEMAND} pessoas por dia`,
    text: `Cada dia, ou a soma dos turnos de um dia, aceita até ${MAX_DAILY_DEMAND} pessoas.`,
  },
});
