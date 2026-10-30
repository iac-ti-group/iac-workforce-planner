/** Verificações legais e de cobertura da escala gerada. */

import { DAY_GROUPS, DAY_NAMES, SUNDAY } from "./calendar.js";
import {
  ActivityType,
  MAX_CONSECUTIVE_WORKDAYS,
  MAX_LUNCH_WITHOUT_AGREEMENT,
  MIN_LUNCH_WITHOUT_AGREEMENT,
  Phase,
  Sex,
  maxConsecutiveSundaysForMen,
} from "./laborRules.js";
import { MAX_PEOPLE } from "./limits.js";
import { shiftName } from "./shiftPlan.js";
import { businessHours, formatDuration } from "./time.js";
import { isLongWorkday, shiftSpan } from "./workload.js";
import { countWhere, sum } from "../shared/collections.js";
import { plural, pluralIfMany } from "../shared/text.js";

export const AlertLevel = Object.freeze({ VIOLATION: "bad", WARNING: "warn", OK: "ok" });

export const AlertCode = Object.freeze({
  DAYS_OFF: "days-off",
  WEEKLY_HOURS: "weekly-hours",
  CONSECUTIVE_DAYS: "consecutive-days",
  SUNDAY_ROTATION: "sunday-rotation",
  COVERAGE_GAP: "coverage-gap",
  SHIFT_GAP: "shift-gap",
  SHORT_DAY: "short-day",
  SHORT_LUNCH: "short-lunch",
  LONG_LUNCH: "long-lunch",
  SAME_LUNCH: "same-lunch",
  AGREEMENT_REQUIRED: "agreement-required",
  HIRES_CAPPED: "hires-capped",
  COMPLIANT: "compliant",
});

const HOURS_TOLERANCE = 0.01;
const SHORT_DAY_TOLERANCE = 5;
const MAX_SHIFT_GAPS_LISTED = 6;
const FIRST_WEEK = 0;

/**
 * @typedef {object} Alert
 * @property {"bad"|"warn"|"ok"} level
 * @property {string} code
 * @property {string} title
 * @property {string} detail
 * @property {number} [personIndex]  presente nos alertas individuais
 * @property {string} [issue]        título sem o nome da pessoa
 *
 * @typedef {object} ComplianceReport
 * @property {Alert[]} alerts
 * @property {Set<string>} cellErrors      "pessoa-semana-dia" com problema
 * @property {Set<number>} weeksWithIssues
 */

const missingText = (missing) => `${pluralIfMany(missing, "falta", "faltam")} ${missing}`;
export const cellId = (person, week, day) => `${person}-${week}-${day}`;

/** @returns {ComplianceReport} */
export function evaluateCompliance(state, schedule) {
  const report = { alerts: [], cellErrors: new Set(), weeksWithIssues: new Set() };

  schedule.roster.forEach((person, index) => checkPerson(state, schedule, report, person, index));
  const coverageGaps = findCoverageGaps(schedule, report);
  checkShortDays(state, schedule, report);
  if (schedule.usesShifts) checkShiftGaps(schedule, report);
  if (coverageGaps.length) reportCoverageGaps(state, schedule, report, coverageGaps);
  if (schedule.unmetHires > 0) reportHiresCapped(schedule, report);
  checkLunch(state, schedule, report);
  if (state.phase === Phase.TRANSITION) {
    report.alerts.push({
      level: AlertLevel.WARNING,
      code: AlertCode.AGREEMENT_REQUIRED,
      title: "8h24 por dia exige convenção",
      detail: "Sem convenção ou acordo coletivo que autorize, use a escala de 40h (5 × 8h) já em dezembro.",
    });
  }

  const hasViolation = report.alerts.some((alert) => alert.level === AlertLevel.VIOLATION);
  if (!hasViolation && !coverageGaps.length && !schedule.unmetHires) {
    report.alerts.unshift({
      level: AlertLevel.OK,
      code: AlertCode.COMPLIANT,
      title: "Escala dentro das regras",
      detail: "2 folgas por semana, domingos no revezamento certo e nenhum período de 7 dias seguidos nas 4 semanas.",
    });
  }
  return report;
}

