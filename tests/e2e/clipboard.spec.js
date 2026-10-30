import { test, expect } from "./fixtures.js";
import { weekSummaryText } from "../../src/js/application/weekSummary.js";
import { expectedExample } from "./oracle.js";

/** Guarda exatamente o texto que o app entrega a navigator.clipboard.writeText. */
async function spyOnClipboard(page) {
  await page.addInitScript(() => {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    window.__copied = [];
    navigator.clipboard.writeText = (text) => {
      window.__copied.push(text);
      return original(text);
    };
  });
}

/** O clipboard do Windows converte \n em \r\n na leitura; o app sempre escreve \n. */
const readSystemClipboard = (page) => page.evaluate(() => navigator.clipboard.readText()).then((text) => text.replace(/\r\n/g, "\n"));

test.describe("copiar semana (área de transferência)", () => {
  test.describe("com permissão", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("copia o texto da semana exibida e avisa", async ({ app, page }) => {
      const { state, schedule } = expectedExample();
      await spyOnClipboard(page);
      await app.open();
      await app.copyButton.click();
      await expect(app.copyButton).toHaveText("Copiado! Cole no WhatsApp");
      expect(await page.evaluate(() => window.__copied)).toEqual([weekSummaryText(state, schedule)]);
      expect(await readSystemClipboard(page)).toBe(weekSummaryText(state, schedule));
      await expect(app.copyButton).toHaveText("Copiar semana", { timeout: 5000 });
    });

    test("copia a semana selecionada", async ({ app, page }) => {
      const { state, schedule } = expectedExample({ week: 2 });
      await spyOnClipboard(page);
      await app.open();
      await app.weekButton(2).click();
      await app.copyButton.click();
      await expect(app.copyButton).toHaveText("Copiado! Cole no WhatsApp");
      const [copied] = await page.evaluate(() => window.__copied);
      expect(copied.split("\n")[0]).toBe("*Escala 42h · 5x2 · Semana 3*");
      expect(copied).toBe(weekSummaryText(state, schedule));
    });
  });

  test("se o navegador recusar, mostra “Não foi possível copiar”", async ({ app, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new DOMException("negado", "NotAllowedError")) },
      });
    });
    await app.open();
    await app.copyButton.click();
    await expect(app.copyButton).toHaveText("Não foi possível copiar");
  });
});
