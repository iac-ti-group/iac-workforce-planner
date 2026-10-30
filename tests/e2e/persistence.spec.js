import { readFileSync } from "node:fs";
import { test, expect, LEGACY_STORAGE_KEY } from "./fixtures.js";
import { dayOffAndWorkday, expectedExample } from "./oracle.js";

const goldenInput = (name) => JSON.parse(readFileSync(new URL(`../fixtures/golden/${name}.json`, import.meta.url), "utf8")).input;

/** Grava um estado no localStorage antes de o app carregar. */
async function seedStorage(page, value) {
  await page.addInitScript(
    ([key, raw]) => {
      if (!sessionStorage.getItem("__seeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("__seeded", "1");
      }
    },
    [LEGACY_STORAGE_KEY, typeof value === "string" ? value : JSON.stringify(value)],
  );
}

test.describe("persistência e reload", () => {
  test("alterações sobrevivem ao recarregar a página", async ({ app, page }) => {
    const { schedule } = expectedExample();
    const { work } = dayOffAndWorkday(schedule, 0, 0);
    await app.open();

    await app.selectPhase("40");
    await app.cell(0, work).click();
    await expect(app.cell(0, work)).toHaveText("Folga");
    const rowBefore = await app.workRow(0);
    const name = app.grid.locator("td.nm input").nth(1);
    await name.fill("Bruna Souza");
    await name.press("Enter");
    await page.locator("#sal").fill("3.000,00");
    await page.locator("#sal").blur();
    await app.weekButton(2).click();

    await app.reload();

    await expect(app.phaseButton("40")).toHaveAttribute("aria-pressed", "true");
    await expect(app.weekButton(2)).toHaveAttribute("aria-pressed", "true");
    await expect(app.grid.locator("td.nm input").nth(1)).toHaveValue("Bruna Souza");
    await expect(page.locator("#sal")).toHaveValue("3.000,00");
    await app.weekButton(0).click();
    expect(await app.workRow(0)).toEqual(rowBefore);
    await expect(app.cell(0, work)).toHaveClass(/\bman\b/);

    const stored = await app.storedState();
    expect(stored).toMatchObject({ fase: "40", sal: 3000, ov: { [`0-0-${work}`]: false } });
    expect(stored.team[1]).toEqual({ n: "Bruna Souza", s: "F" });
  });

  test("abre dados salvos no formato v3 (turnos editados à mão)", async ({ app, page }) => {
    const input = goldenInput("turnos-editados");
    await seedStorage(page, input);
    await app.open();
    await expect(page.locator("#ti0")).toHaveValue("06:00");
    await expect(page.locator("#ti1")).toHaveValue("11:00");
    await expect(page.locator("#tnAuto")).toBeVisible();
    await expect(app.shiftTable.locator("tfoot td.tt")).toHaveText(["5", "5", "3"]);
  });

  test("JSON corrompido no localStorage: abre o exemplo sem erro", async ({ app, page }) => {
    await seedStorage(page, "{isto não é json");
    await app.open();
    await expect(app.kpiValue("Equipe hoje")).toHaveText("8");
    await expect(app.phaseButton("42")).toHaveAttribute("aria-pressed", "true");
  });

  test("estrutura inválida no localStorage: abre o exemplo sem erro", async ({ app, page }) => {
    await seedStorage(page, { team: "x", days: [] });
    await app.open();
    await expect(app.kpiValue("Equipe hoje")).toHaveText("8");
  });
});
