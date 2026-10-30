/**
 * Resposta em linguagem simples: o que a jornada escolhida significa para a empresa,
 * e a comparação das três jornadas lado a lado. Só lê o estado; os cálculos vêm do domínio.
 */

import { AlertCode, AlertLevel } from "../domain/compliance.js";
import { estimateCost } from "../domain/cost.js";
import { DAYS_PER_WEEK } from "../domain/calendar.js";
import { MAX_PEOPLE } from "../domain/limits.js";
import { PHASES, Phase } from "../domain/laborRules.js";
import { buildSchedule } from "../domain/scheduler.js";
import { formatDuration } from "../domain/time.js";
import { formatCurrency } from "../shared/format.js";
import { pluralIfMany } from "../shared/text.js";

export const PHASE_LABEL = Object.freeze({ "44": "Hoje · 44h", "42": "42h", "40": "40h" });

const percent = (value) => value.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";

/**
 * Cada jornada calculada sobre uma cópia do estado (sem ajustes manuais, que são de uma jornada só).
 * @returns {{ phase:string, label:string, workDays:number, dailyMinutes:number, dailyLabel:string|null,
 *   weeklyHours:number, required:number, missing:number, monthlyCost:number|null }[]}
 */
export function comparePhases(state) {
  return PHASES.map((phase) => {
    const copy = { ...JSON.parse(JSON.stringify(state)), phase, overrides: {} };
    const schedule = buildSchedule(copy);
    const cost = estimateCost(copy, schedule);
    const missing = Math.max(0, schedule.requiredHeadcount - schedule.teamSize);
    return {
      phase,
      label: PHASE_LABEL[phase],
      workDays: schedule.workload.workDays,
      dailyMinutes: schedule.workload.dailyMinutes,
      dailyLabel: schedule.workload.label || null,
      weeklyHours: schedule.workload.weeklyHours,
      required: schedule.requiredHeadcount,
      missing,
      monthlyCost: cost ? cost.payroll + missing * cost.costPerEmployee : null,
    };
  });
}

/**
 * Frases que explicam a jornada escolhida.
 * @returns {{ title:string, tone:"ok"|"warn"|"bad", lines:{ topic:string, text:string }[] }}
 */
export function describeAnswer(state, schedule, compliance) {
  const { workload, teamSize, requiredHeadcount, hires, unmetHires } = schedule;
  const isCurrent = state.phase === Phase.CURRENT;
  const missing = Math.max(0, requiredHeadcount - teamSize);
  const daysOff = DAYS_PER_WEEK - workload.workDays;
  const lines = [];

  const daily = workload.label ? `(${workload.label})` : `de ${formatDuration(workload.dailyMinutes / 60)}`;
  lines.push({
    topic: "rotina",
    text: `Cada pessoa trabalha ${workload.workDays} ${pluralIfMany(workload.workDays, "dia")} ${daily} e folga ${daysOff} ${pluralIfMany(daysOff, "dia")} por semana.`,
  });

  if (!teamSize) {
    lines.push({ topic: "equipe", text: "Informe a equipe atual (passo 5) para calcular quantas pessoas são necessárias." });
  } else if (missing > 0) {
    lines.push({
      topic: "equipe",
      text: `Para cobrir os dias e horários informados, são necessárias ${requiredHeadcount} pessoas: ${missing} a mais do que a equipe atual de ${teamSize}.`,
    });
  } else {
    lines.push({ topic: "equipe", text: `A equipe atual de ${teamSize} ${pluralIfMany(teamSize, "pessoa")} cobre os dias e horários informados.` });
  }

  if (unmetHires > 0) {
    lines.push({ topic: "escala", text: `O simulador comporta até ${MAX_PEOPLE} pessoas: faltam ${unmetHires} e a escala não cobre todos os dias.` });
  } else if (hires > 0) {
    lines.push({ topic: "escala", text: `A escala abaixo já inclui ${hires} ${pluralIfMany(hires, "contratação sugerida", "contratações sugeridas")}.` });
  } else if (missing > 0 && !isCurrent && !state.includeHires) {
    lines.push({
      topic: "escala",
      text: "A escala abaixo mostra só a equipe atual. Marque “Incluir na escala as contratações necessárias” para ver a escala completa.",
    });
  }

  const cost = estimateCost(state, schedule);
  if (!cost) {
    lines.push({ topic: "custo", text: "Informe o salário médio em “Custo mensal da equipe” para ver o impacto na folha." });
  } else if (isCurrent) {
    lines.push({ topic: "custo", text: `Folha mensal estimada hoje: ${formatCurrency(cost.payroll)}.` });
  } else if (missing > 0) {
    const withHires = cost.payroll + cost.hiringCost;
    lines.push({
      topic: "custo",
      text: `Folha mensal estimada: ${formatCurrency(cost.payroll)} hoje e ${formatCurrency(withHires)} com as contratações (+${percent(((withHires - cost.payroll) / cost.payroll) * 100)}).`,
    });
  } else {
    lines.push({
      topic: "custo",
      text: `A folha continua em ${formatCurrency(cost.payroll)} por mês, mas cada hora trabalhada fica ${percent(cost.hourlyIncreasePercent)} mais cara.`,
    });
  }

  const violations = compliance.alerts.filter((alert) => alert.level === AlertLevel.VIOLATION).length;
  const gaps = compliance.alerts.some((alert) => [AlertCode.COVERAGE_GAP, AlertCode.SHIFT_GAP, AlertCode.HIRES_CAPPED].includes(alert.code));
  let tone = "ok";
  if (violations) {
    tone = "bad";
    lines.push({ topic: "regras", text: `A escala tem ${violations} ${pluralIfMany(violations, "ponto fora da regra", "pontos fora da regra")}: veja “Pontos de atenção”.` });
  } else if (gaps) {
    tone = "warn";
    lines.push({ topic: "regras", text: "Faltam pessoas em alguns dias ou turnos: veja “Pontos de atenção”." });
  } else {
    lines.push({ topic: "regras", text: "A escala está dentro das regras conferidas pelo simulador." });
  }

  const title = isCurrent ? "Hoje, na jornada de 44h" : `Na jornada de ${workload.weeklyLimitHours}h`;
  return { title, tone, lines };
}
