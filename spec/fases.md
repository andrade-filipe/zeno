# As fases

Ordem fixa: **intencao → especificacao → execucao → verificacao → entrega → observacao → aprendizado → (fechado)**.
Nenhuma fase é pulada; o artefato é **proporcional** ao `tamanho` (D8). A spec diz o quê, não o como.

## Os cartões (módulo `nucleo`)

Cada cartão mora em `zeno/modulos/nucleo/cartoes/<fase>.md` e entra no pacote de contexto daquela fase. Um módulo de
domínio (Inc. 3) pode acrescentar skills, templates e checks a um cartão; não pode tirar chave obrigatória nem afrouxar gate.

| Fase | Pergunta que responde | Artefato (chaves obrigatórias, todo tamanho) | P | M / G acrescenta | Gate típico |
|---|---|---|---|---|---|
| **Intenção** | Por que isto, e para quem? | `- porque:` | uma linha | `- para:` (quem se beneficia) · `- fora:` (o que não é) | check |
| **Especificação** | O que é estar pronto? | `- pronto:` (critério verificável) | uma linha | `- restricoes:` · `- riscos:` · filhos ou plano de corte, se G | check · **humano** na faixa `aprovacao`/`nunca` |
| **Execução** | O que foi feito? | `- feito:` (resumo + refs: commits, arquivos, nós filhos) | uma linha | — | check |
| **Verificação** | Está pronto pelo critério? Como sei? | `- evidencia:` (comando + resultado, ou link) | uma linha | `- pronto-confere:` (cada critério → evidência) | check (os `checks` do nó rodam aqui) · humano na `nunca` |
| **Entrega** | Onde está, e como desfaço? | `- ref:` (commit, PR, arquivo, URL) · `- desfazer:` | uma linha cada | — | check · **humano** na `aprovacao`/`nunca` |
| **Observação** | Deu o efeito esperado na janela? | `- observado:` | `janela: 0d` ⇒ a CLI escreve `- observado: sem janela` | a janela declarada tem de ter passado desde a entrega | check |
| **Aprendizado** | Houve atrito? O que muda? | `- atrito:` (`nenhum`, ou uma descrição; `[[id-da-licao]]` opcional) | a CLI aceita `nenhum` por padrão | — | check |

O gate **check** de toda fase é: (1) as chaves obrigatórias da fase existem e não estão vazias (se faltam, é
`artefato.incompleto`, saída 1, sem contar tentativa); (2) as regras extras da fase (abaixo) valem; (3) quando a fase é
`verificacao`, os `checks` do nó saem com código 0 (sem `checks` no nó, valem os `checks_padrao` do `sistema.yaml`).

**Cartão de decisão (T75, D36).** Um gate **humano** só abre se a seção da fase tem o cartão, 6 chaves em linguagem
simples para quem aprova: `- cartao-muda:` (o que muda), `- cartao-porque:` (por quê), `- cartao-risco:` (risco),
`- cartao-desfazer:` (como desfazer), `- cartao-reprovar:` (o que acontece se reprovar) e `- cartao-conferir:` (de 1 a 3
coisas a conferir, separadas por `;` ou numeradas `(1) … (2) …`). Campo que falta, vazio, genérico (os `vazios` do
`lint.yaml`: "ok", "ver acima"…) ou com menos de 8 letras não vale: `artefato.incompleto` (só os nomes dos campos no
ledger), saída 1, e o gate não abre. **D40:** cada campo cabe em 160 caracteres e cada item do conferir em 100 (frase
curta é parte do cartão; o detalhe fica nas seções), e o `cartao-risco` começa pelo nível, `alto:`, `baixo:` ou
`nenhum:`, que a caixa usa para decidir o que abre sozinho ([tela](tela.md)). Vale para os gates que abrem depois da
D40; cartão de antes, sem nível, aparece aberto. `avancar --cartao-<campo> "…"` escreve o cartão na fase do **próximo** gate humano
(a partir da fase atual). Gate reaberto (T15) e gate `check` não pedem cartão. O cartão é texto do nó: entra no
`artefato_sha256` que a pessoa assina.

