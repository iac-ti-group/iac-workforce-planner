/** Confirmação explícita antes de ações que apagam ou substituem dados. */

/**
 * @param {HTMLDialogElement} dialog  com [data-confirm=title|text|ok|cancel]
 */
export function createConfirmDialog(dialog) {
  const title = dialog.querySelector("[data-confirm=title]");
  const text = dialog.querySelector("[data-confirm=text]");
  const ok = dialog.querySelector("[data-confirm=ok]");
  const cancel = dialog.querySelector("[data-confirm=cancel]");
  let resolveCurrent = null;

  const close = (confirmed) => {
    if (dialog.open) dialog.close();
    if (resolveCurrent) resolveCurrent(confirmed);
    resolveCurrent = null;
  };
  ok.addEventListener("click", () => close(true));
  cancel.addEventListener("click", () => close(false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault(); // Esc
    close(false);
  });

  /** @returns {Promise<boolean>} true somente se o usuário confirmar. */
  return function confirm({ title: heading, text: message, confirmLabel }) {
    if (resolveCurrent) close(false);
    title.textContent = heading;
    text.textContent = message;
    ok.textContent = confirmLabel;
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      dialog.showModal();
      cancel.focus();
    });
  };
}
