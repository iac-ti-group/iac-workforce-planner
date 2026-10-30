/** Área principal (desktop): fases, indicadores, grade da escala e avisos. */

import * as actions from "../../application/actions.js";
import { weekSummaryText } from "../../application/weekSummary.js";
import { DAY_NAMES, DAYS_PER_WEEK, SIMULATED_WEEKS, SUNDAY } from "../../domain/calendar.js";
import { cellId } from "../../domain/compliance.js";
import { Phase, Sex } from "../../domain/laborRules.js";
import { MAX_NAME_LENGTH } from "../../domain/limits.js";
import { hasOverrides, overrideKey } from "../../domain/overrides.js";
import { formatClock, formatDuration } from "../../domain/time.js";
import { breakMinutes, workloadFor } from "../../domain/workload.js";
import { countWhere, range } from "../../shared/collections.js";
import { pluralIfMany } from "../../shared/text.js";
import { all, byId, dataInt, delegate, escapeHtml } from "../dom.js";
import { createDayOffDrag } from "../dayOffDrag.js";
import { statusIcon } from "../icons.js";
import { SEX_TITLE, exceedsWeeklyLimit, sexBadge, weeklyHoursOf } from "../scheduleHelpers.js";

const MAX_ALERTS_SHOWN = 8;
const COPY_FEEDBACK_MS = 2200;

export function createScheduleView(app) {
  const el = {
    includeHires: byId("contratar"),
    undo: byId("undo"),
    kpis: byId("kpis"),
    weeks: byId("weeks"),
    grid: byId("esc"),
    alerts: byId("alerts"),
    copy: byId("copy"),
  };

  const drag = createDayOffDrag({
    rosterName: (personIndex) => app.schedule.roster[personIndex].name,
    onDrop: (personIndex, fromDay, toDay) => {
      app.dispatch(actions.moveDayOff, app.schedule, personIndex, fromDay, toDay);
      app.notifyDayOffChange({ personIndex, day: toDay, worksNow: false, fromDay });
    },
  });

  function bindEvents() {
    const { dispatch } = app;
    delegate(byId("fases"), "click", ".fase", (button) => dispatch(actions.setPhase, button.dataset.v));
    el.undo.addEventListener("click", () => dispatch(actions.undoManualAdjustments));
    byId("exemplo").addEventListener("click", () => dispatch(actions.loadExample));
    byId("clearData").addEventListener("click", () => app.requestClearSavedData());
    el.copy.addEventListener("click", copyWeek);
    delegate(el.weeks, "click", "button", (button) => {
      app.update(actions.selectWeek, dataInt(button, "w"));
      app.renderResults();
    });

    delegate(el.grid, "click", ".cell[data-i]", (cell) => {
      if (drag.consumeSuppressedClick()) return;
      const personIndex = dataInt(cell, "i");
      const day = dataInt(cell, "d");
      dispatch(actions.toggleWorkday, app.schedule, personIndex, day);
      const worksNow = app.schedule.weeks[app.state.week][personIndex][day];
      app.notifyDayOffChange({ personIndex, day, worksNow });
    });
    delegate(el.grid, "pointerdown", ".cell.f[data-i]", (cell, event) => drag.start(event, cell));
    delegate(el.grid, "click", ".sx[data-i]", (button) => dispatch(actions.toggleSex, dataInt(button, "i")));
    delegate(el.grid, "change", "td.nm input", (input) =>
      dispatch(actions.renamePerson, app.schedule, dataInt(input, "i"), input.value),
    );
    delegate(el.alerts, "click", "[data-more]", () => {
      showAllAlerts = true;
      el.alerts.innerHTML = renderAlerts(app.compliance.alerts, showAllAlerts);
    });
  }

  /** Avisos além dos primeiros só aparecem quando o usuário pede (não somem sem aviso). */
  let showAllAlerts = false;

  async function copyWeek() {
    try {
      await navigator.clipboard.writeText(weekSummaryText(app.state, app.schedule));
      el.copy.textContent = "Copiado! Cole no WhatsApp";
    } catch {
      el.copy.textContent = "Não foi possível copiar";
    }
    setTimeout(() => (el.copy.textContent = "Copiar semana"), COPY_FEEDBACK_MS);
  }

  function render() {
    const { state, schedule, compliance } = app;
    const isCurrentPhase = state.phase === Phase.CURRENT;
    all("#fases .fase").forEach((button) => button.setAttribute("aria-pressed", button.dataset.v === state.phase));
    el.includeHires.disabled = isCurrentPhase;
    el.includeHires.parentElement.style.opacity = isCurrentPhase ? 0.45 : 1;
    el.undo.hidden = !hasOverrides(state);
    el.kpis.innerHTML = renderKpis(state, schedule);
    el.weeks.innerHTML = range(SIMULATED_WEEKS)
      .map(
        (week) =>
          compliance.weeksWithIssues.has(week)
            ? `<button data-w="${week}" aria-pressed="${week === state.week}" class="has-bad" aria-label="Semana ${week + 1}, com pontos de atenção" title="Esta semana tem pontos de atenção">Semana ${week + 1}</button>`
            : `<button data-w="${week}" aria-pressed="${week === state.week}" class="">Semana ${week + 1}</button>`,
      )
      .join("");
    el.grid.innerHTML = renderGrid(state, schedule, compliance);
    el.alerts.innerHTML = renderAlerts(compliance.alerts, showAllAlerts);
  }

  bindEvents();
  return { render };
}

