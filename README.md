# Simulador Escala 5x2 · IAC Contabilidade Consultiva

Simulador da escala de trabalho após a EC 141/2026 (fim da 6x1): compara a jornada de hoje (44h) com as escalas 5x2 de 42h e 40h, monta a escala de 4 semanas por pessoa, confere as regras (2 folgas, domingos de mulheres e homens, 7 dias seguidos, limite semanal) e calcula o custo.

É um site **estático**: HTML, CSS e JavaScript puros (módulos ES). Não tem backend, banco de dados nem dependências de npm.

## Estrutura

```
├── src/                          tudo que é publicado
│   ├── index.html                página (marcação)
│   ├── manifest.webmanifest      "Adicionar à tela inicial" como app
│   ├── styles/styles.css         estilos (desktop + modo app abaixo de 760px)
│   ├── assets/images/            logo.png, ceo.jpg
│   └── js/
│       ├── main.js               ponto de entrada: monta as dependências
│       ├── domain/               regras de negócio puras, sem DOM
│       ├── application/          casos de uso e orquestração
│       ├── infrastructure/       persistência (localStorage)
│       ├── ui/                   views, eventos e formatação
│       └── shared/               utilitários genéricos
├── config/nginx/default.conf     servidor local (cabeçalhos de segurança, CSP)
├── docker-compose.yml            ambiente local
├── scripts/build-standalone.mjs  gera dist/escala-5x2.html
├── tests/                        testes (node:test)
└── dist/                         saída do build (não versionada)
```

### Camadas

As dependências apontam sempre para dentro: `ui → application → domain`. O domínio não conhece o DOM nem o `localStorage`, por isso é testado direto no Node.

| Camada | Responsabilidade |
|---|---|
| `domain/` | jornada por fase, demanda, turnos, motor da escala, verificações legais, custo |
| `application/` | ações do usuário sobre o estado (`actions.js`), ciclo recalcular → salvar (`simulator.js`), mensagens e texto para WhatsApp |
| `infrastructure/` | leitura/gravação no `localStorage`, com validação dos dados salvos |
| `ui/` | renderização de cada área da tela e tratamento de eventos (delegação) |

## Rodar localmente

Com Docker:

```bash
docker compose up -d          # ou: npm start
# abrir http://localhost:8080
docker compose down           # ou: npm stop
```

Para usar outra porta: `APP_PORT=3000 docker compose up -d`. A pasta `src/` é montada como volume, então basta recarregar a página depois de editar.

O container usa `nginx-unprivileged` (sem root), sistema de arquivos somente leitura, sem capabilities e com a porta publicada só em `127.0.0.1`. Para abrir na rede local (ex.: testar no celular): `APP_BIND=0.0.0.0 docker compose up -d`.

Sem Docker, qualquer servidor estático apontando para `src/` funciona (`python -m http.server 8080 -d src`). Abrir o `index.html` direto do disco não funciona porque o navegador bloqueia módulos ES em `file://`; para isso use a versão em arquivo único.

## Testes e build

Requer Node 22+ (sem `npm install`, não há dependências).

```bash
npm test               # unitários, golden, paridade com o legado e casos de referência
npm run test:e2e       # navegador (Playwright) em src/ e dist/ — 1ª vez: npx playwright install chromium
npm run bench          # tempo do motor nos piores casos permitidos pelos limites
npm run build          # gera dist/escala-5x2.html (tudo embutido, abre sem servidor)
```

- `tests/golden/` e `tests/legacy/` preservam o comportamento; **não provam correção jurídica**.
- `tests/reference/` traz cálculos feitos à mão; divergências conhecidas aparecem como `todo`.
- Fórmulas, fontes e status legal de cada regra: [`docs/calculos-e-regras.md`](docs/calculos-e-regras.md).

O `dist/escala-5x2.html` serve para enviar por e-mail ou abrir direto do disco.

## Deploy

Publicar a pasta `src/` em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, GitHub Pages, nginx, S3 + CloudFront), sem comando de build.

