import { readFileSync } from "node:fs";
import { test, expect, LEGACY_STORAGE_KEY } from "./fixtures.js";
import { nginxSecurityHeaders } from "./server.mjs";

const XSS = `<img src=x onerror="window.__xss=1">"'&`;

test.describe("segurança", () => {
  test("src é servido com a CSP e os cabeçalhos do nginx", async ({ page, appPath, expectsCsp }) => {
    test.skip(!expectsCsp, "o arquivo único (dist) é feito para abrir sem servidor, sem cabeçalhos");
    const response = await page.goto(appPath);
    const expected = nginxSecurityHeaders(readFileSync(new URL("../../config/nginx/default.conf", import.meta.url), "utf8"));
    const headers = response.headers();
    for (const [name, value] of Object.entries(expected)) expect(headers[name.toLowerCase()], name).toBe(value);
  });

  test("o app só faz requisições ao próprio site (fontes incluídas)", async ({ app, page, baseURL }) => {
    const external = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL) && !url.startsWith("data:")) external.push(url);
    });
    await app.open();
    await app.selectPhase("40");
    expect(external).toEqual([]);
  });

  test("nome com HTML é exibido como texto e não executa", async ({ app, page }) => {
    await app.open();
    const name = app.grid.locator("td.nm input").first();
    await name.fill(XSS);
    await name.press("Enter");

    await expect(app.grid.locator("td.nm input").first()).toHaveValue(XSS);
    await app.cell(0, 0).click(); // gera um aviso com o nome no toast
    await expect(page.locator("#toast")).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });

  test("dados adulterados no localStorage não executam código", async ({ app, page }) => {
    await page.addInitScript(
      ([key, xss]) => {
        if (sessionStorage.getItem("__seeded")) return;
        sessionStorage.setItem("__seeded", "1");
        const days = Array.from({ length: 7 }, () => ({ on: true, a: `"><img src=x onerror="window.__xss=1">`, f: "22:00", need: 2 }));
        localStorage.setItem(key, JSON.stringify({
          seg: 20, tipo: "comercio", team: [{ n: xss, s: "F" }, { n: "B", s: "M" }], days, needAuto: true, fase: "40",
          contratar: false, sal: 2000, ben: 0, ov: {}, wk: 0, names: { novo1: xss }, almIni: xss, mtab: xss,
        }));
      },
      [LEGACY_STORAGE_KEY, XSS],
    );
    await app.open();
    await expect(app.grid.locator("td.nm input").first()).toHaveValue(XSS);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator("body")).toHaveAttribute("data-mtab", "ajustes");
  });
});
