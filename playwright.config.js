/**
 * Testes de navegador. Os mesmos specs rodam contra:
 *   - src:  módulos ES servidos com os cabeçalhos de segurança do nginx (CSP de produção);
 *   - dist: arquivo único gerado por `npm run build` (sem CSP, como quando aberto do disco ou por e-mail).
 */

import { defineConfig, devices } from "@playwright/test";

const SRC_PORT = 4173;
const DIST_PORT = 4174;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1400, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "src",
      use: { baseURL: `http://127.0.0.1:${SRC_PORT}`, appPath: "/", expectsCsp: true },
    },
    {
      name: "dist",
      use: { baseURL: `http://127.0.0.1:${DIST_PORT}`, appPath: "/escala-5x2.html", expectsCsp: false },
    },
  ],
  webServer: [
    {
      command: `node tests/e2e/server.mjs --root src --port ${SRC_PORT} --security-headers`,
      url: `http://127.0.0.1:${SRC_PORT}/`,
      reuseExistingServer: false,
    },
    {
      // Gera o dist a partir do src atual antes de servir, para nunca testar um build velho.
      command: `node scripts/build-standalone.mjs && node tests/e2e/server.mjs --root dist --port ${DIST_PORT} --index escala-5x2.html`,
      url: `http://127.0.0.1:${DIST_PORT}/`,
      reuseExistingServer: false,
    },
  ],
});