**Atrito** (o que tira o `nenhum` do Aprendizado): no ledger do nó, um gate reprovado, um `disjuntor.disparou`, uma
`recusa` de guarda, ou uma `escalada` no fio. Erro de digitação (`artefato.incompleto`) e lint de mensagem não contam.

Regras extras:
- **Especificação:** cada nó em `depende_de` já passou da Entrega.
- **Especificação, delegação:** se o nó é M ou G, o `executor` é agente e **quem criou o nó é outro ator** (delegação de
  verdade), o fio precisa ter um `pedido` (o contrato de delegação, D6). Nos outros casos vale o `delegacao_padrao` do
  `sistema.yaml` (o agente não escreve um pedido para si mesmo).
- **Verificação:** todo filho já passou da Entrega ou está `cancelado` (a Observação de um filho não trava o pai).
- **Execução:** na faixa efetiva `nunca`, só uma pessoa sai desta fase.
- **Observação:** `agora − ts(fase.avancou de: entrega) ≥ janela`.
- **Entrega de nó P:** se a `ref` é um commit, as linhas mudadas ≤ `sistema.yaml → limites.P_linhas` (padrão 80); acima disso o nó não é P (contramétrica do tamanho declarado).

## Sessão por fase
Não é regra (D21 revisada). O pacote de contexto (`zeno contexto`) serve para começar uma fase numa sessão nova quando o nó
for grande. A Verificação de nó **G** pede sessão nova: o gate check exige `- sessao: nova` na Verificação (o agente
declara; o fato fica no ledger para a avaliação cruzar).

## Via expressa (D19)

**Para quê:** um nó pequeno não pode custar mais Zeno do que trabalho. É o anti-engessamento do desenho.

**Quem pode:** `tamanho: P` **e** faixa efetiva `autonoma`. `novo --expressa` fora disso é recusado (saída 1). No alvo
que é o código do zeno, `--expressa --codigo` vale também para nó `nao-confiavel` (sessão contaminada), e a Entrega
confere que o commit só toca o código ([controle](controle.md), T76). O
`avancar --ate` funciona em qualquer nó, mas para no primeiro gate humano (saída 3) e diz qual é.

**Como:**
```
zeno novo "Corrigir typo no README" --expressa --porque "link quebrado na seção X"
#  …faz o trabalho…
zeno avancar corrigir-typo-no-readme --ate fim \
     --pronto "link abre" --feito "README.md:12" --evidencia "node --test: 14 pass" --ref 3f2a9c1 --desfazer "git revert 3f2a9c1"
```
- `novo --expressa` cria o nó P/autônomo e preenche `- porque:`. Dois comandos no total.
- `avancar --ate fim` escreve cada chave passada na seção certa, passa as 7 fases **uma a uma** (cada uma com seu gate
  check e seu evento `fase.avancou`) e fecha. Observação vira `sem janela` e Aprendizado vira `nenhum` (se o ledger não
  tiver atrito; se tiver, a CLI pede `--atrito "<texto>"`).
- Se uma chave falta, a CLI para na fase que precisa dela e diz qual chave falta (saída 1, `artefato.incompleto`, sem
  tentativa). Nada é desfeito: as fases já passadas ficam passadas.
- O ledger marca `expressa: true` no `no.criado`, para a avaliação estratificar.

**Registro retroativo** (D19): trabalho feito fora do Zeno entra depois por `zeno registrar` ([cli.md](cli.md)), com os
eventos marcados `retro: true`. Ninguém fica bloqueado; o desvio vira dado. Se a faixa efetiva não é `autonoma` e quem
registra é agente, o nó para no gate humano da Entrega antes de fechar (o retro não fura a faixa).
