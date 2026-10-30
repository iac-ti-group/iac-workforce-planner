/** Ramos de atividade com horários de referência. A posição no array é persistida: só acrescente no fim. */

import { ActivityType } from "./laborRules.js";
import { SATURDAY, firstOpenDay } from "./calendar.js";

const { COMMERCE, OTHER } = ActivityType;

const MON_TO_FRI = [true, true, true, true, true, false, false];
const MON_TO_SAT = [true, true, true, true, true, true, false];
const TUE_TO_SAT = [false, true, true, true, true, true, false];
const TUE_TO_SUN = [false, true, true, true, true, true, true];
const EVERY_DAY = [true, true, true, true, true, true, true];

/** Horários são pares [abre, fecha]; null = não abre nesse dia. */
const segment = (name, activityType, openDays, weekday, saturday, sunday) => ({
  name,
  activityType,
  openDays,
  hours: { weekday, saturday, sunday },
});

export const SEGMENTS = [
  segment("Atacado / distribuidora", COMMERCE, MON_TO_SAT, ["07:00", "18:00"], ["07:00", "13:00"], null),
  segment("Material de construção", COMMERCE, MON_TO_SAT, ["07:00", "18:00"], ["07:00", "13:00"], null),
  segment("Pet shop", COMMERCE, MON_TO_SAT, ["08:00", "19:00"], ["08:00", "17:00"], null),
  segment("Loja de conveniência", COMMERCE, EVERY_DAY, ["06:00", "23:00"], ["06:00", "23:00"], ["07:00", "22:00"]),
  segment("Concessionária / revenda de veículos", COMMERCE, MON_TO_SAT, ["08:00", "18:00"], ["08:00", "14:00"], null),
  segment("Posto de combustível", OTHER, EVERY_DAY, ["06:00", "22:00"], ["06:00", "22:00"], ["07:00", "20:00"]),
  segment("Lanchonete / pizzaria (noite)", OTHER, TUE_TO_SUN, ["17:00", "23:30"], ["17:00", "23:59"], ["17:00", "23:30"]),
  segment("Bar / restaurante (almoço e jantar)", OTHER, TUE_TO_SUN, ["11:00", "23:00"], ["11:00", "23:59"], ["11:00", "17:00"]),
  segment("Hotel / pousada", OTHER, EVERY_DAY, ["07:00", "23:00"], ["07:00", "23:00"], ["07:00", "23:00"]),
  segment("Clínica / consultório", OTHER, MON_TO_SAT, ["07:00", "19:00"], ["08:00", "12:00"], null),
  segment("Laboratório / hospital", OTHER, EVERY_DAY, ["06:00", "20:00"], ["06:00", "18:00"], ["07:00", "13:00"]),
  segment("Salão de beleza / barbearia", OTHER, TUE_TO_SAT, ["09:00", "19:00"], ["08:00", "18:00"], null),
  segment("Academia", OTHER, EVERY_DAY, ["06:00", "22:00"], ["08:00", "14:00"], ["08:00", "12:00"]),
  segment("Escola / creche", OTHER, MON_TO_FRI, ["07:00", "19:00"], null, null),
  segment("Oficina mecânica", OTHER, MON_TO_SAT, ["08:00", "18:00"], ["08:00", "12:00"], null),
  segment("Lavanderia", OTHER, MON_TO_SAT, ["08:00", "19:00"], ["08:00", "14:00"], null),
  segment("Transportadora / logística", OTHER, MON_TO_SAT, ["06:00", "18:00"], ["06:00", "12:00"], null),
  segment("Call center / atendimento", OTHER, MON_TO_SAT, ["08:00", "20:00"], ["09:00", "15:00"], null),
  segment("Construção civil", OTHER, MON_TO_FRI, ["07:00", "17:00"], null, null),
  segment("Depósito de bebidas / adega", COMMERCE, EVERY_DAY, ["08:00", "22:00"], ["08:00", "23:00"], ["09:00", "15:00"]),
  segment("Supermercado / mercado", COMMERCE, EVERY_DAY, ["07:00", "22:00"], ["07:00", "22:00"], ["08:00", "14:00"]),
  segment("Loja de rua", COMMERCE, MON_TO_SAT, ["09:00", "18:00"], ["09:00", "13:00"], null),
  segment("Loja de shopping", COMMERCE, EVERY_DAY, ["10:00", "22:00"], ["10:00", "22:00"], ["14:00", "20:00"]),
  segment("Açougue / hortifrúti", COMMERCE, EVERY_DAY, ["06:00", "19:00"], ["06:00", "18:00"], ["07:00", "13:00"]),
  segment("Farmácia / drogaria", OTHER, EVERY_DAY, ["07:00", "22:00"], ["08:00", "20:00"], ["08:00", "16:00"]),
  segment("Padaria / cafeteria", OTHER, EVERY_DAY, ["05:00", "21:00"], ["05:00", "21:00"], ["06:00", "14:00"]),
  segment("Restaurante (almoço)", OTHER, TUE_TO_SUN, ["09:00", "17:00"], ["09:00", "17:00"], ["09:00", "17:00"]),
  segment("Escritório / serviços", OTHER, MON_TO_FRI, ["08:00", "18:00"], null, null),
  segment("Indústria (seg a sáb)", OTHER, MON_TO_SAT, ["06:00", "16:00"], ["06:00", "12:00"], null),
];

export const CUSTOM_SEGMENT = -1;

export const segmentAt = (index) => SEGMENTS[index];

const hoursOfDay = (hours, day) => (day < SATURDAY ? hours.weekday : day === SATURDAY ? hours.saturday : hours.sunday);

/** Semana de funcionamento sugerida pelo ramo; dias sem horário próprio ficam fechados. */
export function daysFromSegment(seg) {
  return seg.openDays.map((opensOnDay, day) => {
    const hours = hoursOfDay(seg.hours, day);
    const [opensAt, closesAt] = hours || seg.hours.weekday;
    return { open: opensOnDay && Boolean(hours), opensAt, closesAt, need: 0 };
  });
}

/** Horário usado ao reabrir um dia: o do ramo (com fallback sábado → semana) ou o do primeiro dia aberto. */
export function defaultHoursForDay(state, day) {
  const seg = segmentAt(state.segmentIndex);
  if (seg) {
    const { weekday, saturday, sunday } = seg.hours;
    const [opensAt, closesAt] = day < SATURDAY ? weekday : day === SATURDAY ? saturday || weekday : sunday || saturday || weekday;
    return { opensAt, closesAt };
  }
  const reference = state.days[firstOpenDay(state.days) ?? 0];
  return { opensAt: reference.opensAt, closesAt: reference.closesAt };
}