/** Folgas, horas semanais, dias seguidos e domingos de uma pessoa nas 4 semanas. */
function checkPerson(state, schedule, report, person, index) {
  const { workload } = schedule;
  const maxSundaysForMen = maxConsecutiveSundaysForMen(state.activityType);
  const violation = (week, code, issue, detail, cell) => {
    report.alerts.push({ level: AlertLevel.VIOLATION, code, title: `${person.name}: ${issue}`, detail, issue, personIndex: index });
    report.weeksWithIssues.add(week);
    if (cell !== undefined) report.cellErrors.add(cellId(index, week, cell));
  };

  let consecutiveWorkdays = 0;
  let consecutiveSundays = 0;
  schedule.weeks.forEach((grid, week) => {
    const row = grid[index];
    const daysOff = row.length - countWhere(row, Boolean);
    const hours = sum(row.map((works, day) => (works ? workload.minutesOnDay(day) : 0))) / 60;

    if (daysOff < workload.minDaysOff) {
      violation(
        week,
        AlertCode.DAYS_OFF,
        `só ${daysOff} ${plural(daysOff, "folga")} na semana ${week + 1}`,
        `O mínimo nesta jornada é ${workload.minDaysOff} ${pluralIfMany(workload.minDaysOff, "folga")} por semana.`,
      );
    }
    if (hours > workload.weeklyLimitHours + HOURS_TOLERANCE) {
      violation(
        week,
        AlertCode.WEEKLY_HOURS,
        `${formatDuration(hours)} na semana ${week + 1}`,
        `Passa do limite de ${workload.weeklyLimitHours}h. Dê mais uma folga.`,
      );
    }
    row.forEach((works, day) => {
      consecutiveWorkdays = works ? consecutiveWorkdays + 1 : 0;
      if (consecutiveWorkdays === MAX_CONSECUTIVE_WORKDAYS + 1) {
        violation(
          week,
          AlertCode.CONSECUTIVE_DAYS,
          "7 dias seguidos sem folga",
          `Termina na semana ${week + 1}, ${DAY_NAMES[day]}. Folga depois do 7º dia é paga em dobro.`,
          day,
        );
      }
    });

    if (!row[SUNDAY]) {
      consecutiveSundays = 0;
      return;
    }
    consecutiveSundays++;
    if (person.sex !== Sex.MALE && consecutiveSundays >= 2) {
      violation(
        week,
        AlertCode.SUNDAY_ROTATION,
        "dois domingos seguidos",
        `Mulheres folgam em domingos alternados (semana ${week + 1}).`,
        SUNDAY,
      );
    }
    if (person.sex === Sex.MALE && consecutiveSundays > maxSundaysForMen) {
      violation(
        week,
        AlertCode.SUNDAY_ROTATION,
        `${consecutiveSundays} domingos seguidos`,
        state.activityType === ActivityType.COMMERCE
          ? "No comércio, homens folgam 1 domingo a cada 3 semanas."
          : "Folga ao menos 1 domingo a cada 7 semanas.",
        SUNDAY,
      );
    }
  });
}

function findCoverageGaps(schedule, report) {
  const gaps = [];
  schedule.weeks.forEach((grid, week) =>
    schedule.demand.forEach((need, day) => {
      const working = countWhere(grid, (row) => row[day]);
      if (working < need) {
        gaps.push({ week, day, missing: need - working });
        report.weeksWithIssues.add(week);
      }
    }),
  );
  return gaps;
}

/** Expediente menor que a jornada + almoço: quem trabalha sai depois do fechamento. */
function checkShortDays(state, schedule, report) {
  const notes = [];
  DAY_GROUPS.forEach((group) => {
    for (const day of group.days) {
      if (!state.days[day].open || !schedule.demand[day]) continue;
      const { opensAt, closesAt } = businessHours(state.days[day]);
      const span = shiftSpan(state, schedule.workload.minutesOnDay(day));
      if (closesAt - opensAt < span - SHORT_DAY_TOLERANCE) {
        notes.push(
          `${group.name}: abre ${formatDuration((closesAt - opensAt) / 60)} e a jornada pede ${formatDuration(span / 60)} com almoço`,
        );
        break;
      }
    }
  });
  if (!notes.length) return;
  report.alerts.push({
    level: AlertLevel.WARNING,
    code: AlertCode.SHORT_DAY,
    title: "Dia mais curto que a jornada",
    detail:
      notes.join(" · ") +
      ". Quem trabalha nesse dia sai depois do fechamento; ajuste o horário ou dê folga nesse dia.",
  });
}

