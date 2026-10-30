/**
 * Regressão permanente: cada fixture guarda entrada + saída esperada do simulador.
 * Falhou? Ou é regressão, ou é mudança de comportamento que precisa de aprovação antes de regenerar.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCase } from "./run.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "golden");
const files = readdirSync(FIXTURES).filter((file) => file.endsWith(".json")).sort();

test("existem fixtures do golden", () => assert.ok(files.length >= 60, `apenas ${files.length} fixtures`));

for (const file of files) {
  const expected = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
  test(`golden: ${expected.name}`, () => {
    const actual = runCase(expected.input);
    assert.deepStrictEqual(actual.normalized, expected.normalized, "estado normalizado");
    assert.deepStrictEqual(actual.schedule, expected.schedule, "escala");
    assert.deepStrictEqual(actual.compliance, expected.compliance, "verificações");
    assert.deepStrictEqual(actual.cost, expected.cost, "custo");
  });
}
