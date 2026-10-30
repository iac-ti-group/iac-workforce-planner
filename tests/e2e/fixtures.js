/**
 * Fixtures compartilhadas dos testes de navegador.
 *
 * - `diagnostics` (automática): falha o teste se houver erro de console, exceção não tratada,
 *   falha de rede no próprio site ou violação de CSP. Use `diagnostics.allow(regex)` para um erro esperado.
 * - `app`: navegação e seletores do simulador (page object).
 *
 * O app não usa nenhum recurso externo (fontes inclusive): qualquer falha de rede reprova o teste.
 */

import { test as base, expect } from "@playwright/test";

/** Chave onde o app grava (v4) e a da versão anterior (v3), que o app só lê. */
export const STORAGE_KEY = "iac-escala5x2-v4";
export const LEGACY_STORAGE_KEY = "iac-escala5x2-v3";

export const test = base.extend({
  appPath: ["/", { option: true }],
  expectsCsp: [false, { option: true }],

  diagnostics: [
    async ({ page, baseURL }, use) => {
      const problems = { console: [], exceptions: [], network: [], csp: [] };
      const allowed = [];
      const isAllowed = (text) => allowed.some((pattern) => pattern.test(text));

      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener("securitypolicyviolation", (event) =>
          window.__cspViolations.push(`${event.violatedDirective} bloqueou ${event.blockedURI || "inline"}`),
        );
      });
      page.on("console", (message) => {
        if (message.type() === "error" && !isAllowed(message.text())) problems.console.push(message.text());
      });
      page.on("pageerror", (error) => !isAllowed(error.message) && problems.exceptions.push(error.message));
      page.on("requestfailed", (request) => problems.network.push(`${request.failure()?.errorText} ${request.url()}`));
      page.on("response", (response) => {
        if (response.url().startsWith(baseURL) && response.status() >= 400) problems.network.push(`${response.status()} ${response.url()}`);
      });

      await use({ allow: (pattern) => allowed.push(pattern), problems });

      if (!page.isClosed()) problems.csp.push(...(await page.evaluate(() => window.__cspViolations || []).catch(() => [])));
      expect(problems, "erros de console, exceções, rede ou CSP durante o teste").toEqual({ console: [], exceptions: [], network: [], csp: [] });
    },
    { auto: true },
  ],

  app: async ({ page, appPath }, use) => {
    await use(new SimulatorPage(page, appPath));
  },
});

export { expect };

export class SimulatorPage {
  constructor(page, appPath) {
    this.page = page;
    this.appPath = appPath;
    this.grid = page.locator("#esc");
    this.shiftTable = page.locator("#tn");
    this.demandPerDay = page.locator("#sug");
    this.alerts = page.locator("#alerts .al");
    this.toast = page.locator("#toast");
    this.copyButton = page.locator("#copy");
    this.undoButton = page.locator("#undo");
    this.includeHires = page.locator("#contratar");
  }

  async open() {
    await this.page.goto(this.appPath);
    await expect(this.grid.locator("tbody tr").first()).toBeVisible();
  }

  async reload() {
    await this.page.reload();
    await expect(this.grid.locator("tbody tr").first()).toBeAttached();
  }

  /** Linhas de pessoas na grade (sem a linha de cobertura). */
  personRows() {
    return this.grid.locator("tbody tr:not(.cob)");
  }

  personNames() {
    return this.grid.locator("td.nm input").evaluateAll((inputs) => inputs.map((input) => input.value));
  }

  cell(personIndex, day) {
    return this.grid.locator(`.cell[data-i="${personIndex}"][data-d="${day}"]`);
  }

  kpiValue(label) {
    return this.page.locator(".kpi", { hasText: label }).locator(".v");
  }

  kpiDetail(label) {
    return this.page.locator(".kpi", { hasText: label }).locator(".d");
  }

  phaseButton(phase) {
    return this.page.locator(`#fases .fase[data-v="${phase}"]`);
  }

  async selectPhase(phase) {
    await this.phaseButton(phase).click();
    await expect(this.phaseButton(phase)).toHaveAttribute("aria-pressed", "true");
  }

  weekButton(week) {
    return this.page.locator(`#weeks button[data-w="${week}"]`);
  }

  /** Coluna de trabalho/folga de uma pessoa na semana exibida: [true, false, ...]. */
  async workRow(personIndex) {
    return Promise.all([0, 1, 2, 3, 4, 5, 6].map(async (day) => /(^| )t( |$)/.test(await this.cell(personIndex, day).getAttribute("class"))));
  }

  /** Estado gravado no localStorage (chave v4: { schemaVersion, ...campos v3 }). */
  storedState() {
    return this.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  }

  /** Arrasta com eventos de ponteiro reais (o app usa pointerdown/move/up, não drag and drop HTML5). */
  async dragBetween(source, target) {
    // Como uma pessoa faria: rola até a grade antes de arrastar (o mouse não alcança fora da tela).
    await source.scrollIntoViewIfNeeded();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 8, { steps: 4 });
    await this.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await this.page.mouse.up();
  }
}
