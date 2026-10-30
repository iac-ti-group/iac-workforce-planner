/** Card "Resposta": frases simples da jornada em exibição e comparação 44h × 42h × 40h. */

import { test, expect } from "./fixtures.js";
import { comparePhases, describeAnswer } from "../../src/js/application/answer.js";
import { formatCurrency } from "../../src/js/shared/format.js";
import { expectedExample } from "./oracle.js";

const answerOf = (changes) => {
  const { state, schedule, compliance } = expectedExample(changes);
  return describeAnswer(state, schedule, compliance);
};

test.describe("resposta em linguagem simples", () => {
  test("o exemplo mostra as frases calculadas para a jornada em exibição", async ({ app, page }) => {
    const expected = answerOf();
    await app.open();
    await expect(page.locator("#answerTitle")).toHaveText(expected.title);
    await expect(page.locator("#answerLines dd")).toHaveText(expected.lines.map((line) => line.text));
    await expect(page.locator("#answer")).toHaveAttribute("data-tone", expected.tone);
  });

  test("trocar a jornada atualiza a resposta", async ({ app, page }) => {
    await app.open();
    await app.selectPhase("44");
    await expect(page.locator("#answerTitle")).toHaveText("Hoje, na jornada de 44h");
    await expect(page.locator('#answerLines [data-topic="rotina"] dd')).toHaveText("Cada pessoa trabalha 6 dias de 7h20 e folga 1 dia por semana.");
  });

  test("sem contratações na escala, a resposta explica o que marcar", async ({ app, page }) => {
    await app.open();
    await app.includeHires.uncheck();
    await expect(page.locator('#answerLines [data-topic="escala"] dd')).toContainText("Marque “Incluir na escala as contratações necessárias”");
    await expect(page.locator("#answer")).toHaveAttribute("data-tone", "warn");
  });

  test("o custo da resposta acompanha o salário enquanto é digitado", async ({ app, page }) => {
    await app.open();
    await page.locator("#sal").fill("3.000,00");
    // 8 × 3.000 × 1,75 = 42.000; + 2 contratações × 5.250 = 52.500
    await expect(page.locator('#answerLines [data-topic="custo"] dd')).toHaveText(
      `Folha mensal estimada: ${formatCurrency(42000)} hoje e ${formatCurrency(52500)} com as contratações (+25%).`,
    );
  });
});

test.describe("comparação das jornadas", () => {
  test("mostra as três jornadas com os valores do domínio e destaca a em exibição", async ({ app, page }) => {
    const { state } = expectedExample();
    const rows = comparePhases(state);
    await app.open();
    const table = page.locator("table.compare");
    await expect(table.locator("thead button")).toHaveText(["Hoje · 44h", "42h", "40h"]);
    await expect(table.locator('thead button[aria-pressed="true"]')).toHaveText("42h");
    const required = table.locator("tbody tr", { hasText: "Pessoas necessárias" }).locator("td");
    await expect(required).toHaveText(rows.map((row) => String(row.required)));
    const payroll = table.locator("tbody tr", { hasText: "Folha mensal estimada" }).locator("td");
    await expect(payroll).toHaveText(rows.map((row) => formatCurrency(row.monthlyCost)));
    await expect(table.locator("td.sel")).toHaveCount(await table.locator("tbody tr").count());
  });

  test("clicar numa jornada da tabela passa a exibi-la", async ({ app, page }) => {
    await app.open();
    await page.locator('table.compare thead button[data-phase="40"]').click();
    await expect(app.phaseButton("40")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('table.compare thead button[aria-pressed="true"]')).toHaveText("40h");
    await expect(page.locator("#answerTitle")).toHaveText("Na jornada de 40h");
  });

  test("sem salário, a tabela não inventa custo e diz o que preencher", async ({ app, page }) => {
    await app.open();
    await page.locator("#sal").fill("");
    await page.locator("#ben").focus(); // renderiza ao digitar; ao recalcular a escala a tabela também é refeita
    await app.selectPhase("40");
    await expect(page.locator("table.compare tbody tr", { hasText: "Folha mensal estimada" })).toHaveCount(0);
    await expect(page.locator("#compare .hint")).toContainText("Informe o salário médio");
  });
});