function checkShiftGaps(schedule, report) {
  if (!schedule.shiftShortages.length) return;
  const worstByShift = new Map();
  schedule.shiftShortages.forEach(({ week, day, shift, missing }) => {
    const label = `${shiftName(shift)} de ${DAY_NAMES[day]}`;
    worstByShift.set(label, Math.max(worstByShift.get(label) || 0, missing));
    report.weeksWithIssues.add(week);
  });
  const summary = [...worstByShift]
    .slice(0, MAX_SHIFT_GAPS_LISTED)
    .map(([label, missing]) => `${label}: ${missingText(missing)}`)
    .join(" · ");
  report.alerts.unshift({
    level: AlertLevel.WARNING,
    code: AlertCode.SHIFT_GAP,
    title: "Turnos sem gente suficiente",
    detail: summary + ".",
  });
}

function reportCoverageGaps(state, schedule, report, gaps) {
  const worstByDay = new Map();
  gaps.forEach(({ day, missing }) => worstByDay.set(day, Math.max(worstByDay.get(day) || 0, missing)));
  const summary = [...worstByDay]
    .sort(([a], [b]) => a - b)
    .map(([day, missing]) => `${DAY_NAMES[day]}: ${missingText(missing)}`)
    .join(" · ");
  const hiringWouldHelp =
    state.phase !== Phase.CURRENT && !state.includeHires && schedule.requiredHeadcount > schedule.teamSize;
  const advice = hiringWouldHelp
    ? "Marque “Incluir as contratações” ou reduza as pessoas por dia."
    : "Reduza as pessoas por dia ou aumente a equipe.";
  report.alerts.unshift({
    level: AlertLevel.WARNING,
    code: AlertCode.COVERAGE_GAP,
    title: "Faltam pessoas em alguns dias",
    detail: `${summary}. ${advice}`,
  });
}

/** A demanda pede mais gente do que o limite do simulador comporta: a escala não pode cobrir tudo. */
function reportHiresCapped(schedule, report) {
  const included = schedule.teamSize + schedule.hires;
  report.alerts.unshift({
    level: AlertLevel.WARNING,
    code: AlertCode.HIRES_CAPPED,
    title: `Contratações limitadas a ${included} pessoas no total`,
    detail:
      `A demanda informada pede ${schedule.requiredHeadcount} pessoas, mas o simulador comporta até ${MAX_PEOPLE} ` +
      `(equipe + contratações). Faltam ${schedule.unmetHires} e a escala não cobre todos os dias: reduza as pessoas por dia.`,
  });
}

/** Duração do almoço fora do padrão legal e almoço simultâneo de toda a equipe. */
function checkLunch(state, schedule, report) {
  if (!isLongWorkday(schedule.workload)) return;
  const lunch = state.lunchMinutes;
  if (lunch < MIN_LUNCH_WITHOUT_AGREEMENT) {
    report.alerts.push({
      level: AlertLevel.WARNING,
      code: AlertCode.SHORT_LUNCH,
      title: `Almoço de ${lunch} min exige convenção`,
      detail:
        "Intervalo menor que 1h em jornada acima de 6h só vale com convenção ou acordo coletivo (mínimo de 30 min) ou autorização do MTE.",
    });
  }
  if (lunch > MAX_LUNCH_WITHOUT_AGREEMENT) {
    report.alerts.push({
      level: AlertLevel.WARNING,
      code: AlertCode.LONG_LUNCH,
      title: `Almoço de ${formatDuration(lunch / 60)} exige acordo`,
      detail: "Intervalo acima de 2h só vale com acordo escrito ou convenção coletiva. A saída fica mais tarde.",
    });
  }

  const dayEveryoneLunchesTogether = state.days.findIndex((day, index) => {
    if (!day.open) return false;
    const lunches = [...schedule.assignmentsFor(FIRST_WEEK, index).values()].map((a) => a.lunchStart);
    return lunches.length > 0 && lunches.every((start) => start != null && start === lunches[0]);
  });
  if (dayEveryoneLunchesTogether >= 0) {
    report.alerts.push({
      level: AlertLevel.OK,
      code: AlertCode.SAME_LUNCH,
      title: "Todos almoçam no mesmo horário",
      detail: `Na ${DAY_NAMES[dayEveryoneLunchesTogether]}, ninguém fica na empresa durante o almoço. Se alguém precisa atender nesse horário, combine um revezamento no almoço.`,
    });
  }
}
