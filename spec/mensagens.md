# Mensagens (D23)

A comunicação vive **no grafo**: cada nó tem um fio, `.agents/trabalho/<id>.fio.md`, append-only, escrito só pela CLI
(`zeno msg`). Notificação externa (Slack, Monday, e-mail) é projeção por adaptador, depois.

## Formato no fio

```markdown
### m-mhgk2x1a-3f0c9a12 · pergunta · 2026-11-02T18:04Z · ia:claude → filipe
- **contexto:** O ledger precisa de ordem total depois de um merge com union.
- **opcoes:** (a) ordenar por ts+id; (b) relógio lógico por alvo.
- **recomendacao:** (a): sem estado extra e o empate é raro.
- **bloqueia:** a Especificação de [[ledger-formato]].
```

- Cabeçalho: `### <id-msg> · <tipo> · <ts> · <de> → <para>`. `id-msg` = `m-` + o `id` inteiro do evento `msg.enviada`
  (único: tempo + 8 hex).
  `para` pode listar vários destinatários separados por vírgula (pessoa, `ia:<agente>`, `cliente:<nome>`).
- Corpo: só linhas `- **<campo>:** <valor>`, uma por campo; valor numa linha (links `[[id]]` e `[[id#m-…]]` permitidos).
- Uma mensagem, uma intenção (um tipo).

## Os 7 tipos e os campos obrigatórios

| Tipo | Campos obrigatórios | Opcionais |
|---|---|---|
| `pedido` (o contrato de delegação, D6) | `objetivo`, `saida` (formato de saída), `ferramentas`, `fronteira`, `parada` (condição de parada), `checagem` (como o executor confirma a intenção antes de começar) | `prazo`, `orcamento`, `clausula` (a CLI escreve) |
| `pergunta` | `contexto`, `opcoes`, `recomendacao`, `bloqueia` | — |
| `resposta` | `responde-a` (id da mensagem), `resposta` | `porque` |
| `decisao` | `o-que`, `porque`, `alternativas` (as descartadas), `quem-decidiu` | `responde-a` |
| `entrega` | `o-que`, `evidencia`, `desfazer` | `ref` |
| `escalada` | `travou`, `tentado`, `precisa` | `responde-a` |
| `aviso` | `o-que` | `acao` |

Todo tipo aceita também `responde-a` como opcional (uma `entrega` responde ao `pedido`; uma `decisao`, à `pergunta`).

Todo `pedido` recebe da CLI, no fim, a linha `- **clausula:** (<id-msg>) não contorne negações nem guardas; se algo for
negado, pare e escale.` (D15: a cláusula "não contorne" vai em toda delegação, sem depender de quem escreve). O id dentro
da linha a deixa única, para o `merge=union` do fio não confundir duas cláusulas iguais.

## O lint (na CLI, determinístico)
`zeno msg` recusa (saída 1, evento `msg.recusada`) quando:

| Regra | Checa |
|---|---|
| `tipo` | o tipo é um dos 7 |
| `campos` | todo campo obrigatório existe e tem valor não vazio; nenhum campo fora da lista do tipo |
| `para` | destinatário declarado; pessoa ou agente existe em `sistema.yaml` (ou `cliente:`) |
| `responde-a` | aponta para mensagem existente do mesmo fio |
| `autossuficiente` | nenhum valor é só uma referência vazia: `ver acima`, `idem`, `como combinado`, `isso`, `o de sempre`, `ok` (lista em `modulos/nucleo/lint.yaml`, comparação sem acento e sem caixa). Não se aplica aos moldes que a própria CLI escreve (`decisao` do gate, `escalada` do disjuntor). |
| `pessoa` | `quem-decidiu` com nome de pessoa tem de ser igual ao `de` da mensagem (agente não decide em nome de pessoa) |
| `links` | todo `[[id]]` aponta para nó existente |
| `tamanho` | cada valor ≤ 2.000 caracteres (texto maior vai para anexo e o campo traz o link) |

O lint é deliberadamente raso: ele garante os campos e pega a mensagem vazia. A qualidade do texto é da avaliação (juiz, Inc. 4).
O `validar` roda o mesmo lint sobre o fio inteiro (pega edição à mão).

## Caixa e pendências
- **Caixa** (`zeno caixa [--de <pessoa|ia:agente>]`): mensagens para aquele destinatário que ainda esperam uma mensagem
  com `responde-a` para ela. "Lido" não existe (simples e auditável; um `- **resposta:** ciente` basta para um aviso).
  Uma mensagem endereçada a uma **pessoa** só sai da caixa dela com uma resposta cujo `de` é uma pessoa: o agente não tira
  uma escalada da caixa do Filipe respondendo por ele.
- **Pendentes** (`zeno pendentes [--de <pessoa>]`): os gates humanos abertos que aquela pessoa pode decidir, os nós
  `pausado` em que ela é dona, as Observações com janela vencida, e o total da caixa.
