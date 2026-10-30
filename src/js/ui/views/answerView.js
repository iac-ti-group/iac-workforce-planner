/** Card "Resposta": a jornada escolhida em frases simples + as três jornadas lado a lado. */

import * as actions from "../../application/actions.js";
import { PHASE_LABEL, comparePhases, describeAnswer } from "../../application/answer.js";
import { formatDuration } from "../../domain/time.js";
import { formatCurrency } from "../../shared/format.js";
import { byId, delegate, escapeHtml } from "../dom.js";
import { statusIcon } from "../icons.js";

const TOPIC_LABEL = { rotina: "Rotina", equipe: "Equipe", escala: "Escala", custo: "Custo", regras: "Regras" };

export function createAnswerView(app) {
  const el = { card: byId("answer"), title: byId("answerTitle"), lines: byId("answerLines"), compare: byId("compare") };

  delegate(el.compare, "click", "[data-phase]", (button) => app.dispatch(actions.setPhase, button.dataset.phase));

  function render() {
    const { state, schedule, compliance } = app;
    const answer = describeAnswer(state, schedule, compliance);
    el.card.dataset.tone = answer.tone;
    el.title.innerHTML = `${statusIcon(answer.tone)}<span>${escapeHtml(answer.title)}</span>`;
    el.lines.innerHTML = answer.lines
      .map((line) => `<div class="answer-line" data-topic="${line.topic}"><dt>${TOPIC_LABEL[line.topic]}</dt><dd>${escapeHtml(line.text)}</dd></div>`)
      .join("");
    el.compare.innerHTML = renderComparison(comparePhases(state), state.phase);
  }

  return { render };
}

function renderComparison(rows, selectedPhase) {
  const hasCost = rows.some((row) => row.monthlyCost !== null);
  const cell = (row, content) => `<td class="${row.phase === selectedPhase ? "sel" : ""}">${content}</td>`;
  const line = (label, render) => `<tr><th scope="row">${label}</th>${rows.map((row) => cell(row, render(row))).join("")}</tr>`;

  const header = rows
    .map((row) => {
      const selected = row.phase === selectedPhase;
      return `<th scope="col" class="${selected ? "sel" : ""}"><button type="button" data-phase="${row.phase}" aria-pressed="${selected}">${PHASE_LABEL[row.phase]}</button>${selected ? `<span class="tag">Em exibição</span>` : ""}</th>`;
    })
    .join("");

  const body = [
    line("Jornada por dia", (row) => row.dailyLabel || formatDuration(row.dailyMinutes / 60)),
    line("Dias de trabalho na semana", (row) => row.workDays),
    line("Horas por semana", (row) => formatDuration(row.weeklyHours)),
    line("Pessoas necessárias", (row) => `<b>${row.required}</b>`),
    line("A contratar", (row) => (row.missing ? `<b class="up">+${row.missing}</b>` : `<span class="muted">nenhuma</span>`)),
    hasCost ? line("Folha mensal estimada", (row) => formatCurrency(row.monthlyCost)) : "",
  ].join("");

  const note = hasCost
    ? "Folha = salário + 75% de encargos + benefícios, já somando as contratações."
    : "Informe o salário médio em “Custo mensal da equipe” para comparar a folha.";
  return `<table class="compare"><caption class="sr-only">Comparação das jornadas de 44h, 42h e 40h</caption><thead><tr><th scope="col"><span class="sr-only">Item</span></th>${header}</tr></thead><tbody>${body}</tbody></table><p class="hint">${note} Pessoas necessárias para manter o atendimento informado nos passos ao lado.</p>`;
}
