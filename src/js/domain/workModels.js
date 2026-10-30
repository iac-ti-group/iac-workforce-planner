/** Exemplos de jornada de 44h que o usuário pode aplicar como ponto de partida. */

import { SATURDAY } from "./calendar.js";

const workday = (open, opensAt, closesAt) => ({ open, opensAt, closesAt });

export const WORK_MODELS = Object.freeze({
  /** Seg a sex, 8h48 + 1h de almoço. */
  "5": (day) => (day < SATURDAY ? workday(true, "08:00", "17:48") : workday(false, "08:00", "12:00")),
  /** Seg a sex 8h + sábado 4h. */
  "6": (day) =>
    day < SATURDAY
      ? workday(true, "08:00", "17:00")
      : day === SATURDAY
        ? workday(true, "08:00", "12:00")
        : workday(false, "08:00", "12:00"),
  /** Todos os dias 7h20, 6x1 em revezamento. */
  "7": () => workday(true, "08:00", "16:20"),
});

export const MON_TO_SAT_MODEL = "6";

export const isWorkModel = (value) => Object.prototype.hasOwnProperty.call(WORK_MODELS, value);
