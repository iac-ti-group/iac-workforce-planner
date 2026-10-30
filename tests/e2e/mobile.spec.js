import { test, expect } from "./fixtures.js";
import { dayOffAndWorkday, expectedExample } from "./oracle.js";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const PERSON = 0;

test.describe("modo app no celular", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.goto(app.appPath);
    await expect(app.page.locator("#mnav")).toBeVisible();
  });

  test("navegação inferior troca as seções e é lembrada após o reload", async ({ app, page }) => {
    await expect(page.locator("body")).toHaveAttribute("data-mtab", "ajustes");
    await expect(page.locator("#esc")).toBeHidden();

    await page.locator('#mnav button[data-t="escala"]').tap();
    await expect(page.locator("body")).toHaveAttribute("data-mtab", "escala");
    await expect(page.locator('#mnav button[data-t="escala"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#mesc")).toBeVisible();

    await page.locator('#mnav button[data-t="custo"]').tap();
    await expect(page.locator("#cres")).toBeVisible();

    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-mtab", "custo");
  });

  test("“Ver a escala” leva à aba da escala com um cartão por pessoa", async ({ app, page }) => {
    const { schedule } = expectedExample();
    await page.locator("#verEscala").tap();
    await expect(page.locator("body")).toHaveAttribute("data-mtab", "escala");
    await expect(page.locator("#mesc .mp")).toHaveCount(schedule.roster.length);
    await expect(page.locator("#mesc .mp .mph b")).toHaveText(schedule.roster.map((person) => person.name));
    await expect(page.locator("#mesc .mcov .mc")).toHaveCount(7);
  });

  test("tocar numa folga e depois num dia trabalhado move a folga", async ({ app, page }) => {
    const { schedule } = expectedExample();
    const { off, work } = dayOffAndWorkday(schedule, 0, PERSON);
    await page.locator('#mnav button[data-t="escala"]').tap();
    const day = (d) => page.locator(`#mesc .mx[data-i="${PERSON}"][data-d="${d}"]`);

    await day(off).tap();
    await expect(day(off)).toHaveClass(/\bsel\b/);
    await expect(page.locator("#mesc .mhint")).toContainText("Agora toque no dia para onde vai a folga de Ana");
    await expect(day(work)).toHaveClass(/\btgt\b/);

    await day(work).tap();
    await expect(day(off)).toHaveClass(/\bt\b/);
    await expect(day(work)).toHaveClass(/\bf\b/);
    await expect(day(work)).toHaveClass(/\bman\b/);
    await expect(page.locator("#toast")).toBeVisible();
  });

  test("tocar de novo na folga selecionada cancela; tocar num dia trabalhado mostra o horário", async ({ app, page }) => {
    const { schedule } = expectedExample();
    const { off, work } = dayOffAndWorkday(schedule, 0, PERSON);
    await page.locator('#mnav button[data-t="escala"]').tap();
    const day = (d) => page.locator(`#mesc .mx[data-i="${PERSON}"][data-d="${d}"]`);

    await day(off).tap();
    await day(off).tap();
    await expect(page.locator("#mesc .sel")).toHaveCount(0);

    await day(work).tap();
    await expect(page.locator("#toast b")).toHaveText(new RegExp(`^Ana · `));
    await expect(page.locator("#toast")).toContainText("às");
    await expect(day(work)).toHaveClass(/\bt\b/);
  });

  test("passos viram acordeão: abrir um fecha o outro; o resumo aparece fechado", async ({ page }) => {
    const cards = page.locator("aside.side .card");
    await expect(page.locator("#sum1")).toHaveText("Supermercado / mercado · comércio");
    await expect(page.locator("#sum5")).toHaveText("4 mulheres · 4 homens");

    await cards.nth(0).locator(".step").tap();
    await expect(cards.nth(0)).toHaveClass(/\bopen\b/);
    await cards.nth(4).locator(".step").tap();
    await expect(cards.nth(4)).toHaveClass(/\bopen\b/);
    await expect(cards.nth(0)).not.toHaveClass(/\bopen\b/);
  });

  test("fase pelo seletor do topo e contador de problemas na aba Escala", async ({ page }) => {
    await page.locator('#mfase button[data-v="40"]').tap();
    await expect(page.locator('#mfase button[data-v="40"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#mbadge")).toBeHidden();

    await page.locator('#mnav button[data-t="escala"]').tap();
    await page.locator("#contratar").evaluate((input) => input.click());
    await expect(page.locator("#mbadge")).toBeVisible();
    await expect(page.locator("#mbadge")).not.toHaveText("0");
  });
});
