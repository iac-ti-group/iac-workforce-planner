/**
 * Gera/atualiza tests/fixtures/golden/*.json.
 *
 * ATENÇÃO: o golden só deve ser regenerado para registrar uma mudança de comportamento APROVADA,
 * com o diff revisado. Por isso a escrita exige GOLDEN_UPDATE=1.
 *
 *   GOLDEN_UPDATE=1 node tests/golden/generate.mjs                # recalcula as saídas das entradas já gravadas
 *   GOLDEN_UPDATE=1 node tests/golden/generate.mjs --new-inputs   # recria também as entradas (cases.js)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCaseInputs } from "./cases.js";
import { runCase } from "./run.js";
import { formatJson } from "../support/snapshot.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "golden");

if (process.env.GOLDEN_UPDATE !== "1") {
  console.error("Recusado: defina GOLDEN_UPDATE=1 (e só regenere com mudança de comportamento aprovada).");
  process.exit(1);
}

const existing = existsSync(FIXTURES) ? readdirSync(FIXTURES).filter((file) => file.endsWith(".json")) : [];
const useNewInputs = process.argv.includes("--new-inputs") || existing.length === 0;
const cases = useNewInputs
  ? buildCaseInputs()
  : existing.sort().map((file) => {
      const { name, input } = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
      return { name, input };
    });

if (useNewInputs) rmSync(FIXTURES, { recursive: true, force: true });
mkdirSync(FIXTURES, { recursive: true });
for (const { name, input } of cases) {
  writeFileSync(join(FIXTURES, `${name}.json`), formatJson({ name, input, ...runCase(input) }) + "\n");
}
console.log(`${cases.length} casos gravados em tests/fixtures/golden (${useNewInputs ? "entradas novas" : "entradas preservadas"}).`);
