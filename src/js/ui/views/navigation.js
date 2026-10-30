/** Navegação: abas do desktop, barra inferior do celular e passos recolhíveis com resumo. */

import * as actions from "../../application/actions.js";
import { DAY_NAMES, firstOpenDay } from "../../domain/calendar.js";
import { ActivityType, Sex } from "../../domain/laborRules.js";
import { hasOverrides } from "../../domain/overrides.js";
import { segmentAt } from "../../domain/segments.js";
import { formatDuration } from "../../domain/time.js";
import { countWhere } from "../../shared/collections.js";
import { all, byId, delegate } from "../dom.js";

export const MOBILE_TABS = ["ajustes", "escala", "custo", "regras"];
const DEFAULT_MOBILE_TAB = "ajustes";

export function createNavigation(app, mobileQuery) {
  function bindSectionTabs() {
    const tabs = all("nav.tabs button");
    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        tabs.forEach((other) => other.setAttribute("aria-selected", other === tab));
        byId("pane-sim").hidden = tab.dataset.tab !== "sim";
        byId("pane-regras").hidden = tab.dataset.tab !== "regras";
      }),
    );
  }

  function showMobileTab(tab) {
    const validTab = MOBILE_TABS.includes(tab) ? tab : DEFAULT_MOBILE_TAB;
    document.body.dataset.mtab = validTab;
    app.update(actions.setMobileTab, validTab);
    all("#mnav button").forEach((button) => button.setAttribute("aria-current", button.dataset.t === validTab ? "page" : "false"));
    window.scrollTo(0, 0);
  }

  /** No celular cada passo vira um acordeão: abrir um fecha os demais. */
  function makeStepsCollapsible() {
    all("aside.side .card").forEach((card, index) => {
      const step = card.querySelector(".step");
      if (!step) return;
      const summary = document.createElement("span");
      summary.className = "ssum";
      summary.id = "sum" + (index + 1);
      step.appendChild(summary);
      step.setAttribute("role", "button");
      step.tabIndex = 0;

      const toggle = () => {
        if (!mobileQuery.matches) return;
        const willOpen = !card.classList.contains("open");
        all("aside.side .card.open").forEach((openCard) => openCard.classList.remove("open"));
        if (willOpen) card.classList.add("open");
      };
      step.addEventListener("click", (event) => {
        if (!event.target.closest("button,input,select,a")) toggle();
      });
      step.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  /** Resumo de cada passo, visível com o acordeão fechado. */
  function renderStepSummaries() {
    const { state, schedule } = app;
    const openDays = DAY_NAMES.filter((_, day) => state.days[day].open);
    const women = countWhere(state.team, (person) => person.sex === Sex.FEMALE);
    const men = state.team.length - women;
    const seg = segmentAt(state.segmentIndex);
    const firstOpen = state.days[firstOpenDay(state.days)];
    const set = (step, text) => {
      const element = byId("sum" + step);
      if (element) element.textContent = text;
    };

    set(1, (seg ? seg.name : "Personalizado") + " · " + (state.activityType === ActivityType.COMMERCE ? "comércio" : "outras"));
    set(2, openDays.length === 7 ? "Todos os dias" : openDays.length ? openDays.join(", ") : "Nenhum dia");
    set(3, firstOpen ? `${firstOpen.opensAt} às ${firstOpen.closesAt}` : "—");
    set(4, `${formatDuration(state.lunchMinutes / 60)} às ${state.lunchStart}`);
    set(5, `${women} mulher${women === 1 ? "" : "es"} · ${men} home${men === 1 ? "m" : "ns"}`);
    set(
      6,
      schedule.usesShifts
        ? state.shiftHeadcount[0].map((people, shift) => (people ? `T${shift + 1}: ${people}` : "")).filter(Boolean).join(" · ")
        : firstOpen
          ? `${firstOpen.need} pessoas/dia`
          : "—",
    );
    set(7, hasOverrides(state) ? "com ajustes" : "opcional");
  }

  bindSectionTabs();
  makeStepsCollapsible();
  delegate(byId("mnav"), "click", "button", (button) => showMobileTab(button.dataset.t));
  byId("verEscala").addEventListener("click", () => showMobileTab("escala"));

  return { showMobileTab, renderStepSummaries };
}
