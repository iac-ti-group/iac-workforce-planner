/**
 * Representação estável (JSON) das saídas do simulador, usada pelo golden e pela paridade.
 * Se a forma interna mudar (ex.: ids de pessoas na E6), só este adaptador muda — os valores do golden não.
 */

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function snapshotWorkload(workload) {
  return {
    workDays: workload.workDays,
    dailyMinutes: workload.dailyMinutes,
    weeklyLimitHours: workload.weeklyLimitHours,
    minDaysOff: workload.minDaysOff,
    weeklyHours: workload.weeklyHours,
    label: workload.label ?? null,
    minutesByDay: DAYS.map((day) => workload.minutesOnDay(day)),
  };
}

/** Semana como texto: uma string "1010110" por pessoa. */
export const encodeWeek = (grid) => grid.map((row) => row.map((works) => (works ? "1" : "0")).join(""));

export function snapshotSchedule(schedule) {
  return {
    workload: snapshotWorkload(schedule.workload),
    roster: schedule.roster.map((person) => [person.name, person.sex, person.isHire, person.id ?? null]),
    weeks: schedule.weeks.map(encodeWeek),
    demand: schedule.demand,
    requiredHeadcount: schedule.requiredHeadcount,
    hires: schedule.hires,
    teamSize: schedule.teamSize,
    span: schedule.span,
    usesShifts: schedule.usesShifts,
    shiftShortages: schedule.shiftShortages.map(({ week, day, shift, missing }) => [week, day, shift, missing]),
    // [semana][dia] → [pessoa, entrada, saída, almoço, intervalo, turno, nome do turno]
    assignments: schedule.weeks.map((_, week) =>
      DAYS.map((day) =>
        [...schedule.assignmentsFor(week, day)]
          .sort(([a], [b]) => a - b)
          .map(([person, a]) => [person, a.start, a.end, a.lunchStart, a.breakMinutes, a.shiftIndex ?? null, a.shiftName ?? null]),
      ),
    ),
  };
}

export function snapshotCompliance(report) {
  return {
    alerts: report.alerts.map((alert) => [alert.level, alert.code, alert.title, alert.detail, alert.personIndex ?? null]),
    cellErrors: [...report.cellErrors].sort(),
    weeksWithIssues: [...report.weeksWithIssues].sort(),
  };
}

/** JSON legível em diff: objetos indentados, arrays de valores simples em uma linha. */
export function formatJson(value, indent = "") {
  const isSimple = (item) => item === null || typeof item !== "object";
  if (isSimple(value)) return JSON.stringify(value);
  const next = indent + "  ";
  if (Array.isArray(value)) {
    if (value.every(isSimple)) return JSON.stringify(value);
    return "[\n" + value.map((item) => next + formatJson(item, next)).join(",\n") + "\n" + indent + "]";
  }
  const entries = Object.entries(value).map(([key, item]) => `${next}${JSON.stringify(key)}: ${formatJson(item, next)}`);
  return "{\n" + entries.join(",\n") + "\n" + indent + "}";
}