Recomendações:
- Servir com **HTTPS** (o botão "Copiar semana" usa a API de área de transferência, que exige contexto seguro).
- Reaproveitar os cabeçalhos de `config/nginx/default.conf` (CSP, `nosniff`, `frame-ancestors`).
- `index.html` com cache curto (`no-cache`). Os arquivos não têm hash no nome; para cache longo em JS/CSS, versione a URL.

## Identidade visual e dependências

- Visual alinhado ao IAC System (`/central`): Plus Jakarta Sans, neutros, cards com borda fina, estados em verde/âmbar/vermelho sempre acompanhados de texto ou ícone, tema claro e escuro conforme o sistema operacional.
- **Nenhuma dependência externa em tempo de execução**: as fontes (Plus Jakarta Sans e Montserrat, licença OFL) ficam em `src/assets/fonts/`; ícones são traçados do Tabler Icons (MIT) embutidos.

CSP usada (`config/nginx/default.conf`), sem nenhum domínio externo:
`default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:`

## Dados e privacidade

- Nada é enviado a servidor. Tudo é calculado no navegador.
- O estado fica no `localStorage` do navegador, chave `iac-escala5x2-v4` (`{ schemaVersion: 4, ... }`).
- A chave da versão anterior (`iac-escala5x2-v3`) só é lida quando a v4 não existe, e **nunca é alterada**.
- Os dados lidos são validados. Valores inválidos ou acima dos limites são corrigidos **com aviso na tela**. Antes de gravar por cima, o app guarda uma cópia em `iac-escala5x2-backup-<data>` (as 5 mais recentes). Se a cópia falhar, nada é gravado nesta sessão.
- Dados inutilizáveis abrem o exemplo em **modo seguro**: nada é gravado até o usuário confirmar "Começar com o exemplo", e os dados originais podem ser baixados.
- "Apagar dados salvos" pede confirmação e guarda uma cópia antes.

### Limites do simulador (`src/js/domain/limits.js`)

| Item | Limite |
|---|---|
| Pessoas (equipe + contratações) | 200; as contratações ficam limitadas ao que sobra, com aviso |
| Pessoas por dia / soma dos turnos de um dia | 200 |
| Ajustes manuais | pessoas × 4 semanas × 7 dias |
| Almoço | opções do seletor (30 min a 3h) |
| Nome | 80 caracteres |

## Onde ajustar regras e parâmetros (`src/js/domain/`)

| O quê | Onde |
|---|---|
| Encargos (75%), divisores 220/210/200, limites de almoço e domingos | `laborRules.js` |
| Segmentos e horários de referência | `segments.js` (só acrescente no fim: o índice é salvo) |
| Exemplos de jornada 44h | `workModels.js` |
| Jornada por fase (44/42/40h, dias, minutos por dia) e intervalo | `workload.js` |
| Pessoas por dia e pessoas necessárias | `demand.js` |
| Turnos (quando aparecem, sugestão de horários) | `shiftPlan.js` |
| Motor da escala (folgas, domingos, 7 dias seguidos) | `scheduler.js` |
| Horários de entrada, saída e almoço | `assignments.js` |
| Verificações e avisos legais | `compliance.js` |
| Cálculo de custo | `cost.js` |
| Modo app no celular | `ui/views/mobileView.js` + `@media (max-width:760px)` em `styles.css` |

Regras implementadas: 2 repousos semanais (EC 141), teto de 42h a partir de 16/12/2026 e 40h a partir de 16/12/2027, mulheres em domingos alternados (CLT art. 386), homens no comércio com folga dominical a cada 3 semanas (Lei 10.101/2000) e nas demais atividades a cada 7, proibição de 7 dias seguidos (OJ 410 SDI-1), intervalo intrajornada de 1h a 2h (CLT art. 71).

## Compatibilidade

Navegadores atuais (Chrome, Edge, Firefox, Safari no iOS e Android) com suporte a módulos ES e ES2020. Não funciona no Internet Explorer.

---
IAC Contabilidade Consultiva · Araras/SP. Simulação orientativa; conferir a convenção coletiva antes de aplicar.
