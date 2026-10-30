/** Cartão de custo mensal da equipe. */

import { estimateCost } from "../../domain/cost.js";
import { Phase } from "../../domain/laborRules.js";
import { byId } from "../dom.js";
import { formatCurrency, formatCurrencyCents, formatIncrease, formatInteger } from "../../shared/format.js";

export function createCostView(app) {
  const summary = byId("cres");
  const notes = byId("cobs");

  function render() {
    if (!app.schedule) return;
    const cost = estimateCost(app.state, app.schedule);
    if (!cost) {
      summary.innerHTML = `<p class="small muted">Informe o salário médio, por exemplo 2.150,00, para ver o custo.</p>`;
      notes.innerHTML = "";
      return;
    }
    summary.innerHTML = renderSummary(cost);
    notes.innerHTML = renderExplanation(cost, app.state.phase === Phase.CURRENT);
  }

  return { render };
}

function renderSummary(cost) {
  const { missingHeadcount: missing } = cost;
  const hiring = missing
    ? `<span class="v up">+${formatCurrency(cost.hiringCost)}<small>/mês</small></span><span class="small muted">hora extra custaria ${formatCurrency(cost.overtimeCost)}</span>`
    : `<span class="v dn">Nenhuma</span><span class="small muted">a equipe cobre a escala</span>`;
  const phaseStrip = cost.hourlyCostByPhase
    .map(
      ({ phase, hourlyCost, increasePercent }) =>
        `<span class="${phase === cost.targetPhase ? "on" : ""}"><b>${phase}h</b> ${formatCurrencyCents(hourlyCost)}${phase !== Phase.CURRENT ? ` <em>${formatIncrease(increasePercent)}</em>` : ""}</span>`,
    )
    .join("");

  return `
    <div class="cres">
      <div><span class="k">Custo da equipe hoje</span><span class="v">${formatCurrency(cost.payroll)}<small>/mês</small></span><span class="small muted">${cost.teamSize} pessoas × ${formatCurrency(cost.costPerEmployee)}</span></div>
      <div><span class="k">Custo real da hora</span><span class="v">${formatCurrencyCents(cost.hourlyCostToday)} → <b class="up">${formatCurrencyCents(cost.hourlyCostTarget)}</b></span><span class="small muted">${formatIncrease(cost.hourlyIncreasePercent)} na escala de ${cost.targetPhase}h</span></div>
      <div><span class="k">Sem contratar</span><span class="v up">+${formatCurrency(cost.costToKeepCoverage)}<small>/mês</small></span><span class="small muted">para repor ${formatInteger(cost.hoursLostPerMonth)}h a menos</span></div>
      <div><span class="k">${missing ? `Contratando ${missing}` : "Contratações"}</span>${hiring}</div>
    </div>
    <div class="hstrip">${phaseStrip}<span class="lb">custo real por hora trabalhada</span></div>`;
}

function renderExplanation(cost, isCurrentPhase) {
  const missing = cost.missingHeadcount;
  const hiringNote = missing
    ? `; cobrindo toda a escala com ${missing} contrataç${missing > 1 ? "ões" : "ão"}, o aumento é de ${formatCurrency(cost.hiringCost)} por mês`
    : "";
  const phaseNote = isCurrentPhase ? " Valores da escala de 40h; escolha 42h no topo para ver a transição." : "";
  return `<div class="al warn"><b>Mesmo sem contratar, o custo aumenta</b><span class="small">O salário não muda, mas a equipe trabalha ${formatInteger(cost.hoursLostPerMonth)} horas a menos por mês e cada hora fica ${formatIncrease(cost.hourlyIncreasePercent).slice(1)} mais cara. Manter o mesmo atendimento de hoje custa cerca de ${formatCurrency(cost.costToKeepCoverage)} a mais por mês (${formatCurrency(cost.costToKeepCoverage * 12)} por ano)${hiringNote}.${phaseNote}</span></div>`;
}
