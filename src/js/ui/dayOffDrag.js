/** Arrastar uma folga para outro dia trabalhado da mesma pessoa, na mesma semana. */

const DRAG_THRESHOLD_PX = 6;
const CLICK_SUPPRESSION_MS = 300;

/**
 * @param {{ rosterName:(personIndex:number)=>string, onDrop:(personIndex:number, fromDay:number, toDay:number)=>void }} options
 */
export function createDayOffDrag({ rosterName, onDrop }) {
  let drag = null;
  let suppressClick = false;

  function start(event, cell) {
    if (event.button > 0) return;
    drag = {
      personIndex: Number(cell.dataset.i),
      fromDay: Number(cell.dataset.d),
      startX: event.clientX,
      startY: event.clientY,
      cell,
      moved: false,
      target: null,
      ghost: null,
    };
    cell.setPointerCapture(event.pointerId);
    cell.addEventListener("pointermove", move);
    cell.addEventListener("pointerup", end);
    cell.addEventListener("pointercancel", end);
  }

  function beginMoving() {
    drag.moved = true;
    drag.cell.classList.add("src");
    drag.cell.closest("tr").classList.add("dragrow");
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    ghost.textContent = "Folga · " + rosterName(drag.personIndex);
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }

  function move(event) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      beginMoving();
    }
    drag.ghost.style.left = event.clientX + "px";
    drag.ghost.style.top = event.clientY + "px";

    const hovered = document.elementFromPoint(event.clientX, event.clientY);
    const workCell = hovered && hovered.closest(".cell.t[data-i]");
    const target = workCell && Number(workCell.dataset.i) === drag.personIndex ? workCell : null;
    if (drag.target && drag.target !== target) drag.target.classList.remove("drop");
    drag.target = target;
    if (target) target.classList.add("drop");
  }

  function end(event) {
    if (!drag) return;
    const finished = drag;
    drag = null;
    finished.cell.removeEventListener("pointermove", move);
    finished.cell.removeEventListener("pointerup", end);
    finished.cell.removeEventListener("pointercancel", end);
    if (finished.ghost) finished.ghost.remove();
    if (!finished.moved) return;

    suppressClick = true;
    setTimeout(() => (suppressClick = false), CLICK_SUPPRESSION_MS);
    finished.cell.classList.remove("src");
    const row = finished.cell.closest("tr");
    if (row) row.classList.remove("dragrow");

    if (!finished.target || event.type === "pointercancel") {
      if (finished.target) finished.target.classList.remove("drop");
      return;
    }
    onDrop(finished.personIndex, finished.fromDay, Number(finished.target.dataset.d));
  }

  /** O clique que encerra um arraste não deve inverter a célula de origem. */
  function consumeSuppressedClick() {
    if (!suppressClick) return false;
    suppressClick = false;
    return true;
  }

  return { start, consumeSuppressedClick };
}
