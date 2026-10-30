/** Executa um caso do golden a partir da entrada gravada (formato do localStorage v3). */

import { estimateCost } from "../../src/js/domain/cost.js";
import { evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { fromPersisted, toPersisted } from "../../src/js/infrastructure/stateRepository.js";
import { clone } from "../helpers.js";
import { snapshotCompliance, snapshotSchedule } from "../support/snapshot.js";

export function runCase(input) {
  const state = fromPersisted(clone(input));
  if (!state) throw new Error("Entrada do golden inválida");
  const schedule = buildSchedule(state);
  return {
    // Hoje o build normaliza o estado (turnos e demanda); o resultado precisa continuar idêntico quando isso for separado (E3).
    normalized: clone(toPersisted(state)),
    schedule: snapshotSchedule(schedule),
    compliance: snapshotCompliance(evaluateCompliance(state, schedule)),
    cost: estimateCost(state, schedule),
  };
}
