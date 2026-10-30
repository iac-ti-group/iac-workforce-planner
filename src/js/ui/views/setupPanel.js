/** Painel lateral de entradas: segmento, dias, horários, almoço, equipe e pessoas por dia/turno. */

import * as actions from "../../application/actions.js";
import { DAY_GROUPS, DAY_NAMES, firstOpenDay } from "../../domain/calendar.js";
import { ActivityType, DEFAULT_LUNCH_MINUTES, Sex } from "../../domain/laborRules.js";
import { LIMIT_MESSAGES, canAddTeamMember, canIncreaseDayDemand, canIncreaseShiftHeadcount } from "../../domain/limits.js";
import { CUSTOM_SEGMENT, SEGMENTS } from "../../domain/segments.js";
import { SHIFT_COUNT, shiftName } from "../../domain/shiftPlan.js";
import { formatClock, isClock, toMinutes } from "../../domain/time.js";
import { shiftSpan } from "../../domain/workload.js";
import { range, sum } from "../../shared/collections.js";
import { pluralIfMany } from "../../shared/text.js";
import { all, byId, dataInt, delegate, escapeHtml } from "../dom.js";
import { formatAmountInput, parseAmountInput } from "../../shared/format.js";

const SUNDAY_RULE_HINT = {
  [ActivityType.COMMERCE]: "Homens folgam ao menos 1 domingo a cada 3 semanas.",
  [ActivityType.OTHER]: "Homens folgam ao menos 1 domingo a cada 7 semanas.",
};

const counterButtons = (data, label, value) =>
  `<div class="mini"><button ${data} data-n="-1" aria-label="Menos pessoas ${label}">−</button><output>${value}</output><button ${data} data-n="1" aria-label="Mais pessoas ${label}">+</button></div>`;

const teamSizeText = (size) => `${size} ${pluralIfMany(size, "pessoa")}`;

const INVALID_CLOCK = { level: "warn", title: "Horário incompleto", text: "Informe hora e minutos (HH:MM). O horário anterior foi mantido." };

