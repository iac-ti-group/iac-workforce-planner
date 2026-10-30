/** E2 — recuperação de dados, backup, migração v3 → v4, limites e “Apagar dados salvos”. */

import { test, expect, STORAGE_KEY, LEGACY_STORAGE_KEY } from "./fixtures.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { toPersisted } from "../../src/js/infrastructure/stateRepository.js";

const BACKUP_PREFIX = "iac-escala5x2-backup-";
const exampleRaw = (changes = {}) => ({ ...toPersisted(createExampleState()), ...changes });
const v4 = (raw) => JSON.stringify({ schemaVersion: 4, ...raw });

/** Grava valores no localStorage uma única vez, antes de o app carregar. */
async function seed(page, entries, { failBackups = false } = {}) {
  await page.addInitScript(
    ([items, failBackups]) => {
      if (failBackups) {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (String(key).startsWith("iac-escala5x2-backup-")) throw new DOMException("cheio", "QuotaExceededError");
          return original.call(this, key, value);
        };
      }
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
    },
    [entries, failBackups],
  );
}

const storage = (page) =>
  page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])));
const backupsOf = (all) => Object.entries(all).filter(([key]) => key.startsWith(BACKUP_PREFIX)).map(([, value]) => value);

test.describe("recuperação de dados salvos", () => {
  test("dados da versão anterior (v3) são migrados para a v4 sem alterar a v3", async ({ app, page }) => {
    const v3 = JSON.stringify(exampleRaw({ fase: "40" }));
    await seed(page, { [LEGACY_STORAGE_KEY]: v3 });
    await app.open();
    await expect(app.phaseButton("40")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#notice")).toBeHidden();
    const all = await storage(page);
    expect(all[LEGACY_STORAGE_KEY]).toBe(v3);
    expect(JSON.parse(all[STORAGE_KEY])).toMatchObject({ schemaVersion: 4, fase: "40" });
  });

  test("dados corrompidos: modo seguro sem gravar; “Começar com o exemplo” pede confirmação e faz backup", async ({ app, page }) => {
    await seed(page, { [STORAGE_KEY]: "{corrompido" });
    await app.open();
    const notice = page.locator("#notice");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveClass(/\bbad\b/);
    await expect(notice.locator("b")).toHaveText("Não foi possível abrir os dados salvos");
    await expect(notice.locator("li")).toContainText(["corrompidos"]);
    await expect(app.kpiValue("Equipe hoje")).toHaveText("8");

    // Em modo seguro o uso continua, mas nada é gravado.
    await app.selectPhase("40");
    expect((await storage(page))[STORAGE_KEY]).toBe("{corrompido");

    await notice.getByRole("button", { name: "Começar com o exemplo" }).click();
    const dialog = page.locator("#confirmDialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    expect((await storage(page))[STORAGE_KEY]).toBe("{corrompido");

    await notice.getByRole("button", { name: "Começar com o exemplo" }).click();
    await dialog.getByRole("button", { name: "Começar com o exemplo" }).click();
    await expect(notice).toBeHidden();
    await expect(page.locator("#toast b")).toHaveText("Exemplo carregado");
    const all = await storage(page);
    expect(backupsOf(all)).toEqual(["{corrompido"]);
    expect(JSON.parse(all[STORAGE_KEY]).schemaVersion).toBe(4);
  });

  test("“Baixar dados originais” entrega exatamente o que estava salvo", async ({ app, page }) => {
    await seed(page, { [STORAGE_KEY]: "{corrompido" });
    await app.open();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#notice").getByRole("button", { name: "Baixar dados originais" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^escala-dados-originais-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString("utf8")).toBe("{corrompido");
  });

  test("valores acima dos limites: ajustados com aviso claro e backup do original antes de gravar", async ({ app, page }) => {
    const raw = exampleRaw({ needAuto: false, fase: "40" });
    raw.days[0].need = 20000;
    const original = v4(raw);
    await seed(page, { [STORAGE_KEY]: original });
    await app.open();
    const notice = page.locator("#notice");
    await expect(notice.locator("b")).toHaveText("Alguns dados salvos foram ajustados");
    await expect(notice.locator("li")).toHaveText(["Seg: 20000 pessoas por dia foram ajustadas para o máximo de 200."]);
    await expect(notice).toContainText("Uma cópia dos dados originais foi guardada");
    const all = await storage(page);
    expect(backupsOf(all)).toEqual([original]);
    expect(JSON.parse(all[STORAGE_KEY]).days[0].need).toBe(200);

    await notice.getByRole("button", { name: "Entendi" }).click();
    await expect(notice).toBeHidden();
  });

  test("se o backup falhar, os dados originais não são sobrescritos", async ({ app, page }) => {
    const original = v4(exampleRaw({ alm: 37 }));
    await seed(page, { [STORAGE_KEY]: original }, { failBackups: true });
    await app.open();
    await expect(page.locator("#notice b")).toHaveText("Dados ajustados, mas sem cópia de segurança");
    await app.selectPhase("40");
    await app.cell(0, 0).click();
    expect((await storage(page))[STORAGE_KEY]).toBe(original);
  });

  test("“Apagar dados salvos”: cancelar não muda nada; confirmar faz backup e volta ao exemplo", async ({ app, page }) => {
    await app.open();
    await app.selectPhase("40");
    const before = (await storage(page))[STORAGE_KEY];

    await page.locator("#clearData").click();
    const dialog = page.locator("#confirmDialog");
    await expect(dialog.locator("h2")).toHaveText("Apagar os dados salvos?");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(app.phaseButton("40")).toHaveAttribute("aria-pressed", "true");

    await page.locator("#clearData").click();
    await dialog.getByRole("button", { name: "Apagar e usar o exemplo" }).click();
    await expect(app.phaseButton("42")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#toast b")).toHaveText("Dados apagados");
    expect(backupsOf(await storage(page))).toEqual([before]);
  });
});

test.describe("limites do simulador", () => {
  test("equipe com 200 pessoas: “+” explica o limite e não adiciona", async ({ app, page }) => {
    const team = Array.from({ length: 200 }, (_, i) => ({ n: "P" + i, s: i % 2 ? "M" : "F" }));
    await seed(page, { [STORAGE_KEY]: v4(exampleRaw({ team, fase: "44" })) });
    await app.open();
    await expect(page.locator("#cF")).toHaveText("100");
    await page.getByRole("button", { name: "Mais uma mulher" }).click();
    await expect(page.locator("#toast b")).toHaveText("Limite de 200 pessoas");
    await expect(page.locator("#cF")).toHaveText("100");
  });

  test("demanda que exige mais de 200 pessoas: contratações limitadas com aviso, sem prometer cobertura", async ({ app, page }) => {
    const team = Array.from({ length: 10 }, (_, i) => ({ n: "P" + i, s: i % 2 ? "M" : "F" }));
    const raw = exampleRaw({ team, fase: "40", needAuto: false, contratar: true });
    raw.days.forEach((day) => (day.need = 200));
    await seed(page, { [STORAGE_KEY]: v4(raw) });
    await app.open();
    await expect(app.alerts.first().locator("b")).toHaveText("Contratações limitadas a 200 pessoas no total");
    await expect(app.alerts.filter({ hasText: "Escala dentro das regras" })).toHaveCount(0);
    await expect(app.alerts.filter({ hasText: "Faltam pessoas em alguns dias" })).toHaveCount(1);
    await expect(app.personRows()).toHaveCount(200);
  });

  test("pessoas por dia: “+” para em 200 e explica", async ({ app, page }) => {
    const raw = exampleRaw({ needAuto: false, fase: "40" });
    raw.days[6].on = false;
    raw.days[0].need = 200;
    await seed(page, { [STORAGE_KEY]: v4(raw) });
    await app.open();
    await page.getByRole("button", { name: "Mais pessoas Seg", exact: true }).click();
    await expect(page.locator("#toast b")).toHaveText("Máximo de 200 pessoas por dia");
    await expect(app.demandPerDay.locator(":scope > div").first().locator("output")).toHaveText("200");
  });

  test("nome limitado a 80 caracteres no campo", async ({ app }) => {
    await app.open();
    const name = app.grid.locator("td.nm input").first();
    await name.fill("a".repeat(120));
    await expect(name).toHaveValue("a".repeat(80));
  });

  test("horário apagado: avisa e mantém o anterior", async ({ app, page }) => {
    await app.open();
    const opens = page.locator("#fa0");
    const before = await opens.inputValue();
    await opens.fill("");
    await opens.dispatchEvent("change");
    await expect(page.locator("#toast b")).toHaveText("Horário incompleto");
    await expect(page.locator("#fa0")).toHaveValue(before);
  });
});
