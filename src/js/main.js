/**
 * Ponto de entrada: monta as dependências (composition root) e conecta as views ao simulador.
 *
 * Camadas:
 *   domain/          regras de negócio (sem DOM)
 *   application/     casos de uso, orquestração e política de persistência
 *   infrastructure/  acesso ao localStorage
 *   ui/              renderização e eventos
 */

import { describeDayOffChange } from "./application/changeFeedback.js";
import { LoadStatus } from "./application/persistence.js";
import { createSimulator } from "./application/simulator.js";
import { createLocalStorageRepository } from "./infrastructure/stateRepository.js";
import { createConfirmDialog } from "./ui/confirmDialog.js";
import { byId } from "./ui/dom.js";
import { downloadText } from "./ui/download.js";
import { createNotice } from "./ui/notice.js";
import { createToast } from "./ui/toast.js";
import { createAnswerView } from "./ui/views/answerView.js";
import { createCostView } from "./ui/views/costView.js";
import { createMobileView } from "./ui/views/mobileView.js";
import { createNavigation } from "./ui/views/navigation.js";
import { createScheduleView } from "./ui/views/scheduleView.js";
import { createSetupPanel } from "./ui/views/setupPanel.js";

const MOBILE_BREAKPOINT = "(max-width: 760px)";

const simulator = createSimulator(createLocalStorageRepository());
const mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_BREAKPOINT) : { matches: false };
const notice = createNotice(byId("notice"));
const confirm = createConfirmDialog(byId("confirmDialog"));
let saveFailureShown = false;

/** Fachada que as views usam para ler o estado e disparar ações. */
const app = {
  get state() {
    return simulator.state;
  },
  get schedule() {
    return simulator.schedule;
  },
  get compliance() {
    return simulator.compliance;
  },
  /** Ação que altera a escala: recalcula, redesenha e grava (desfeita por inteiro se algo falhar). */
  dispatch(action, ...args) {
    return run(() => simulator.apply(action, ...args));
  },
  /** Ação que não altera a escala (semana exibida, valores de custo, aba): só grava. */
  update(action, ...args) {
    simulator.apply(action, ...args);
    reportSave(simulator.save());
  },
  renderResults,
  renderCost: () => {
    costView.render();
    answerView.render(); // a resposta também fala da folha
  },
  toast: createToast(byId("toast")),
  notifyDayOffChange(change) {
    app.toast(describeDayOffChange(simulator.state, simulator.schedule, simulator.compliance, change));
  },
  requestClearSavedData,
};

const setupPanel = createSetupPanel(app);
const answerView = createAnswerView(app);
const scheduleView = createScheduleView(app);
const costView = createCostView(app);
const mobileView = createMobileView(app);
const navigation = createNavigation(app, mobileQuery);

function renderResults() {
  answerView.render();
  scheduleView.render();
  costView.render();
  navigation.renderStepSummaries();
  mobileView.render();
}

function renderAll() {
  setupPanel.render();
  renderResults();
}

function run(change) {
  const result = simulator.transact(change, renderAll);
  if (!result.ok) {
    console.error(result.error);
    app.toast({
      level: "bad",
      title: "Não foi possível aplicar a alteração",
      text: "A tela voltou ao estado anterior e nada foi salvo. Se o problema continuar, use “Apagar dados salvos”.",
    });
    return false;
  }
  reportSave(result.saved);
  return true;
}

/** Falha ao gravar com a sessão gravável (cota cheia, armazenamento bloqueado): avisa uma vez. */
function reportSave(saved) {
  if (saved || !simulator.session.writable || saveFailureShown) return;
  saveFailureShown = true;
  notice.show({
    level: "warn",
    title: "As alterações não estão sendo salvas",
    text: "O navegador recusou a gravação (modo privado, armazenamento cheio ou bloqueado). A simulação funciona, mas será perdida ao fechar a página.",
    actions: [{ label: "Entendi", onClick: notice.hide }],
  });
}

