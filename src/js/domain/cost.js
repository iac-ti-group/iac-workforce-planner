/** Impacto financeiro da redução de jornada: custo da hora, horas perdidas e contratações. */

import { requiredHeadcount } from "./demand.js";
import {
  MONTHLY_HOURS_DIVISOR,
  OVERTIME_PREMIUM,
  PAYROLL_CHARGES_PERCENT,
  PHASES,
  Phase,
  WEEKS_PER_MONTH,
} from "./laborRules.js";
import { workloadFor } from "./workload.js";
import { countWhere } from "../shared/collections.js";

const CURRENT_DIVISOR = MONTHLY_HOURS_DIVISOR[Phase.CURRENT];
const percentIncrease = (divisor) => (CURRENT_DIVISOR / divisor - 1) * 100;

/**
 * @returns {null | {
 *   teamSize:number, costPerEmployee:number, payroll:number, targetPhase:string,
 *   hourlyCostToday:number, hourlyCostTarget:number, hourlyIncreasePercent:number,
 *   hoursLostPerMonth:number, costToKeepCoverage:number,
 *   missingHeadcount:number, hiringCost:number, overtimeCost:number,
 *   hourlyCostByPhase:{phase:string, hourlyCost:number, increasePercent:number}[]
 * }} null quando o salário não foi informado.
 */
export function estimateCost(state, schedule) {
  const salary = Number(state.salary) || 0;
  if (!salary) return null;

  const benefits = Number(state.benefits) || 0;
  const chargesFactor = 1 + PAYROLL_CHARGES_PERCENT / 100;
  const teamSize = schedule.teamSize;
  const costPerEmployee = salary * chargesFactor + benefits;

  // "Hoje" é comparado com a meta final de 40h; as outras fases, consigo mesmas.
  const targetPhase = state.phase === Phase.CURRENT ? Phase.FINAL : state.phase;
  const divisor = MONTHLY_HOURS_DIVISOR[targetPhase];
  const hourlyCostTarget = costPerEmployee / divisor;
  const hoursLostPerMonth = teamSize * (CURRENT_DIVISOR - divisor);

  const openDayCount = Math.max(1, countWhere(state.days, (day) => day.open));
  const targetWorkload = workloadFor(state, targetPhase, openDayCount);
  const required = state.phase === targetPhase ? schedule.requiredHeadcount : requiredHeadcount(state, targetWorkload);
  const missingHeadcount = Math.max(0, required - teamSize);
  const missingHoursPerMonth = missingHeadcount * targetWorkload.weeklyHours * WEEKS_PER_MONTH;

  return {
    teamSize,
    costPerEmployee,
    payroll: teamSize * costPerEmployee,
    targetPhase,
    hourlyCostToday: costPerEmployee / CURRENT_DIVISOR,
    hourlyCostTarget,
    hourlyIncreasePercent: percentIncrease(divisor),
    hoursLostPerMonth,
    costToKeepCoverage: hoursLostPerMonth * hourlyCostTarget,
    missingHeadcount,
    hiringCost: missingHeadcount * costPerEmployee,
    overtimeCost: missingHoursPerMonth * (salary / divisor) * OVERTIME_PREMIUM * chargesFactor,
    hourlyCostByPhase: PHASES.map((phase) => ({
      phase,
      hourlyCost: costPerEmployee / MONTHLY_HOURS_DIVISOR[phase],
      increasePercent: percentIncrease(MONTHLY_HOURS_DIVISOR[phase]),
    })),
  };
}
