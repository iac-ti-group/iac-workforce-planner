/**
 * Gera dist/escala-5x2.html: o app inteiro em um único arquivo (CSS, JS e imagens embutidos),
 * para enviar por e-mail ou abrir direto do disco, sem servidor.
 *
 * Os módulos ES de src/js são empacotados em um mini carregador de módulos (sem dependências).
 * Suporta apenas o que o projeto usa: `import { a, b as c } from "./x.js"`, `import * as ns from "./x.js"`
 * e `export` diante de declarações (`const`, `let`, `function`, `class`).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const JS_ROOT = join(SRC, "js");
const ENTRY = "main.js";
const OUTPUT = join(ROOT, "dist", "escala-5x2.html");

const IMPORT_PATTERN = /^import\s+(\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+["']([^"']+)["'];?[ \t]*$/gm;
const EXPORT_PATTERN = /^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const MIME_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

const read = (path) => readFileSync(path, "utf8");

function bundleModules() {
  const modules = new Map();
  const pending = [ENTRY];
  while (pending.length) {
    const id = pending.pop();
    if (modules.has(id)) continue;
    const { code, dependencies } = transformModule(id, read(join(JS_ROOT, id)));
    modules.set(id, code);
    pending.push(...dependencies);
  }
  const definitions = [...modules].map(([id, code]) => `__define(${JSON.stringify(id)}, function () {\n${code}\n});`);
  return [
    "(function () {",
    '"use strict";',
    "const __factories = {}, __cache = {};",
    "const __define = (id, factory) => { __factories[id] = factory; };",
    "const __require = (id) => __cache[id] || (__cache[id] = __factories[id]());",
    ...definitions,
    `__require(${JSON.stringify(ENTRY)});`,
    "})();",
  ].join("\n");
}

function transformModule(id, source) {
  const dependencies = [];
  const resolveId = (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`${id}: só imports relativos são suportados (${specifier})`);
    return posix.normalize(posix.join(posix.dirname(id), specifier));
  };

  let code = source.replace(IMPORT_PATTERN, (_, bindings, specifier) => {
    const dependency = resolveId(specifier);
    dependencies.push(dependency);
    const target = `__require(${JSON.stringify(dependency)})`;
    if (bindings.startsWith("*")) return `const ${bindings.split(/\s+as\s+/)[1]} = ${target};`;
    const names = bindings
      .slice(1, -1)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.replace(/\s+as\s+/, ": "));
    return `const { ${names.join(", ")} } = ${target};`;
  });

  const exported = [];
  code = code.replace(EXPORT_PATTERN, (_, keyword, name) => {
    exported.push(name);
    return `${keyword} ${name}`;
  });

  const unsupported = code.match(/^\s*(import|export)\b.*$/m);
  if (unsupported) throw new Error(`${id}: sintaxe de módulo não suportada: ${unsupported[0].trim()}`);

  return { code: `${code}\nreturn { ${exported.join(", ")} };`, dependencies };
}

const dataUri = (path) => {
  const mime = MIME_TYPES[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Tipo de arquivo não suportado: ${path}`);
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
};

/** CSS com url() relativos (fontes) embutidos como data URI, para o arquivo único funcionar sozinho. */
function inlineCssUrls(cssPath) {
  return read(cssPath).replace(/url\("([^"]+)"\)/g, (match, url) =>
    url.startsWith("data:") ? match : `url("${dataUri(join(dirname(cssPath), url))}")`,
  );
}

function build() {
  const script = bundleModules();
  if (script.includes("</script")) throw new Error("O JavaScript contém '</script' e quebraria o HTML.");

  let html = read(join(SRC, "index.html"));
  html = html.replace(/^<link rel="manifest"[^>]*>\n/m, "");
  html = html.replace(/^<link rel="preload"[^>]*>\n/gm, ""); // a fonte já vai embutida no CSS
  html = html.replace(/<link rel="stylesheet" href="(styles\/[^"]+)">/g, (_, href) => `<style>\n${inlineCssUrls(join(SRC, href))}\n</style>`);
  html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_, attribute, path) => `${attribute}="${dataUri(join(SRC, path))}"`);
  html = html.replace(/<script type="module" src="js\/main\.js"><\/script>/, () => `<script>\n${script}\n</script>`);
  if (/(?:src|href)="(?:assets|styles|js)\//.test(html)) throw new Error("Ainda há referências a arquivos locais no HTML.");

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, html);
  console.log(`Gerado ${relative(ROOT, OUTPUT)} (${Math.round(html.length / 1024)} KB)`);
}

build();
