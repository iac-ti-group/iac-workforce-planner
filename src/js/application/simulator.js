/**
 * Orquestra o ciclo da simulação: estado → escala → verificações → tela → gravação.
 * Cada alteração é uma transação: se o cálculo ou a tela falharem, o estado anterior volta e nada é gravado.
 */

import { evaluateCompliance } from "../domain/compliance.js";
import { buildSchedule } from "../domain/scheduler.js";
import { openSession } from "./persistence.js";

const snapshot = (state) => JSON.parse(JSON.stringify(state));

export function createSimulator(repository) {
  const session = openSession(repository);
  let state = session.state;
  let schedule = null;
  let compliance = null;

  const simulator = {
    session,
    get state() {
      return state;
    },
    get schedule() {
      return schedule;
    },
    get compliance() {
      return compliance;
    },
    /** Executa uma ação sobre o estado. Ações que devolvem um novo estado o substituem. */
    apply(action, ...args) {
      const replacement = action(state, ...args);
      if (replacement) state = replacement;
    },
    recalculate() {
      schedule = buildSchedule(state);
      compliance = evaluateCompliance(state, schedule);
    },
    /** @returns {boolean} true se gravou (false em modo seguro ou se o navegador recusou). */
    save() {
      return session.save(state);
    },
    /**
     * Aplica `change`, recalcula e redesenha com `render`. Em caso de erro, restaura o estado anterior.
     * @returns {{ ok: true, saved: boolean } | { ok: false, error: unknown }}
     */
    transact(change, render) {
      const previous = snapshot(state);
      try {
        change();
        simulator.recalculate();
        render();
      } catch (error) {
        state = previous;
        simulator.recalculate();
        render();
        return { ok: false, error };
      }
      return { ok: true, saved: simulator.save() };
    },
    /** Troca o estado inteiro (exemplo restaurado, dados apagados, modo seguro). */
    replaceState(next) {
      state = next;
    },
  };
  return simulator;
}
