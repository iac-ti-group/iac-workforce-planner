/** Ícones (traçados do Tabler Icons, MIT — mesma família usada no IAC System). */

const svg = (paths) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = Object.freeze({
  circleCheck: svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0"/><path d="m9 12 2 2 4-4"/>'),
  alertTriangle: svg(
    '<path d="M12 9v4"/><path d="M10.363 3.591 2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 16h.01"/>',
  ),
  circleX: svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0"/><path d="m10 10 4 4m0-4-4 4"/>'),
});

/** Ícone que acompanha o nível do aviso (o estado nunca depende só da cor). */
export const statusIcon = (level) =>
  level === "bad" ? ICONS.circleX : level === "warn" ? ICONS.alertTriangle : ICONS.circleCheck;
