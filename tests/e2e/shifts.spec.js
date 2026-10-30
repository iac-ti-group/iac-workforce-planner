import { test, expect } from "./fixtures.js";
import { formatClock, toMinutes } from "../../src/js/domain/time.js";
import { expectedExample } from "./oracle.js";

// Exemplo em 42h: 8h24 de trabalho + 1h de almoço = 564 min entre entrada e saída.
const SPAN_42H = 504 + 60;

test.describe("configuração de turnos", () => {
  test("o exemplo (7 dias, expediente longo) é organizado em turnos sugeridos", async ({ app, page }) => {
    const { state } = expectedExample();
    await app.open();
    await expect(page.locator("#sugTitle")).toHaveText("Turnos da equipe");
    await expect(app.shiftTable).toBeVisible();
    await expect(app.demandPerDay).toBeHidden();
    for (const [index, shift] of state.shiftStarts.entries()) {
      await expect(page.locator(`#ti${index}`)).toHaveValue(shift.start);
      await expect(app.shiftTable.locator("tbody tr").nth(index).locator("small")).toHaveText(
        `até ${formatClock(toMinutes(shift.start) + SPAN_42H)}`,
      );
    }
    await expect(app.shiftTable.locator("tfoot td.tt")).toHaveText(state.shiftHeadcount.map((row) => String(row.reduce((a, b) => a + b, 0))));
    await expect(page.locator("#tnAuto")).toBeHidden();
  });

  test("“+” num turno aumenta o total do dia e a demanda da grade", async ({ app, page }) => {
    await app.open();
    const firstShiftWeekdays = app.shiftTable.locator("tbody tr").first().locator("td").nth(2);
    await expect(firstShiftWeekdays.locator("output")).toHaveText("4");
    await firstShiftWeekdays.getByRole("button", { name: "Mais pessoas turno 1 Seg a Sex" }).click();
    await expect(firstShiftWeekdays.locator("output")).toHaveText("5");
    await expect(app.shiftTable.locator("tfoot td.tt").first()).toHaveText("9");
    await expect(app.grid.locator("tr.cob td").nth(1)).toContainText("/ 9");
    await expect(page.locator("#tnAuto")).toBeVisible();
  });

  test("editar a entrada de um turno recalcula a saída; “Voltar aos turnos sugeridos” restaura", async ({ app, page }) => {
    await app.open();
    const secondStart = page.locator("#ti1");
    const original = await secondStart.inputValue();
    await secondStart.fill("14:00");
    await secondStart.dispatchEvent("change");
    await expect(page.locator("#ti1")).toHaveValue("14:00");
    await expect(app.shiftTable.locator("tbody tr").nth(1).locator("small")).toHaveText(`até ${formatClock(14 * 60 + SPAN_42H)}`);

    await page.locator("#tnAuto").click();
    await expect(page.locator("#ti1")).toHaveValue(original);
    await expect(page.locator("#tnAuto")).toBeHidden();
  });

  test("mudar a duração do almoço atualiza a saída dos turnos", async ({ app, page }) => {
    await app.open();
    await page.locator("#almDur").selectOption("90");
    const start = await page.locator("#ti0").inputValue();
    await expect(app.shiftTable.locator("tbody tr").first().locator("small")).toHaveText(`até ${formatClock(toMinutes(start) + 504 + 90)}`);
  });

  test("com um dia fechado, os turnos dão lugar a “Pessoas por dia”", async ({ app, page }) => {
    await app.open();
    await page.getByRole("button", { name: "Dom: aberto" }).click();
    await expect(page.locator("#sugTitle")).toHaveText("Pessoas por dia");
    await expect(app.shiftTable).toBeHidden();
    await expect(app.demandPerDay.locator(".closed")).toHaveText(/Dom/);

    const plusMonday = page.getByRole("button", { name: "Mais pessoas Seg", exact: true });
    const monday = app.demandPerDay.locator(":scope > div", { has: plusMonday });
    const before = Number(await monday.locator("output").textContent());
    await plusMonday.click();
    await expect(monday.locator("output")).toHaveText(String(before + 1));
    await expect(page.locator("#tnAuto")).toBeVisible();
  });
});
