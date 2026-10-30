import { test, expect } from "./fixtures.js";
import { expectedExample } from "./oracle.js";

const PHASES = [
  { phase: "44", daily: "7h20", weekly: "44h", agreementAlert: false },
  { phase: "42", daily: "8h24", weekly: "42h", agreementAlert: true },
  { phase: "40", daily: "8h", weekly: "40h", agreementAlert: false },
];

test.describe("troca de fase (44h → 42h → 40h)", () => {
  for (const { phase, daily, weekly, agreementAlert } of PHASES) {
    test(`fase ${phase}h: jornada, horas, contratações e avisos`, async ({ app }) => {
      const { schedule } = expectedExample({ phase });
      await app.open();
      await app.selectPhase(phase);

      await expect(app.kpiValue("Jornada por dia")).toHaveText(daily);
      await expect(app.kpiValue("Horas por semana")).toHaveText(weekly);
      await expect(app.kpiValue("Pessoas necessárias")).toHaveText(String(schedule.requiredHeadcount));
      await expect(app.personRows()).toHaveCount(schedule.roster.length);
      const agreement = app.alerts.filter({ hasText: "8h24 por dia exige convenção" });
      await expect(agreement).toHaveCount(agreementAlert ? 1 : 0);
      for (const other of PHASES) {
        await expect(app.phaseButton(other.phase)).toHaveAttribute("aria-pressed", String(other.phase === phase));
      }
    });
  }

  test("na fase atual (44h) a opção de contratações fica desabilitada", async ({ app }) => {
    await app.open();
    await app.selectPhase("44");
    await expect(app.includeHires).toBeDisabled();
    await expect(app.kpiDetail("Pessoas necessárias")).toHaveText("na escala atual");
    await app.selectPhase("40");
    await expect(app.includeHires).toBeEnabled();
  });

  test("sem incluir contratações, a escala mostra a falta de pessoas e orienta", async ({ app }) => {
    const { schedule } = expectedExample({ includeHires: false });
    await app.open();
    await app.includeHires.uncheck();
    await expect(app.grid.locator("tbody tr.novo")).toHaveCount(0);
    await expect(app.personRows()).toHaveCount(schedule.roster.length);
    const gap = app.alerts.filter({ hasText: "Faltam pessoas em alguns dias" });
    await expect(gap).toContainText("Marque “Incluir as contratações” ou reduza as pessoas por dia.");
    await expect(app.page.locator("#weeks button.has-bad")).not.toHaveCount(0);
  });
});
