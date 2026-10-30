/** Modo app (celular): escala em cartões, mover folga com dois toques e resumo dos passos. */

import * as actions from "../../application/actions.js";
import { DAY_NAMES, SUNDAY } from "../../domain/calendar.js";
import { AlertCode, AlertLevel, cellId } from "../../domain/compliance.js";
import { overrideKey } from "../../domain/overrides.js";
import { formatClock, formatDuration } from "../../domain/time.js";
import { countWhere } from "../../shared/collections.js";
import { all, byId, dataInt, delegate, escapeHtml } from "../dom.js";
import { exceedsWeeklyLimit, sexBadge, weeklyHoursOf } from "../scheduleHelpers.js";

const BADGE_WARNING_CODES = [AlertCode.COVERAGE_GAP, AlertCode.SHIFT_GAP];

export function createMobileView(app) {
  const el = { schedule: byId("mesc"), badge: byId("mbadge") };
  /** Folga escolhida no primeiro toque: { personIndex, day } */
  let selection = null;

  function bindEvents() {
    delegate(byId("mfase"), "click", "button", (button) => {
      selection = null;
      app.dispatch(actions.setPhase, button.dataset.v);
    });
    delegate(el.schedule, "click", ".mx[data-i]", (button) => handleDayTap(dataInt(button, "i"), dataInt(button, "d")));
  }

  function handleDayTap(personIndex, day) {
    const { state, schedule } = app;
    const works = schedule.weeks[state.week][personIndex][day];
    const isSamePerson = selection && selection.personIndex === personIndex;

    if (isSamePerson && selection.day === day) {
      selection = null;
      render();
      return;
    }
    if (isSamePerson && works) {
      const fromDay = selection.day;
      selection = null;
      app.dispatch(actions.moveDayOff, schedule, personIndex, fromDay, day);
      app.notifyDayOffChange({ personIndex, day, worksNow: false, fromDay });
      return;
    }
    if (!works) {
      selection = { personIndex, day };
      render();
      return;
    }
    showShiftDetails(personIndex, day);
  }

  function showShiftDetails(personIndex, day) {
    const { state, schedule } = app;
    const person = schedule.roster[personIndex];
    const shift = schedule.assignmentsFor(state.week, day).get(personIndex);
    const shiftLabel = shift.shiftName ? shift.shiftName + ": " : "";
    const lunch =
      shift.lunchStart != null
        ? `, almoço ${formatClock(shift.lunchStart)}–${formatClock(shift.lunchStart + shift.breakMinutes)}`
        : "";
    app.toast({
      level: AlertLevel.OK,
      title: `${person.name} · ${DAY_NAMES[day]}`,
      text: `${shiftLabel}${formatClock(shift.start)} às ${formatClock(shift.end)}${lunch}. Para dar folga neste dia, toque numa folga de ${person.name} e depois aqui.`,
    });
  }

  function render() {
    const { state, schedule, compliance } = app;
    all("#mfase button").forEach((button) => button.setAttribute("aria-pressed", button.dataset.v === state.phase));

    const issueCount = countWhere(
      compliance.alerts,
      (alert) =>
        alert.level === AlertLevel.VIOLATION ||
        (alert.level === AlertLevel.WARNING && BADGE_WARNING_CODES.includes(alert.code)),
    );
    el.badge.textContent = issueCount;
    el.badge.hidden = !issueCount;

    const grid = schedule.weeks[state.week];
    const coverage = DAY_NAMES.map((name, day) => {
      if (!state.days[day].open) return `<div class="mc x"><b>${name}</b><span>—</span></div>`;
      const working = countWhere(grid, (row) => row[day]);
      const need = schedule.demand[day];
      return `<div class="mc ${working < need ? "bad" : ""}"><b>${name}</b><span>${working}/${need}</span></div>`;
    }).join("");

    const hint = selection
      ? `Agora toque no dia para onde vai a folga de <b>${escapeHtml(schedule.roster[selection.personIndex].name)}</b>. Toque na folga de novo para cancelar.`
      : "Toque numa <b>folga</b> e depois no dia para onde ela deve ir.";

    const cards = schedule.roster.length
      ? schedule.roster.map((person, index) => renderPersonCard(state, schedule, compliance, person, index)).join("")
      : `<p class="mempty"><b>Nenhuma pessoa na escala</b>Informe a equipe atual em Ajustes para montar a escala.</p>`;
    el.schedule.innerHTML = `<div class="mcov">${coverage}</div><p class="mhint">${hint}</p>${cards}`;
  }

  function renderPersonCard(state, schedule, compliance, person, index) {
    const week = state.week;
    const grid = schedule.weeks[week];
    const isSelectedPerson = selection && selection.personIndex === index;
    const days = DAY_NAMES.map((name, day) => {
      if (!state.days[day].open) return `<button class="mx x" disabled><i>${name[0]}</i>–</button>`;
      const error = compliance.cellErrors.has(cellId(index, week, day)) ? " err" : "";
      const manual = state.overrides[overrideKey(person, index, week, day)] !== undefined ? " man" : "";
      if (grid[index][day]) {
        const shift = schedule.assignmentsFor(week, day).get(index);
        const shiftClass = shift.shiftIndex ? " k" + shift.shiftIndex : "";
        const dropTarget = isSelectedPerson ? " tgt" : "";
        return `<button class="mx t${shiftClass}${error}${manual}${dropTarget}" data-i="${index}" data-d="${day}"><i>${name}</i><b>${formatClock(shift.start)}</b><small>${formatClock(shift.end)}</small></button>`;
      }
      const selected = isSelectedPerson && selection.day === day ? " sel" : "";
      return `<button class="mx f${error}${manual}${selected}" data-i="${index}" data-d="${day}"><i>${name}</i><b>Folga</b></button>`;
    }).join("");

    const hours = weeklyHoursOf(schedule, grid, index);
    const sundays = schedule.weeks.map((weekGrid) => (weekGrid[index][SUNDAY] ? "●" : "○")).join("");
    return `<div class="mp ${person.isHire ? "novo" : ""}"><div class="mph"><span class="sx ${person.sex}">${sexBadge(person.sex)}</span><b>${escapeHtml(person.name)}</b><span class="mh ${exceedsWeeklyLimit(schedule, hours) ? "bad" : ""}">${formatDuration(hours)}</span><span class="md" title="Domingos trabalhados nas 4 semanas">Dom ${sundays}</span></div><div class="mrow">${days}</div></div>`;
  }

  bindEvents();
  return { render };
}
