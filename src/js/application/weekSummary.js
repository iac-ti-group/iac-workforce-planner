/** Texto da semana exibida, formatado para colar no WhatsApp. */

import { DAY_NAMES } from "../domain/calendar.js";
import { Phase } from "../domain/laborRules.js";
import { formatClock } from "../domain/time.js";

export function weekSummaryText(state, schedule) {
  const week = state.week;
  const grid = schedule.weeks[week];
  const phaseLabel = state.phase === Phase.CURRENT ? "44h (hoje)" : state.phase + "h · 5x2";
  const lines = [`*Escala ${phaseLabel} · Semana ${week + 1}*`];

  DAY_NAMES.forEach((dayName, day) => {
    if (!state.days[day].open) return;
    lines.push("", `*${dayName}*`);
    const assignments = schedule.assignmentsFor(week, day);
    schedule.roster.forEach((person, index) => {
      if (!grid[index][day]) return;
      const { start, end, lunchStart } = assignments.get(index);
      const lunch = lunchStart != null ? ` (almoço ${formatClock(lunchStart)})` : "";
      lines.push(`${person.name}: ${formatClock(start)} às ${formatClock(end)}${lunch}`);
    });
    const off = schedule.roster.filter((_, index) => !grid[index][day]).map((person) => person.name);
    if (off.length) lines.push("Folga: " + off.join(", "));
  });
  return lines.join("\n");
}
