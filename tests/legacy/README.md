# Legado (oráculo de regressão)

Cópia fiel do aplicativo **antes** da refatoração arquitetural. Nunca foi versionado em outro lugar:
estes arquivos são a única referência do comportamento original.

| Pasta | Conteúdo |
|---|---|
| `original/` | `app.js`, `index.html`, `styles.css`, `manifest.webmanifest`, `assets/`, `dist/` e README originais |
| `scratchpad-scripts/` | scripts usados para validar a refatoração (`parity.mjs`: motor; `e2e.py`: navegador), copiados sem alteração |
| `SHA256SUMS` | checksums dos arquivos acima (`sha256sum -c SHA256SUMS`) |

**Não edite nada aqui.** O teste `parity.test.js` carrega `original/app.js` em uma VM isolada e compara
o motor antigo com o atual em milhares de estados aleatórios com semente fixa.

Paridade prova apenas que o comportamento foi preservado — não que as regras trabalhistas estão corretas.
