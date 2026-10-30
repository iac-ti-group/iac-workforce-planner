/** Aviso fixo no topo da página (dados ajustados, modo seguro, falha ao salvar). */

/**
 * @param {HTMLElement} element  contêiner com #noticeTitle, #noticeText, #noticeList e #noticeActions
 */
export function createNotice(element) {
  const title = element.querySelector("[data-notice=title]");
  const text = element.querySelector("[data-notice=text]");
  const list = element.querySelector("[data-notice=list]");
  const actions = element.querySelector("[data-notice=actions]");

  /**
   * @param {{ level:"bad"|"warn"|"ok", title:string, text:string, items?:string[],
   *           actions?:{ label:string, primary?:boolean, onClick:()=>void }[] }} content
   */
  function show(content) {
    element.className = "notice " + content.level;
    title.textContent = content.title;
    text.textContent = content.text;
    list.replaceChildren(
      ...(content.items || []).map((item) => {
        const entry = document.createElement("li");
        entry.textContent = item;
        return entry;
      }),
    );
    list.hidden = !(content.items && content.items.length);
    actions.replaceChildren(
      ...(content.actions || []).map(({ label, primary, onClick }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = primary ? "btn pri" : "btn";
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
      }),
    );
    element.hidden = false;
  }

  function hide() {
    element.hidden = true;
  }

  return { show, hide };
}