export function createSetupPanel(app) {
  const el = {
    segment: byId("segm"),
    dayChips: byId("dayrow"),
    groupHours: byId("func"),
    title: byId("sugTitle"),
    hint: byId("sugHint"),
    demand: byId("sug"),
    shifts: byId("tn"),
    restoreShifts: byId("tnAuto"),
    activityHint: byId("tipoHint"),
    women: byId("cF"),
    men: byId("cM"),
    dayHours: byId("days"),
    lunchMinutes: byId("almDur"),
    lunchStart: byId("almIni"),
    includeHires: byId("contratar"),
    salary: byId("sal"),
    benefits: byId("ben"),
  };

  /** Executa a ação só se `allowed`; senão explica o limite ao usuário. */
  const dispatchWithin = (allowed, message, action, ...args) => {
    if (allowed) app.dispatch(action, ...args);
    else app.toast({ level: "warn", ...message });
  };
  const dispatchClock = (value, action, ...args) => {
    if (!isClock(value)) app.toast(INVALID_CLOCK);
    app.dispatch(action, ...args, value); // horário inválido: a ação recusa e a tela volta ao valor anterior
  };

  function bindEvents() {
    const { dispatch } = app;
    el.segment.addEventListener("change", (event) => dispatch(actions.selectSegment, Number(event.target.value)));
    delegate(byId("tipo"), "click", "button", (button) => dispatch(actions.setActivityType, button.dataset.v));
    all(".stepper button").forEach((button) =>
      button.addEventListener("click", () => {
        const adding = dataInt(button, "d") > 0;
        dispatchWithin(!adding || canAddTeamMember(app.state), LIMIT_MESSAGES.team,
          adding ? actions.addTeamMember : actions.removeTeamMember, button.dataset.c);
      }),
    );
    delegate(byId("modelos"), "click", ".modelo", (button) => dispatch(actions.applyWorkModel, button.dataset.m));
    el.lunchMinutes.addEventListener("change", (event) => dispatch(actions.setLunchMinutes, Number(event.target.value)));
    el.lunchStart.addEventListener("change", (event) => dispatchClock(event.target.value, actions.setLunchStart));
    el.restoreShifts.addEventListener("click", () => dispatch(actions.restoreSuggestedShifts));
    byId("needAuto").addEventListener("click", () => dispatch(actions.restoreSuggestedDemand));
    el.includeHires.addEventListener("change", (event) => dispatch(actions.setIncludeHires, event.target.checked));
    bindAmountInput(el.salary, actions.setSalary, (state) => state.salary);
    bindAmountInput(el.benefits, actions.setBenefits, (state) => state.benefits);

    delegate(el.dayChips, "click", ".dchip", (chip) => dispatch(actions.toggleBusinessDay, dataInt(chip, "k")));
    delegate(el.groupHours, "change", "input", (input) =>
      dispatchClock(input.value, actions.setGroupHours, DAY_GROUPS[dataInt(input, "g")].days, input.dataset.field),
    );
    delegate(el.demand, "click", ".mini button", (button) => {
      const day = dataInt(button, "k");
      const delta = dataInt(button, "n");
      dispatchWithin(delta < 0 || canIncreaseDayDemand(app.state, day), LIMIT_MESSAGES.demand, actions.changeDayDemand, day, delta);
    });
    delegate(el.shifts, "click", ".mini button", (button) => {
      const group = dataInt(button, "g");
      const delta = dataInt(button, "n");
      dispatchWithin(delta < 0 || canIncreaseShiftHeadcount(app.state, group), LIMIT_MESSAGES.demand,
        actions.changeShiftHeadcount, group, dataInt(button, "j"), delta);
    });
    delegate(el.shifts, "change", "input[type=time]", (input) => dispatchClock(input.value, actions.setShiftStart, dataInt(input, "j")));
    delegate(el.dayHours, "change", "input[type=time]", (input) =>
      dispatchClock(input.value, actions.setDayHours, dataInt(input, "k"), input.dataset.field),
    );
  }

  /** Valores em reais: atualiza só o custo enquanto digita e formata ao sair do campo. */
  function bindAmountInput(input, action, read) {
    input.addEventListener("input", () => {
      app.update(action, parseAmountInput(input.value));
      app.renderCost();
    });
    input.addEventListener("blur", () => {
      const value = read(app.state);
      input.value = value ? formatAmountInput(value) : "";
    });
  }

  function renderSegmentOptions() {
    const options = SEGMENTS.map((seg, index) => [seg.name, index])
      .sort(([a], [b]) => a.localeCompare(b, "pt"))
      .map(([name, index]) => `<option value="${index}">${escapeHtml(name)}</option>`);
    el.segment.innerHTML = options.join("") + `<option value="${CUSTOM_SEGMENT}">Outro (ajustar manualmente)</option>`;
  }

  function render() {
    const { state, schedule } = app;
    el.segment.value = state.segmentIndex;
    renderDayChips(state);
    renderGroupHours(state);
    if (schedule.usesShifts) renderShiftTable(state, schedule);
    else renderDemandPerDay(state);
    el.demand.hidden = schedule.usesShifts;
    el.shifts.hidden = !schedule.usesShifts;

    all("#tipo button").forEach((button) => button.setAttribute("aria-pressed", button.dataset.v === state.activityType));
    el.activityHint.textContent = SUNDAY_RULE_HINT[state.activityType];
    el.women.textContent = state.team.filter((person) => person.sex === Sex.FEMALE).length;
    el.men.textContent = state.team.filter((person) => person.sex === Sex.MALE).length;
    renderDayHours(state);
    all("#modelos .modelo").forEach((button) => button.setAttribute("aria-pressed", button.dataset.m === state.workModel));
    el.lunchMinutes.value = state.lunchMinutes || DEFAULT_LUNCH_MINUTES;
    el.lunchStart.value = state.lunchStart;
    el.includeHires.checked = state.includeHires;
    el.salary.value = state.salary ? formatAmountInput(state.salary) : "";
    el.benefits.value = state.benefits ? formatAmountInput(state.benefits) : "";
  }

  function renderDayChips(state) {
    el.dayChips.innerHTML = state.days
      .map(
        (day, index) =>
          `<button class="dchip" data-k="${index}" aria-pressed="${day.open}" aria-label="${DAY_NAMES[index]}: ${day.open ? "aberto" : "fechado"}">${DAY_NAMES[index]}</button>`,
      )
      .join("");
  }

  function renderGroupHours(state) {
    el.groupHours.innerHTML = DAY_GROUPS.map((group, groupIndex) => {
      const isOpen = group.days.some((day) => state.days[day].open);
      const reference = state.days[firstOpenDay(state.days, group.days) ?? group.days[0]];
      const disabled = isOpen ? "" : "disabled";
      const timeField = (field, label, prefix) =>
        `<div><label class="l" for="${prefix}${groupIndex}">${label}</label><input type="time" id="${prefix}${groupIndex}" data-g="${groupIndex}" data-field="${field}" value="${escapeHtml(reference[field])}" ${disabled}></div>`;
      return `<div class="fr ${isOpen ? "" : "off"}"><b>${group.fullName}</b>
      ${timeField("opensAt", "Abre", "fa")}
      ${timeField("closesAt", "Fecha", "ff")}</div>`;
    }).join("");
  }

  function renderDemandPerDay(state) {
    const teamSize = state.team.length;
    el.title.textContent = "Pessoas por dia";
    el.restoreShifts.hidden = state.autoDemand;
    el.hint.textContent = teamSize
      ? `Sugestão para a equipe de ${teamSizeText(teamSize)}. Ajuste com − e + quantas pessoas trabalham em cada dia.`
      : "Adicione pessoas na equipe para ver a sugestão.";
    el.demand.innerHTML = state.days
      .map((day, index) =>
        day.open
          ? `<div><b>${DAY_NAMES[index]}</b><span>${escapeHtml(day.opensAt)} às ${escapeHtml(day.closesAt)}</span>${counterButtons(`data-k="${index}"`, DAY_NAMES[index], day.need)}</div>`
          : `<div class="closed"><b>${DAY_NAMES[index]}</b><span>fechado</span><em></em></div>`,
      )
      .join("");
  }

  function renderShiftTable(state, schedule) {
    const teamSize = state.team.length;
    const headcount = state.shiftHeadcount;
    el.title.textContent = "Turnos da equipe";
    el.restoreShifts.hidden = state.autoShifts && state.shiftStarts.every((shift) => shift.auto);

    const referenceDay = firstOpenDay(state.days) ?? 0;
    const span = shiftSpan(state, schedule.workload.minutesOnDay(referenceDay));
    const groupIsOpen = (group) => group.days.some((day) => state.days[day].open);

    const rows = range(SHIFT_COUNT).map((shift) => {
      const start = state.shiftStarts[shift].start;
      const isUsed = headcount.some((row) => row[shift] > 0);
      const cells = DAY_GROUPS.map((group, groupIndex) =>
        groupIsOpen(group)
          ? `<td>${counterButtons(`data-g="${groupIndex}" data-j="${shift}"`, `turno ${shift + 1} ${group.name}`, headcount[groupIndex][shift] || 0)}</td>`
          : `<td class="na">fechado</td>`,
      ).join("");
      return `<tr class="${isUsed ? "" : "unused"}"><td class="tnm"><b><i class="kc${shift}"></i>${shiftName(shift)}</b></td>
      <td class="thr"><input type="time" id="ti${shift}" data-j="${shift}" value="${escapeHtml(start)}" aria-label="Início do turno ${shift + 1}"><small>até ${formatClock(toMinutes(start) + span)}</small></td>
      ${cells}</tr>`;
    });
    const totals = DAY_GROUPS.map((group, groupIndex) =>
      groupIsOpen(group) ? `<td class="tt">${sum(headcount[groupIndex])}</td>` : `<td class="na"></td>`,
    ).join("");

    el.shifts.innerHTML =
      `<thead><tr><th class="tl2">Turno</th><th class="tl2">Horário</th>${DAY_GROUPS.map((group) => `<th>${group.name}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.join("")}</tbody>` +
      `<tfoot><tr><td class="tnm"><b>Por dia</b></td><td></td>${totals}</tr></tfoot>`;

    const suggestion = state.autoShifts ? ` Números sugeridos para a equipe de ${teamSizeText(teamSize)}.` : "";
    el.hint.textContent = `Escolha a entrada de cada turno e quantas pessoas trabalham nele. A saída acompanha a jornada e o almoço. Coloque 0 no turno que não usar.${suggestion}`;
  }

  function renderDayHours(state) {
    el.dayHours.innerHTML = state.days
      .map(
        (day, index) => `<tr class="${day.open ? "" : "closed"}">
    <td class="dl">${DAY_NAMES[index]}</td>
    <td><input type="time" id="a${index}" data-k="${index}" data-field="opensAt" value="${escapeHtml(day.opensAt)}" aria-label="Abre ${DAY_NAMES[index]}"></td>
    <td><input type="time" id="f${index}" data-k="${index}" data-field="closesAt" value="${escapeHtml(day.closesAt)}" aria-label="Fecha ${DAY_NAMES[index]}"></td>
    </tr>`,
      )
      .join("");
  }

  renderSegmentOptions();
  bindEvents();
  return { render };
}
