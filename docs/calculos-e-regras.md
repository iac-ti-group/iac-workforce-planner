# Cálculos e regras do simulador

Referência técnica da auditoria (Etapa A, 30/10/2026). Cada cálculo traz regra, entradas, fórmula,
verificação independente e status. Os casos verificados estão em `tests/reference/calculations.test.js`.

**O simulador é orientativo.** Nada aqui substitui a análise da convenção coletiva aplicável.

## Legenda de status das regras

| Status | Significado |
|---|---|
| ✅ Lei | Regra confirmada em lei/norma vigente |
| 🤝 Convenção | Depende de convenção/acordo coletivo ou situação específica |
| ❓ A confirmar | Fonte ainda não verificada no texto oficial |
| ⚙️ Simplificação | Escolha do simulador, sem base legal direta |

## 1. Jornada por fase

| Fase | Dias trabalhados | Minutos/dia | Fórmula | Status |
|---|---|---|---|---|
| 44h (hoje) | min(6, dias abertos) | 440 com 6 dias; 528 com 5 | 44 × 60 ÷ dias, máx. 528 | ✅ CF art. 7º XIII (redação anterior) |
| 44h modelo seg–sáb | 6 | 480 seg–sex, 240 sáb | 5 × 8 + 4 = 44 | ✅ |
| 42h (16/12/2026) | min(5, dias abertos) | 504 (8h24) | 42 × 60 ÷ 5 | 🤝 8h24 > 8h diárias: exige compensação por convenção (EC 141) |
| 40h (16/12/2027) | min(5, dias abertos) | 480 | 40 × 60 ÷ 5 | ✅ EC 141/2026 |

- **Verificado:** todos os valores conferem com o cálculo manual.
- **Observação (⚙️):** com menos de 5 dias abertos, a pessoa trabalha só os dias abertos (ex.: 4 × 8h = 32h em 40h). O resultado é coerente, mas a tela não explica que sobra carga contratada.

## 2. Intervalos (CLT art. 71) ✅

- Até 4h de trabalho: sem intervalo. Acima de 4h e até 6h: 15 min. Acima de 6h: o almoço escolhido (1h a 2h).
- Menos de 1h exige convenção ou autorização do MTE 🤝. Mais de 2h exige acordo escrito 🤝. O simulador avisa nos dois casos.
- Duração do dia: `saída = entrada + trabalho + intervalo`.

## 3. Descanso entre jornadas — CLT art. 66 (11h) ✅ — **NÃO VERIFICADO PELO SIMULADOR (D1)**

- Não existe nenhuma checagem de descanso entre uma jornada e a do dia seguinte.
- **Evidência:** o exemplo em 40h tem 12 ocorrências de 9h de descanso (saída às 22:00, entrada às 07:00).
- Em 168 de 400 estados aleatórios houve descanso menor que 11h; em horários que passam da meia-noite, chegou a haver sobreposição de jornadas.
- **Gravidade: ALTA.**
- **Correção proposta:** um alerta novo, e manter a pessoa no mesmo turno em dias consecutivos.

## 4. Repouso semanal e domingos

| Regra | Implementação | Status |
|---|---|---|
| 2 repousos semanais (EC 141) | `minDaysOff = 2` em 42/40h | ✅ |
| Nunca 7 dias seguidos (OJ 410 SDI-1) | verificado nas 4 semanas, contando a virada entre semanas | ✅ jurisprudência |
| Mulheres: domingos alternados (CLT art. 386) | quem trabalha num domingo folga no seguinte | ✅ na lei; aplicação discutida na jurisprudência |
| Homens no comércio: 1 domingo de folga a cada 3 semanas | no máximo 2 domingos seguidos | ✅ Lei 10.101/2000 art. 6º, parágrafo único |
| Homens em outras atividades: 1 a cada 7 semanas | no máximo 6 domingos seguidos | ❓ Portaria MTP 671/2021 (revezamento); prazo de 7 semanas a confirmar |
| Contratação sem sexo definido | segue a regra feminina (mais restritiva) | ⚙️ |

- **D2 (MÉDIA):** a escala de 4 semanas não é verificada como ciclo que se repete. Se for repetida, 4,3% das pessoas (169 de 3.913 na amostra) formam 7 ou mais dias seguidos na virada da semana 4 para a semana 1. A tela não diz se a escala é um ciclo.