const downloadOriginal = () => ({
  label: "Baixar dados originais",
  onClick: () => downloadText(`escala-dados-originais-${new Date().toISOString().slice(0, 10)}.json`, simulator.session.originalText),
});

function showSessionNotice() {
  const { session } = simulator;
  const canDownload = session.originalText !== null;
  if (session.status === LoadStatus.INVALID) {
    notice.show({
      level: "bad",
      title: "Não foi possível abrir os dados salvos",
      text: "Os dados guardados neste navegador estão incompletos ou corrompidos. Abrimos o exemplo sem salvar nada: seus dados originais continuam intactos.",
      items: session.issues,
      actions: [...(canDownload ? [downloadOriginal()] : []), { label: "Começar com o exemplo", primary: true, onClick: requestRestoreExample }],
    });
  } else if (session.status === LoadStatus.REPAIRED && session.writable) {
    notice.show({
      level: "warn",
      title: "Alguns dados salvos foram ajustados",
      text:
        "Os itens abaixo estavam inválidos ou acima dos limites do simulador e foram corrigidos. " +
        (session.source === "v4"
          ? "Uma cópia dos dados originais foi guardada neste navegador."
          : "Os dados da versão anterior continuam guardados sem alteração."),
      items: session.issues,
      actions: [downloadOriginal(), { label: "Entendi", onClick: notice.hide }],
    });
  } else if (session.status === LoadStatus.REPAIRED) {
    notice.show({
      level: "bad",
      title: "Dados ajustados, mas sem cópia de segurança",
      text: "Não foi possível guardar uma cópia dos dados originais. Para não perdê-los, nada desta sessão será salvo. Baixe os dados originais antes de continuar.",
      items: session.issues,
      actions: [downloadOriginal()],
    });
  } else {
    notice.hide();
  }
}

/** Substitui o estado após uma recuperação confirmada, preservando a aba aberta no celular. */
function startOver(result, toast) {
  run(() => simulator.replaceState({ ...result.state, mobileTab: simulator.state.mobileTab }));
  notice.hide();
  app.toast(toast);
}

async function requestRestoreExample() {
  const confirmed = await confirm({
    title: "Começar com o exemplo?",
    text: "Uma cópia de segurança dos dados atuais será guardada neste navegador antes. Depois disso, a simulação volta a ser salva normalmente.",
    confirmLabel: "Começar com o exemplo",
  });
  if (!confirmed) return;
  const result = simulator.session.restoreExample();
  if (!result.ok) {
    notice.show({
      level: "bad",
      title: "Nada foi alterado",
      text: "Não foi possível guardar a cópia de segurança, por isso os dados salvos não foram substituídos.",
      actions: simulator.session.originalText !== null ? [downloadOriginal()] : [],
    });
    return;
  }
  startOver(result, { level: "ok", title: "Exemplo carregado", text: "A cópia de segurança dos dados anteriores ficou guardada neste navegador." });
}

async function requestClearSavedData() {
  const confirmed = await confirm({
    title: "Apagar os dados salvos?",
    text: "A equipe, os horários e os ajustes desta simulação serão substituídos pelo exemplo. Uma cópia de segurança fica guardada neste navegador.",
    confirmLabel: "Apagar e usar o exemplo",
  });
  if (!confirmed) return;
  const result = simulator.session.clearSavedData();
  if (!result.ok) {
    app.toast({ level: "bad", title: "Os dados não foram apagados", text: "Não foi possível guardar a cópia de segurança antes de apagar." });
    return;
  }
  startOver(result, { level: "ok", title: "Dados apagados", text: "O exemplo foi carregado. A cópia de segurança fica guardada neste navegador." });
}

function start() {
  try {
    simulator.recalculate();
    renderAll();
    reportSave(simulator.save());
  } catch (error) {
    console.error(error);
    simulator.replaceState(simulator.session.enterSafeMode("Ocorreu um erro ao montar a escala com os dados salvos."));
    simulator.recalculate();
    renderAll();
  }
  showSessionNotice();
  navigation.showMobileTab(simulator.state.mobileTab);
}

if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", renderResults);

start();
