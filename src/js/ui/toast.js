/** Aviso flutuante temporário. */

import { escapeHtml } from "./dom.js";

const DURATION_MS = { bad: 9000, default: 6000 };

export function createToast(element) {
  let hideTimer;
  return function show({ level, title, text }) {
    element.className = "toast " + level;
    element.innerHTML = `<b>${escapeHtml(title)}</b><span class="small">${escapeHtml(text)}</span>`;
    element.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (element.hidden = true), DURATION_MS[level] || DURATION_MS.default);
  };
}
