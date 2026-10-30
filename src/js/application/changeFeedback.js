/** Mensagem exibida depois que o usuário mexe na folga de alguém. */

import { DAY_NAMES, SUNDAY } from "../domain/calendar.js";
import { AlertCode, AlertLevel } from "../domain/compliance.js";
import { ActivityType, Sex } from "../domain/laborRules.js";

/**
 * @param {{personIndex:number, day:number, worksNow:boolean, fromDay?:number}} change
 * @returns {{level:string, title:string, text:string}}
 */
export function describeDayOffChange(state, schedule, compliance, { personIndex, day, worksNow, fromDay }) {
  const person = schedule.roster[personIndex];
  const violations = compliance.alerts.filter(
    (alert) => alert.level === AlertLevel.VIOLATION && alert.personIndex === personIndex,
  );

  const sundayViolation = violations.find((alert) => alert.code === AlertCode.SUNDAY_ROTATION);
  if (sundayViolation) {
    return {
      level: AlertLevel.VIOLATION,
      title: "Regra do domingo: " + sundayViolation.issue,
      text: sundayViolation.detail + " Devolva a folga para o domingo ou troque com outra pessoa.",
    };
  }
  if (violations.length) {
    return { level: AlertLevel.VIOLATION, title: violations[0].title, text: violations[0].detail };
  }

  const worksOnSunday = schedule.weeks[state.week][personIndex][SUNDAY];
  const touchedSunday = fromDay === SUNDAY || (day === SUNDAY && worksNow);
  if (state.days[SUNDAY].open && worksOnSunday && touchedSunday) {
    return {
      level: AlertLevel.WARNING,
      title: `${person.name} vai trabalhar no domingo da semana ${state.week + 1}`,
      text: sundayRuleFor(person, state.activityType) + " O simulador confere as 4 semanas e avisa se a regra quebrar.",
    };
  }

  const movement = fromDay !== undefined ? ` de ${DAY_NAMES[fromDay]} para ${DAY_NAMES[day]}` : "";
  return {
    level: AlertLevel.OK,
    title: "Folga ajustada" + movement,
    text: `${person.name} continua dentro das regras nesta escala.`,
  };
}

function sundayRuleFor(person, activityType) {
  if (person.sex !== Sex.MALE) {
    return "Mulheres folgam em domingos alternados: no domingo seguinte esta pessoa precisa folgar.";
  }
  return activityType === ActivityType.COMMERCE
    ? "Homens no comércio precisam folgar ao menos 1 domingo a cada 3 semanas."
    : "Homens precisam folgar ao menos 1 domingo a cada 7 semanas.";
}
