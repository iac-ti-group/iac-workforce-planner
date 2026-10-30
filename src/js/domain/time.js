/** Conversões de horário. Internamente todo horário é "minutos desde 00:00". */

export const MINUTES_PER_DAY = 1440;

/** "08:30" → 510 */
export function toMinutes(clock) {
  const [hours, minutes] = (clock || "0:0").split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

/** 510 → "08:30" (normaliza para dentro de 24h, inclusive valores após a meia-noite). */
export function formatClock(totalMinutes) {
  const minutes = ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

/** 8.4 → "8h24"; 8 → "8h" */
export function formatDuration(hours) {
  const totalMinutes = Math.round(hours * 60);
  const remainder = totalMinutes % 60;
  return Math.floor(totalMinutes / 60) + "h" + (remainder ? String(remainder).padStart(2, "0") : "");
}

/** Janela de funcionamento de um dia; fechamento menor ou igual à abertura vira o dia seguinte. */
export function businessHours(day) {
  const opensAt = toMinutes(day.opensAt);
  const closing = toMinutes(day.closesAt);
  return { opensAt, closesAt: closing <= opensAt ? closing + MINUTES_PER_DAY : closing };
}

export const isClock = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