function renderKpis(state, schedule) {
  const { workload, requiredHeadcount, teamSize } = schedule;
  const missing = Math.max(0, requiredHeadcount - teamSize);
  const isCurrentPhase = state.phase === Phase.CURRENT;
  const openDayCount = Math.max(1, countWhere(state.days, (day) => day.open));
  const currentWorkload = workloadFor(state, Phase.CURRENT, openDayCount);
  const women = countWhere(state.team, (person) => person.sex === Sex.FEMALE);
  const men = countWhere(state.team, (person) => person.sex === Sex.MALE);
  const daysOff = DAYS_PER_WEEK - workload.workDays;

  const neededClass = isCurrentPhase ? "" : missing ? "bad" : "ok";
  const neededText = isCurrentPhase ? "na escala atual" : missing ? `faltam ${missing} para cobrir tudo` : "a equipe atual dá conta";
  const lunch = formatDuration(breakMinutes(state, workload.dailyMinutes) / 60);

  return `
    <div class="kpi"><span class="k">Equipe hoje</span><span class="v">${teamSize}</span><span class="d">${women} mulheres · ${men} homens</span></div>
    <div class="kpi ${neededClass}"><span class="k">Pessoas necessárias</span><span class="v">${requiredHeadcount}</span><span class="d">${neededText}</span></div>
    <div class="kpi hl"><span class="k">Jornada por dia</span><span class="v">${workload.label || formatDuration(workload.dailyMinutes / 60)}</span><span class="d">${workload.workDays} dias + ${daysOff} ${pluralIfMany(daysOff, "folga")} · almoço ${lunch} · saída = entrada + ${formatDuration(schedule.span / 60)}</span></div>
    <div class="kpi"><span class="k">Horas por semana</span><span class="v">${formatDuration(workload.weeklyHours)}</span><span class="d">antes: ${formatDuration(currentWorkload.weeklyHours)} · limite ${workload.weeklyLimitHours}h</span></div>`;
}

