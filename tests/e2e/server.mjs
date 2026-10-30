/**
 * Servidor HTTP estático para os testes de navegador (sem dependências).
 *
 *   node tests/e2e/server.mjs --root src  --port 4173 --security-headers
 *   node tests/e2e/server.mjs --root dist --port 4174 --index escala-5x2.html
 *
 * --security-headers aplica os mesmos cabeçalhos do nginx (lidos de config/nginx/default.conf),
 * para que a CSP testada seja exatamente a usada no ambiente local/produção.
 */

import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NGINX_CONF = join(ROOT_DIR, "config", "nginx", "default.conf");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function parseArgs(argv) {
  const args = { root: "src", port: 4173, index: "index.html", securityHeaders: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") args.root = argv[++i];
    else if (argv[i] === "--port") args.port = Number(argv[++i]);
    else if (argv[i] === "--index") args.index = argv[++i];
    else if (argv[i] === "--security-headers") args.securityHeaders = true;
  }
  return args;
}

/** Lê as diretivas `add_header Nome "valor" always;` do nginx. */
export function nginxSecurityHeaders(conf = readFileSync(NGINX_CONF, "utf8")) {
  const headers = {};
  for (const [, name, value] of conf.matchAll(/^\s*add_header\s+([\w-]+)\s+"([^"]*)"\s+always;/gm)) headers[name] = value;
  if (!headers["Content-Security-Policy"]) throw new Error("CSP não encontrada em config/nginx/default.conf");
  return headers;
}

function start({ root, port, index, securityHeaders }) {
  const base = resolve(ROOT_DIR, root);
  const extraHeaders = securityHeaders ? nginxSecurityHeaders() : {};

  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += index;
    const file = normalize(join(base, path));
    const send = (status, body, type = "text/plain; charset=utf-8") => {
      response.writeHead(status, { "Content-Type": type, ...extraHeaders });
      response.end(body);
    };

    // Bloqueia saída da raiz e arquivos ocultos, como o nginx (location ~ /\.).
    if (!file.startsWith(base + sep) || path.split("/").some((part) => part.startsWith("."))) return send(403, "Forbidden");
    try {
      if (!statSync(file).isFile()) return send(404, "Not found");
      send(200, readFileSync(file), MIME_TYPES[extname(file).toLowerCase()] || "application/octet-stream");
    } catch {
      send(404, "Not found");
    }
  });
  server.listen(port, "127.0.0.1", () => console.log(`Servindo ${root} em http://127.0.0.1:${port}/`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start(parseArgs(process.argv.slice(2)));