## 5. Feriados — **NÃO IMPLEMENTADO**

A aba "Regras" cita a Portaria MTE 1.316/2026 (❓ a confirmar), mas o simulador não tem calendário de feriados nem calcula feriados trabalhados.

## 6. Demanda (pessoas por dia) ⚙️

| Situação | Fórmula |
|---|---|
| 7 dias abertos | turnos = equipe × 6; domingo = max(1, round(0,4 × equipe)); resto dividido entre seg e sáb, sobra nos primeiros dias |
| Até 6 dias abertos | cada dia aberto = equipe inteira |

- **Interpretação:** é a cobertura de hoje (6x1). O fator de 40% no domingo é uma escolha do simulador.
- **Plano de turnos:** seg a sex compartilham o mesmo quadro de turnos, então quinta e sexta passam de 7 para 8 (vale validar a regra de negócio).

## 7. Pessoas necessárias ⚙️

`necessárias = max(⌈turnos da semana ÷ dias trabalhados⌉, pico diário, equipe + reforço de domingo)`

- **Capacidade de domingo:** mulheres × 0,5 + homens × (2/3 no comércio ou 6/7 nas outras atividades). O reforço é a falta dividida por 0,5.
- **D5 (MÉDIA):** a fórmula inclui a equipe atual, então o resultado **nunca é menor que a equipe**. Com demanda de 2 pessoas por dia em 40h bastariam 3, mas a tela mostra 8. O rótulo "Pessoas necessárias" induz a erro.
- **Limitação:** a fórmula é uma estimativa. O motor de escala é guloso, ou seja, escolhe dia a dia sem garantir a melhor combinação, e pode deixar falta mesmo quando haveria solução. A tela mostra a falta nesse caso.

## 8. Custos

| Item | Fórmula | Status |
|---|---|---|
| Custo por pessoa | salário × (1 + 75%) + benefícios | ⚙️ 75% fixo |
| Hora | custo por pessoa ÷ divisor; divisor = horas semanais × 5 (220, 210, 200) | ✅ Súmula 431 para 200; 210 por proporção ❓ |
| Horas perdidas por mês | equipe × (220 − divisor) | ✅ coerente com os divisores |
| Contratações | faltam × custo por pessoa | ✅ |

**Valores do exemplo (42h), conferidos à mão:**
- custo por pessoa R$ 3.762,50;
- folha R$ 30.100;
- hora R$ 17,10 → R$ 17,92 (+4,76%);
- 80h perdidas por mês.

**Divergências:**
- **D3 (ALTA):** "Sem contratar: +R$ 1.433" usa a hora **normal**. Repor as horas sem contratar exige hora extra: 80h × (2.150 ÷ 210) × 1,5 × 1,75 = **R$ 2.150**. A tela subestima esse cenário em 33%.
- **D4 (MÉDIA):** a hora extra das contratações considera 30/7 semanas por mês (180h em 42h), enquanto o divisor considera 5 semanas (210h). São duas bases de mês diferentes no mesmo cartão.
- **D6 (ALTA, regra):** encargos fixos de 75% servem para empresas do Lucro Presumido ou Real. No **Simples Nacional** (Anexos I a III) não há INSS patronal de 20%, e os encargos ficam tipicamente entre 35% e 45%. Para a maioria das pequenas e médias empresas, o custo fica superestimado. Proposta: escolher o regime tributário ou informar o percentual (🤝 depende da empresa).

## 9. Cenários extremos

- Demanda de 20.000 pessoas no `localStorage` gerava 23.992 contratações e travava o app por 11,8 s. **Corrigido na E2** (limites).
- Equipe vazia, todos os dias fechados e expediente noturno: cobertos pelo golden e pelos testes aleatórios.

## 10. Fontes consultadas

- EC 141/2026, promulgada em 16/10/2026: Fenacon, LegisWeb, Correio da Manhã. **O texto oficial do DOU ainda precisa ser conferido** para os números de artigos citados na tela (ex.: "EC 141 art. 3º" e "art. 7º").
- Portaria MTP 671/2021 e o conflito com a Lei 10.101 no comércio: Conjur, Machado Meyer.
