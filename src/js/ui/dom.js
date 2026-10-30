/** Helpers de DOM compartilhados pelas views. */

export const byId = (id) => document.getElementById(id);

export const all = (selector, root = document) => [...root.querySelectorAll(selector)];

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa qualquer valor antes de interpolá-lo em HTML. */
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** Um único listener no container atende todos os elementos (re)renderizados que casam com `selector`. */
export function delegate(container, eventName, selector, handler) {
  container.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target && container.contains(target)) handler(target, event);
  });
}

/** Lê um data-atributo numérico. */
export const dataInt = (element, name) => Number(element.dataset[name]);
