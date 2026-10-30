import { test, expect } from "./fixtures.js";
import { addTeamMember, removeTeamMember } from "../../src/js/application/actions.js";
import { estimateCost } from "../../src/js/domain/cost.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { formatCurrency } from "../../src/js/shared/format.js";
import { expectedExample } from "./oracle.js";

test.describe("painel de ajustes", () => {
  test("trocar o ramo aplica dias e horários de referência", async ({ app, page }) => {
    await app.open();
    await page.locator("#segm").selectOption({ label: "Escola / creche" });
    await expect(page.getByRole("button", { name: "Sáb: fechado" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Dom: fechado" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#fa0")).toHaveValue("07:00");
    await expect(page.locator("#ff0")).toHaveValue("19:00");
    await expect(page.locator("#fa1")).toBeDisabled();
    await expect(app.grid.locator(".cell.x").first()).toHaveText("fechado");
  });

  test("equipe: + e − por sexo atualizam contadores e a grade", async ({ app, page }) => {
    await app.open();
    await page.getByRole("button", { name: "Mais uma mulher" }).click();
    await expect(page.locator("#cF")).toHaveText("5");
    await expect(app.kpiValue("Equipe hoje")).toHaveText("9");
    await expect(app.grid.locator("td.nm input").nth(8)).toHaveValue("Colaboradora 5");

    await page.getByRole("button", { name: "Menos um homem" }).click();
    await page.getByRole("button", { name: "Menos um homem" }).click();
    await expect(page.locator("#cM")).toHaveText("2");
    await expect(app.kpiValue("Equipe hoje")).toHaveText("7");
    const { state } = expectedExample();
    addTeamMember(state, "F");
    removeTeamMember(state, "M");
    removeTeamMember(state, "M");
    const schedule = buildSchedule(state);
    expect(await app.personNames()).toEqual(schedule.roster.map((person) => person.name));
  });

  test("tipo de atividade muda a regra de domingo exibida", async ({ app, page }) => {
    await app.open();
    await expect(page.locator("#tipoHint")).toHaveText("Homens folgam ao menos 1 domingo a cada 3 semanas.");
    await page.locator('#tipo button[data-v="outros"]').click();
    await expect(page.locator("#tipoHint")).toHaveText("Homens folgam ao menos 1 domingo a cada 7 semanas.");
  });

  test("exemplo de jornada 44h (seg a sáb) aplica dias, horários e a fase atual", async ({ app, page }) => {
    await app.open();
    await page.locator("#modelos").evaluate((details) => (details.closest("details").open = true));
    await page.locator('#modelos .modelo[data-m="6"]').click();
    await expect(page.locator('#modelos .modelo[data-m="6"]')).toHaveAttribute("aria-pressed", "true");
    await expect(app.phaseButton("44")).toHaveAttribute("aria-pressed", "true");
    await expect(app.kpiValue("Jornada por dia")).toHaveText("8h + sáb 4h");
    await expect(page.locator("#segm")).toHaveValue("-1");
  });

  test("almoço de 30 min avisa que precisa de convenção", async ({ app, page }) => {
    await app.open();
    await page.locator("#almDur").selectOption("30");
    await expect(app.alerts.filter({ hasText: "Almoço de 30 min exige convenção" })).toHaveCount(1);
  });

  test("trocar o sexo pelo botão da grade atualiza os contadores", async ({ app, page }) => {
    await app.open();
    const badge = app.grid.locator(".sx").first();
    await expect(badge).toHaveText("F");
    await badge.click();
    await expect(app.grid.locator(".sx").first()).toHaveText("M");
    await expect(page.locator("#cF")).toHaveText("3");
    await expect(page.locator("#cM")).toHaveText("5");
  });

  test("custo: salário e benefícios atualizam o resumo com os valores do domínio", async ({ app, page }) => {
    const { state, schedule } = expectedExample({ salary: 3000, benefits: 200 });
    const cost = estimateCost(state, schedule);
    await app.open();
    await page.locator("#sal").fill("3.000,00");
    await page.locator("#ben").fill("200");
    await page.locator("#ben").blur();
    await expect(page.locator("#ben")).toHaveValue("200,00");
    const summary = page.locator("#cres .cres > div").first();
    await expect(summary.locator(".v")).toContainText(formatCurrency(cost.payroll));
    await expect(summary).toContainText(`8 pessoas × ${formatCurrency(cost.costPerEmployee)}`);

    await page.locator("#sal").fill("");
    await expect(page.locator("#cres")).toContainText("Informe o salário médio");
  });
});
