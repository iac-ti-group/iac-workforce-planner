import { test, expect } from "./fixtures.js";
import { formatClock } from "../../src/js/domain/time.js";
import { DAY_NAMES, expectedExample } from "./oracle.js";

test.describe("carregamento do exemplo", () => {
  test("mostra equipe, indicadores e as 4 semanas", async ({ app, page }) => {
    const { schedule } = expectedExample();
    await app.open();

    await expect(app.kpiValue("Equipe hoje")).toHaveText("8");
    await expect(app.kpiDetail("Equipe hoje")).toHaveText("4 mulheres · 4 homens");
    await expect(app.kpiValue("Pessoas necessárias")).toHaveText(String(schedule.requiredHeadcount));
    await expect(app.kpiDetail("Pessoas necessárias")).toHaveText(`faltam ${schedule.requiredHeadcount - 8} para cobrir tudo`);
    await expect(app.kpiValue("Jornada por dia")).toHaveText("8h24");
    await expect(app.kpiValue("Horas por semana")).toHaveText("42h");
    await expect(app.kpiDetail("Horas por semana")).toHaveText("antes: 44h · limite 42h");

    await expect(page.locator("#weeks button")).toHaveText(["Semana 1", "Semana 2", "Semana 3", "Semana 4"]);
    await expect(app.weekButton(0)).toHaveAttribute("aria-pressed", "true");
    expect(await app.personNames()).toEqual(schedule.roster.map((person) => person.name));
    await expect(app.grid.locator("tbody tr.novo")).toHaveCount(schedule.hires);
    await expect(page.locator("#segm")).toHaveValue(String(20));
  });

  test("a grade da semana 1 é a calculada pelo motor (trabalho, folga e horários)", async ({ app }) => {
    const { schedule } = expectedExample();
    await app.open();
    for (const [person] of schedule.roster.entries()) {
      expect(await app.workRow(person), `linha ${person}`).toEqual(schedule.weeks[0][person]);
      for (const day of DAY_NAMES.keys()) {
        if (!schedule.weeks[0][person][day]) continue;
        const assignment = schedule.assignmentsFor(0, day).get(person);
        await expect(app.cell(person, day).locator("b")).toHaveText(formatClock(assignment.start));
        await expect(app.cell(person, day).locator("span")).toHaveText(`às ${formatClock(assignment.end)}`);
      }
    }
  });

  test("a linha de cobertura mostra trabalhando / necessário por dia", async ({ app }) => {
    const { schedule } = expectedExample();
    await app.open();
    const expected = DAY_NAMES.map((_, day) => `${schedule.weeks[0].filter((row) => row[day]).length} / ${schedule.demand[day]}`);
    await expect(app.grid.locator("tr.cob td:not(.nm)").filter({ hasText: "/" })).toHaveText(expected);
  });

  test("trocar a semana exibe a escala daquela semana", async ({ app }) => {
    const { schedule } = expectedExample();
    await app.open();
    await app.weekButton(3).click();
    await expect(app.weekButton(3)).toHaveAttribute("aria-pressed", "true");
    for (const [person] of schedule.roster.entries()) expect(await app.workRow(person)).toEqual(schedule.weeks[3][person]);
  });

  test("os avisos exibidos são os das verificações, na mesma ordem", async ({ app }) => {
    const { compliance } = expectedExample();
    await app.open();
    await expect(app.alerts.locator("b")).toHaveText(compliance.alerts.slice(0, 8).map((alert) => alert.title));
    await expect(app.alerts.first()).toHaveClass(/\bok\b/);
  });

  test("“Carregar exemplo” desfaz as alterações", async ({ app, page }) => {
    await app.open();
    await app.selectPhase("40");
    await app.grid.locator("td.nm input").first().fill("Outra pessoa");
    await app.grid.locator("td.nm input").first().press("Enter");
    await page.locator('button[aria-label="Mais uma mulher"]').click();

    await page.locator("#exemplo").click();
    await expect(app.phaseButton("42")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#cF")).toHaveText("4");
    expect((await app.personNames())[0]).toBe("Ana");
  });
});
