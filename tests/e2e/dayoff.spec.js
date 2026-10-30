import { test, expect } from "./fixtures.js";
import { moveDayOff, toggleWorkday } from "../../src/js/application/actions.js";
import { describeDayOffChange } from "../../src/js/application/changeFeedback.js";
import { evaluateCompliance } from "../../src/js/domain/compliance.js";
import { buildSchedule } from "../../src/js/domain/scheduler.js";
import { DAY_NAMES, dayOffAndWorkday, expectedExample } from "./oracle.js";

const PERSON = 0;

/** Resultado esperado de uma ação de folga, calculado pelo domínio. */
function expectedAfter(action, ...args) {
  const { state, schedule } = expectedExample();
  action(state, schedule, ...args);
  const updated = buildSchedule(state);
  return { schedule: updated, compliance: evaluateCompliance(state, updated), state };
}

test.describe("arrastar e trocar folgas (desktop)", () => {
  test("arrastar uma folga para um dia trabalhado da mesma pessoa troca os dois dias", async ({ app }) => {
    const { schedule } = expectedExample();
    const { off, work } = dayOffAndWorkday(schedule, 0, PERSON);
    const expected = expectedAfter(moveDayOff, PERSON, off, work);
    const feedback = describeDayOffChange(expected.state, expected.schedule, expected.compliance, {
      personIndex: PERSON, day: work, worksNow: false, fromDay: off,
    });

    await app.open();
    await app.dragBetween(app.cell(PERSON, off), app.cell(PERSON, work));

    expect(await app.workRow(PERSON)).toEqual(expected.schedule.weeks[0][PERSON]);
    await expect(app.cell(PERSON, off)).toHaveClass(/\bman\b/);
    await expect(app.cell(PERSON, work)).toHaveClass(/\bman\b/);
    await expect(app.toast).toBeVisible();
    await expect(app.toast.locator("b")).toHaveText(feedback.title);
    expect(feedback.title).toBe(`Folga ajustada de ${DAY_NAMES[off]} para ${DAY_NAMES[work]}`);
    await expect(app.undoButton).toBeVisible();
  });

  test("soltar a folga na linha de outra pessoa não muda nada", async ({ app }) => {
    const { schedule } = expectedExample();
    const { off } = dayOffAndWorkday(schedule, 0, PERSON);
    const other = 1;
    const otherWork = schedule.weeks[0][other].findIndex((works, day) => works && day < 6);

    await app.open();
    await app.dragBetween(app.cell(PERSON, off), app.cell(other, otherWork));

    expect(await app.workRow(PERSON)).toEqual(schedule.weeks[0][PERSON]);
    expect(await app.workRow(other)).toEqual(schedule.weeks[0][other]);
    await expect(app.undoButton).toBeHidden();
    await expect(app.toast).toBeHidden();
  });

  test("clicar num dia trabalhado vira folga; “Desfazer ajustes manuais” volta à sugestão", async ({ app }) => {
    const { schedule } = expectedExample();
    const { work } = dayOffAndWorkday(schedule, 0, PERSON);
    const expected = expectedAfter(toggleWorkday, PERSON, work);

    await app.open();
    await app.cell(PERSON, work).click();
    expect(await app.workRow(PERSON)).toEqual(expected.schedule.weeks[0][PERSON]);
    await expect(app.cell(PERSON, work)).toHaveText("Folga");
    await expect(app.toast).toBeVisible();

    await app.undoButton.click();
    expect(await app.workRow(PERSON)).toEqual(schedule.weeks[0][PERSON]);
    await expect(app.undoButton).toBeHidden();
  });

  test("forçar trabalho no 2º domingo seguido de uma mulher mostra a violação", async ({ app }) => {
    // Ana trabalha no domingo da semana 1; forçar também o da semana 2 quebra o revezamento alternado.
    const { schedule } = expectedExample();
    expect(schedule.weeks[0][PERSON][6]).toBe(true);
    expect(schedule.weeks[1][PERSON][6]).toBe(false);

    await app.open();
    await app.weekButton(1).click();
    await app.cell(PERSON, 6).click();

    await expect(app.toast).toHaveClass(/\bbad\b/);
    await expect(app.toast.locator("b")).toHaveText("Regra do domingo: dois domingos seguidos");
    await expect(app.cell(PERSON, 6)).toHaveClass(/\berr\b/);
    await expect(app.weekButton(1)).toHaveClass(/has-bad/);
    await expect(app.alerts.filter({ hasText: "Ana: dois domingos seguidos" })).toHaveCount(1);
  });
});
