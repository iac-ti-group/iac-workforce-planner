/**
 * Política de persistência da sessão: decide o que carregar, quando é seguro gravar e como recuperar.
 *
 * Garantias:
 * - Dados que precisaram de correção ou são inutilizáveis ganham uma cópia de segurança ANTES de
 *   qualquer gravação. Se a cópia falhar, a sessão fica somente leitura e nada é sobrescrito.
 * - Dados inutilizáveis abrem o exemplo em modo seguro (sem gravar) até o usuário confirmar.
 * - A chave da versão anterior (v3) nunca é escrita: ela própria é a cópia dos dados antigos.
 */

import { createExampleState } from "../domain/simulationState.js";
import { decodeStoredState } from "../infrastructure/stateRepository.js";

export const LoadStatus = Object.freeze({
  EMPTY: "empty", // primeira visita
  OK: "ok",
  MIGRATED: "migrated", // lido da chave v3, será gravado na v4
  REPAIRED: "repaired", // carregado com correções relatadas
  INVALID: "invalid", // inutilizável: exemplo em modo seguro
});

/**
 * @param {ReturnType<import("../infrastructure/stateRepository.js").createLocalStorageRepository>} repository
 */
export function openSession(repository) {
  const record = repository.loadRecord();
  const session = {
    status: LoadStatus.EMPTY,
    issues: [],
    source: record.source,
    originalText: record.text,
    /** Uma cópia do texto original já foi guardada (ou não é necessária). */
    backedUp: record.source !== "v4",
    writable: true,
    state: null,
  };

  if (record.text === null) {
    session.state = createExampleState();
    return finish(session);
  }

  const { state, issues } = decodeStoredState(record.text);
  session.issues = issues;
  if (!state) {
    session.status = LoadStatus.INVALID;
    session.state = createExampleState();
    session.writable = false;
    return finish(session);
  }

  session.state = state;
  if (issues.length) {
    session.status = LoadStatus.REPAIRED;
    if (!session.backedUp) session.backedUp = repository.backup(record.text);
    session.writable = session.backedUp;
  } else {
    session.status = record.source === "v3" ? LoadStatus.MIGRATED : LoadStatus.OK;
  }
  return finish(session);

  function finish(result) {
    return operations(repository, result);
  }
}

function operations(repository, session) {
  /** Garante a cópia do conteúdo atual da v4 antes de sobrescrevê-lo. */
  const ensureBackupOfCurrent = () => {
    const current = repository.readCurrent();
    return current === null || repository.backup(current);
  };

  return {
    /** Grava se a sessão permitir. @returns {boolean} true se gravou. */
    save(state) {
      return session.writable ? repository.save(state) : false;
    },

    /** Usuário confirmou: sai do modo seguro começando pelo exemplo. */
    restoreExample() {
      if (!session.backedUp && !ensureBackupOfCurrent()) return { ok: false };
      session.backedUp = true;
      session.writable = true;
      session.status = LoadStatus.OK;
      session.issues = [];
      const state = createExampleState();
      return repository.save(state) ? { ok: true, state } : { ok: false };
    },

    /** Usuário confirmou: apaga os dados salvos (com cópia) e volta ao exemplo. A v3 é preservada. */
    clearSavedData() {
      if (!ensureBackupOfCurrent()) return { ok: false };
      session.backedUp = true;
      session.writable = true;
      session.status = LoadStatus.OK;
      session.issues = [];
      const state = createExampleState();
      return repository.save(state) ? { ok: true, state } : { ok: false };
    },

    /** Erro ao montar a escala com os dados carregados: modo seguro sem gravar. */
    enterSafeMode(reason) {
      session.status = LoadStatus.INVALID;
      session.issues = [reason];
      session.writable = false;
      session.state = createExampleState();
      return session.state;
    },

    /** De onde vieram os dados: "v4", "v3" ou null (nenhum). */
    source: session.source,
    /** Texto exatamente como estava gravado, para o usuário baixar. */
    originalText: session.originalText,
    get state() {
      return session.state;
    },
    get status() {
      return session.status;
    },
    get issues() {
      return session.issues;
    },
    get writable() {
      return session.writable;
    },
    get backedUp() {
      return session.backedUp;
    },
  };
}