function renderGrid(state, schedule, compliance) {
  if (!schedule.roster.length) {
    return `<tbody><tr><td class="empty"><b>Nenhuma pessoa na escala</b><span>Informe a equipe atual no passo 5 para montar a escala.</span></td></tr></tbody>`;
  }
  const week = state.week;
  const grid = schedule.weeks[week];
  const header = `<tr><th class="nm">Pessoa</th>${DAY_NAMES.map((name, day) => `<th class="${day === SUNDAY ? "dom" : ""}">${name}</th>`).join("")}<th>Horas</th><th title="Domingos nas 4 semanas">Dom.</th></tr>`;

  const rows = schedule.roster.map((person, index) => {
    const name = escapeHtml(person.name);
    const cells = DAY_NAMES.map((dayName, day) => {
      if (!state.days[day].open) return `<td><div class="cell x">fechado</div></td>`;
      const manual = state.overrides[overrideKey(person, index, week, day)] !== undefined ? " man" : "";
      const error = compliance.cellErrors.has(cellId(index, week, day)) ? " err" : "";
      if (!grid[index][day]) {
        return `<td><button class="cell f${manual}${error}" data-i="${index}" data-d="${day}" aria-label="${name} ${dayName}: folga, trocar para trabalho">Folga</button></td>`;
      }
      const shift = schedule.assignmentsFor(week, day).get(index);
      const shiftClass = shift.shiftIndex ? " k" + shift.shiftIndex : "";
      const shiftLabel = shift.shiftName ? " no turno " + shift.shiftName : "";
      // Na célula só cabe o início do almoço; o intervalo completo vai na dica e no leitor de tela.
      const lunchRange =
        shift.lunchStart != null
          ? `almoço ${formatClock(shift.lunchStart)}–${formatClock(shift.lunchStart + shift.breakMinutes)}`
          : "";
      const lunch = lunchRange ? `<i>alm. ${formatClock(shift.lunchStart)}</i>` : "";
      const details = [shift.shiftName, `${formatClock(shift.start)} às ${formatClock(shift.end)}`, lunchRange].filter(Boolean).join(" · ");
      return `<td><button class="cell t${manual}${error}${shiftClass}" data-i="${index}" data-d="${day}" title="${details}" aria-label="${name} ${dayName}: trabalha${shiftLabel}${lunchRange ? ", " + lunchRange : ""}, trocar para folga"><b>${formatClock(shift.start)}</b><span>às ${formatClock(shift.end)}</span>${lunch}</button></td>`;
    }).join("");

    const hours = weeklyHoursOf(schedule, grid, index);
    const sundays = schedule.weeks.map((weekGrid) => `<i class="${weekGrid[index][SUNDAY] ? "w" : ""}"></i>`).join("");
    return `<tr class="${person.isHire ? "novo" : ""}"><td class="nm"><button class="sx ${person.sex}" data-i="${index}" title="${SEX_TITLE[person.sex]}" ${person.isHire ? "disabled" : ""}>${sexBadge(person.sex)}</button><input type="text" id="nm${escapeHtml(person.id || index)}" value="${name}" data-i="${index}" maxlength="${MAX_NAME_LENGTH}" aria-label="Nome"></td>${cells}<td class="h ${exceedsWeeklyLimit(schedule, hours) ? "bad" : ""}">${formatDuration(hours)}</td><td><div class="doms">${sundays}</div></td></tr>`;
  }).join("");

  const coverage = DAY_NAMES.map((_, day) => {
    if (!state.days[day].open) return "<td></td>";
    const working = countWhere(grid, (row) => row[day]);
    const need = schedule.demand[day];
    return `<td class="${working < need ? "falta" : "okc"}">${working} / ${need}</td>`;
  }).join("");

  return `<thead>${header}</thead><tbody>${rows}<tr class="cob"><td class="nm">Trabalhando / precisa</td>${coverage}<td></td><td></td></tr></tbody>`;
}

function renderAlerts(alerts, showAll) {
  const visible = showAll ? alerts : alerts.slice(0, MAX_ALERTS_SHOWN);
  const items = visible
    .map(
      (alert) =>
        `<div class="al ${alert.level}">${statusIcon(alert.level)}<b>${escapeHtml(alert.title)}</b><span class="small">${escapeHtml(alert.detail)}</span></div>`,
    )
    .join("");
  const remaining = alerts.length - visible.length;
  return items + (remaining > 0 ? `<button type="button" class="btn more" data-more>Ver mais ${remaining} ${pluralIfMany(remaining, "aviso")}</button>` : "");
}
