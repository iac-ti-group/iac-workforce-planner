# Simulador Escala 5x2 · IAC Contabilidade Consultiva

Simulador da escala de trabalho após a EC 141/2026 (fim da 6x1): compara a jornada de hoje (44h) com as escalas 5x2 de 42h e 40h, monta a escala de 4 semanas por pessoa, confere as regras (2 folgas, domingos de mulheres e homens, 7 dias seguidos, limite semanal) e calcula o custo.

É um site **estático**: HTML, CSS e JavaScript puros. Não tem backend, banco de dados, build nem dependências de npm.

## Estrutura

```
escala-5x2/
├── index.html             página (marcação)
├── styles.css             estilos (desktop + modo app no celular, abaixo de 760px)
├── app.js                 toda a lógica (motor da escala, regras, custo, interface)
├── manifest.webmanifest   permite "Adicionar à tela inicial" como app
├── assets/
│   ├── logo.png
│   └── ceo.jpg
└── dist/
    └── escala-5x2.html    versão em arquivo único (tudo embutido), mesma funcionalidade
```

Use a pasta raiz para deploy. O `dist/escala-5x2.html` serve para enviar por e-mail ou abrir direto, sem servidor.

## Rodar localmente

Qualquer servidor estático:

```bash
cd escala-5x2
python3 -m http.server 8080      # ou: npx serve .
# abrir http://localhost:8080
```

## Deploy

Funciona em qualquer hospedagem estática. Exemplos:

- **Netlify / Vercel / Cloudflare Pages:** apontar para a pasta `escala-5x2` (sem comando de build, diretório de publicação = raiz).
- **GitHub Pages:** subir a pasta para um repositório e ativar Pages na branch.
- **Servidor próprio (nginx/Apache) ou S3 + CloudFront:** copiar os arquivos para a raiz pública.

Recomendações:
- Servir com **HTTPS** (o botão "Copiar semana" usa a API de área de transferência, que exige contexto seguro).
- `index.html` com cache curto (`no-cache`); `app.js`, `styles.css` e `assets/` podem ter cache longo se forem versionados (ex.: `app.js?v=2`).

## Dependências externas

- **Google Fonts** (Montserrat, Barlow, JetBrains Mono), carregadas de `fonts.googleapis.com`. Se a política de segurança não permitir, as fontes caem para as do sistema sem quebrar nada. Para hospedar localmente, baixar as fontes e trocar o `<link>` do `index.html`.
- Nenhuma biblioteca JavaScript externa.

Se houver Content-Security-Policy, o mínimo é:
`default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:`

## Dados e privacidade

- Nada é enviado a servidor. Tudo é calculado no navegador.
- O estado (segmento, equipe, turnos, salário etc.) fica no `localStorage` do próprio navegador, chave `iac-escala5x2-v3`. Para "zerar" os dados de todos ao mudar a estrutura, trocar a constante `KEY` em `app.js`.

## Onde ajustar regras e parâmetros (app.js)

| O quê | Onde |
|---|---|
| Encargos e provisões fixos (75%) | constante `ENC` |
| Segmentos e horários de referência | array `SEGS` |
| Exemplos de jornada 44h | objeto `MODELOS` |
| Jornada por fase (44/42/40h, dias, minutos por dia) | função `params()` |
| Intervalo/almoço | funções `intOf()` / `spanOf()` |
| Turnos (quando aparecem, sugestão de horários) | `sugerirTurnos()`, `usaTurnos()`, `aplicarTurnos()` |
| Motor da escala (folgas, domingos, 7 dias seguidos) | função `build()` |
| Verificações e avisos legais | função `check()` |
| Cálculo de custo | função `renderCost()` |
| Modo app no celular | bloco "Modo app (celular)" no fim do arquivo + `@media (max-width:760px)` em `styles.css` |

Regras implementadas: 2 repousos semanais (EC 141), teto de 42h a partir de 16/12/2026 e 40h a partir de 16/12/2027, mulheres em domingos alternados (CLT art. 386), homens no comércio com folga dominical a cada 3 semanas (Lei 10.101/2000) e nas demais atividades a cada 7, proibição de 7 dias seguidos (OJ 410 SDI-1), intervalo intrajornada de 1h a 2h (CLT art. 71).

## Compatibilidade

Feito para navegadores atuais (Chrome, Edge, Firefox, Safari no iOS e Android) com suporte a ES2020. Não funciona no Internet Explorer. Vale o TI conferir nos aparelhos da equipe antes de divulgar.

---
IAC Contabilidade Consultiva · Araras/SP. Simulação orientativa; conferir a convenção coletiva antes de aplicar.
