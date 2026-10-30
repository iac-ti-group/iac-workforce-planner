/** Redesign (identidade IAC System): fontes locais, ícones de estado, estados vazios, tema escuro e alvos de toque. */

import { test, expect, LEGACY_STORAGE_KEY } from "./fixtures.js";
import { createExampleState } from "../../src/js/domain/simulationState.js";
import { toPersisted } from "../../src/js/infrastructure/stateRepository.js";

const seedV3 = (page, raw) =>
  page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem(key, value);
    },
    [LEGACY_STORAGE_KEY, JSON.stringify(raw)],
  );

test.describe("identidade visual", () => {
  test("usa a Plus Jakarta Sans servida pelo próprio site, sem nenhuma requisição externa", async ({ app, page, baseURL }) => {
    const external = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL) && !url.startsWith("data:") && !url.startsWith("blob:")) external.push(url);
    });
    await app.open();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check("600 16px 'Plus Jakarta Sans'"))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"Plus Jakarta Sans"/);
    expect(external).toEqual([]);
  });

  test("cada aviso traz ícone e cor do seu nível (estado nunca só pela cor)", async ({ app }) => {
    await app.open();
    const first = app.alerts.first();
    await expect(first).toHaveClass(/\bok\b/);
    await expect(first.locator("svg.icon")).toHaveCount(1);
    await expect(app.alerts.locator("svg.icon")).toHaveCount(await app.alerts.count());
  });

  test("com mais de 8 avisos, “Ver mais” mostra o restante em vez de escondê-lo", async ({ app, page }) => {
    const raw = toPersisted({ ...createExampleState(), phase: "40" });
    // Forçar todas as pessoas a trabalhar todos os dias gera muitas violações.
    raw.ov = {};
    for (let person = 0; person < 8; person++) for (let day = 0; day < 7; day++) raw.ov[`${person}-0-${day}`] = true;
    await seedV3(page, raw);
    await app.open();
    await expect(app.alerts).toHaveCount(8);
    const more = page.locator("#alerts [data-more]");
    await expect(more).toHaveText(/^Ver mais \d+ avisos?$/);
    const total = 8 + Number((await more.textContent()).match(/\d+/)[0]);
    await more.click();
    await expect(app.alerts).toHaveCount(total);
    await expect(page.locator("#alerts [data-more]")).toHaveCount(0);
  });

  test("sem equipe: a escala explica o que fazer", async ({ app, page }) => {
    await seedV3(page, { ...toPersisted(createExampleState()), team: [], contratar: false });
    await page.goto(app.appPath);
    await expect(page.locator("#esc td.empty")).toContainText("Informe a equipe atual no passo 5");
  });

  test("semana com problema tem marcador e descrição acessível, não só cor", async ({ app, page }) => {
    await app.open();
    await app.includeHires.uncheck();
    const flagged = page.locator("#weeks button.has-bad").first();
    await expect(flagged).toHaveAttribute("aria-label", /com pontos de atenção/);
  });
});

test.describe("tema escuro", () => {
  test.use({ colorScheme: "dark" });

  test("segue a preferência do sistema com superfícies escuras e texto claro", async ({ app, page }) => {
    await app.open();
    const colors = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
      card: getComputedStyle(document.querySelector(".card")).backgroundColor,
    }));
    expect(colors.body).toBe("rgb(20, 20, 20)");
    expect(colors.card).toBe("rgb(32, 32, 32)");
    expect(colors.ink).toBe("rgb(245, 245, 245)");
  });
});

test.describe("toque no celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("botões principais têm ao menos 44px de altura", async ({ page, appPath }) => {
    await page.goto(appPath);
    await expect(page.locator("#mnav")).toBeVisible();
    const selectors = ["#mnav button", "#mfase button", ".side .card > .step"];
    for (const selector of selectors) {
      const heights = await page.locator(selector).evaluateAll((elements) =>
        elements.filter((el) => el.offsetParent !== null).map((el) => el.getBoundingClientRect().height),
      );
      expect(heights.length, selector).toBeGreaterThan(0);
      for (const height of heights) expect(height, selector).toBeGreaterThanOrEqual(40);
    }
    await page.locator(".side .card").nth(1).locator(".step").tap();
    const chips = await page.locator(".dchip").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const height of chips) expect(height).toBeGreaterThanOrEqual(44);
  });
});
