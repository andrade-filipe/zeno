# O nó

## Layout em disco (dentro de um alvo)

```
<alvo>/
  AGENTS.md                      canônico: blocos gerados pelos módulos + bloco manual (instalacao.md)
  CLAUDE.md                      gerado: cabeçalho + "@AGENTS.md"
  .claude/                       gerado (settings.json, skills/zeno-*/)
  .agents/
    sistema.yaml                 composição: módulos e versões, fronteira, pessoas, padrões, checks, tetos
    faixas.yaml                  tabela de faixas e de gates por papel (controle.md)
    gerados.lock                 caminho → sha256 de cada arquivo gerado (deriva)
    ledger.jsonl                 o ledger (ledger.md), append-only
    .gitattributes               "ledger.jsonl merge=union" e "trabalho/*.fio.md merge=union"
    .gitignore                   ".zeno.lock" (estado local da máquina)
    skills/                      skills locais do alvo (opcional)
    trabalho/
      <id>.md                    o nó
      <id>.fio.md                o fio de mensagens do nó (mensagens.md), append-only
      <id>/                      anexos do nó (opcional: artefatos grandes, linkados da seção da fase)
```

O grafo do Zeno sobre si mesmo mora em **`zeno/.agents/`** (o `zeno/` é alvo de si mesmo).

## Identidade
- `id`: `[a-z0-9][a-z0-9-]{1,47}`, único no alvo, igual ao nome do arquivo. A CLI gera do título (minúsculas, sem acento,
  hífens) e acrescenta `-2`, `-3`… se colidir. Num alvo com `fronteira: empresa`, o id é opaco (`n-` + 6 hex), para que
  nada do título vaze por id.
- Referência a nó de outro grafo: `<alvo>:<id>` (ex.: `vault:zeno-inc1`). No Inc. 1 o `validar` checa só a sintaxe.
- O `id` nunca muda. O título pode mudar.

## Frontmatter

Subconjunto de YAML do motor do hub (copiado, não importado — D3/D7): escalares, listas inline `[a, b]`, listas `- x`,
mapas aninhados por indentação. Sem lista de mapas, sem âncoras, sem multilinha. Diferenças da cópia: a chave
aceita `.` (ex.: `entrega.push-main`), e a CLI converte número e data pelo schema (o parser devolve texto).

```yaml
---
zeno: 1                        # versão do schema do nó
id: ledger-formato
tipo: tarefa                   # iniciativa | tarefa | licao | proposta
titulo: "Formato do ledger v1"
criado: 2026-11-02T18:04:11.000Z
pai: spec-inc1                 # id, "<alvo>:<id>" ou null
depende_de: [no-schema]        # opcional; ordem entre nós (campo de controle)
arestas:                       # opcional; arestas descritivas, vocabulário fechado abaixo
  relaciona: [ledger-exemplos]
fase: especificacao            # a fase em que o nó está
estado: ativo                  # ativo | em-gate | pausado | fechado | cancelado
dono: filipe
executor: ia:claude
revisor: filipe
tamanho: M                     # P | M | G
faixa: aprovacao               # declarada: autonoma | aprovacao | nunca
acoes: [entrega.push-main]     # opcional: ações da tabela de faixas que o nó vai fazer
procedencia: confiavel         # confiavel | nao-confiavel
origem: [pessoa:filipe]        # insumos: pessoa:<p> | ia:<a> | web:<url> | issue:<ref> | doc:<caminho> | mcp:<servidor> | no:<id> | sessao:contaminada | ledger:<id-evento> | msg:<id-msg> | sensor:<nome> (T117: o alarme da revisão semanal; no máximo 1 por sensor e 5 por semana ISO no alvo)
orcamento:                     # opcional; ausente = consome do pai (controle.md)
  tokens: 2000000
  usd: 0
  tentativas: 3
  prazo: 2026-11-09            # só aviso
janela: 3d                     # janela da Observação: <n>d | <n>h | 0d (padrão: P 3d, M e G 7d, expressa e retro 0d; T102)
modulo: nucleo                 # hoje sempre nucleo; o campo não muda nada
checks: [testes]               # opcional: nomes de checks de sistema.yaml usados nos gates check
refs: [zeno/spec/ledger.md]    # opcional: referências localizadas para o pacote de contexto ("arq" ou "arq#L10-L40")
fundamento: "..."              # opcional (D24): o porquê, em uma frase; sem rastreamento
---
```

### Duas classes de campo
- **Campos de controle** — `tipo`, `pai`, `fase`, `estado`, `dono`, `executor`, `revisor`, `tamanho`, `faixa`, `acoes`,
  `procedencia`, `depende_de`, `orcamento`, `janela`, `checks`. São **projeção do ledger**: nascem no evento `no.criado` e
  só mudam por evento (`fase.avancou`, `ajuste`, …). **A CLI lê o estado do ledger, nunca do frontmatter**; o frontmatter é
  uma vista que a CLI regrava a cada escrita. O `validar` refaz a projeção e acusa qualquer diferença (regra `projecao`);
  `zeno validar --reparar` regrava a vista a partir da projeção. Editar à mão não muda o estado.
- **Campos descritivos** — `titulo`, `origem` (o valor completo; o controle fica com `procedencia` e as classes no
  ledger), `arestas`, `refs`, `fundamento`, `modulo`. Podem ser editados à mão. Não afetam gate.

Derivados, **nunca escritos**: `filhos` (de `pai` dos outros nós), a faixa efetiva, o consumo de orçamento, as arestas inversas.

## Corpo

```markdown
# Formato do ledger v1

## Intenção
## Especificação
## Execução
## Verificação
## Entrega
## Observação
## Aprendizado
```

- As 7 seções existem desde o `novo`, nessa ordem, com esses títulos.
- Linhas-chave lidas pelos gates check têm a forma `- <chave>: <valor>` (ex.: `- pronto: …`, `- evidencia: …`). As chaves de cada
  fase estão em [fases.md](fases.md).
- Texto livre é permitido em qualquer seção. Comentários `<!-- -->` não contam como artefato.
- Artefato grande vai para `trabalho/<id>/` ou para fora de `.agents/` (ex.: `zeno/spec/`) e a seção traz o link.

## Arestas laterais (vocabulário fechado)

`depende_de` é campo de controle (frontmatter, lista de ids): o nó não sai de `especificacao` enquanto cada alvo não
passou da Entrega. Acrescentar é livre (`ajustar depende_de+=x`); tirar é afrouxar.

| Aresta (descritiva) | De → para | Efeito |
|---|---|---|
| `relaciona` | nó → nó | informativa |
| `substitui` | nó → nó | o alvo deve estar `cancelado` ou `fechado` |
| `aplica` | nó → `conhecimento:<caminho>` | informativa; liga ao hub (só leitura, D3). Usada por módulo e decisão |

Inversas são derivadas. Ciclos em `pai` e em `depende_de` são erro.

## Tipos de nó

| Tipo | Para quê | Regra própria |
|---|---|---|
| `iniciativa` | trabalho que se abre em filhos (upstream relativo) | não sai de `verificacao` com filho que ainda não passou da Entrega (vale para qualquer tipo) |
| `tarefa` | trabalho direto | — |
| `licao` | um aprendizado (D18) | só nasce de **atrito observado**: `origem` tem de citar um evento do ledger (`ledger:<id-do-evento>`) de tipo `gate.decidido` reprovado, `recusa`, `disjuntor.disparou` ou `msg.recusada`, ou uma mensagem `escalada` (`msg:<id>`). Pode correr pela via expressa. |
| `proposta` | mudança proposta ao próprio Zeno ou a um módulo, saída de uma lição | faixa mínima `aprovacao` (separação de poderes, D17/D18) |

## Validação (`zeno validar`)

Erros (saída 1). Cada erro sai como `arquivo:linha regra mensagem`.

| Regra | O que checa |
|---|---|
| `yaml` | frontmatter dentro do subconjunto; fechado com `---` |
| `schema` | campos obrigatórios (`zeno id tipo titulo criado fase estado dono executor tamanho faixa procedencia janela`), enums, formatos de data e id |
| `id` | id = nome do arquivo; único; formato |
| `ref` | `pai`, arestas, `responde-a`, `[[id]]` no corpo apontam para nó ou mensagem existente (referência local); `<alvo>:<id>` só sintaxe |
| `ciclo` | sem ciclo em `pai` nem em `depende_de` |
| `secoes` | as 7 seções existem, na ordem |
| `projecao` | frontmatter de controle = projeção do ledger |
| `conflito` | todo evento do nó encaixa no replay ([ledger](ledger.md#replay-a-projeção)) |
| `assinatura` | todo evento de decisão humana tem assinatura válida de uma pessoa com o papel |
| `aprovado-mudou` | as seções aprovadas num gate humano têm o mesmo `artefato_sha256` |
| `faixas-piso` | nenhuma linha local do `faixas.yaml` é mais frouxa que a do módulo |
| `ledger` | cada linha é JSON válido do contrato ([ledger.md](ledger.md)); ids únicos; `v` conhecido |
| `append-only` | com `--staged`: ledger e fios só cresceram (ver [ledger.md](ledger.md#append-only)) |
| `fio` | cada mensagem passa no lint ([mensagens.md](mensagens.md)) |
| `orcamento` | soma dos orçamentos declarados dos filhos ≤ o do pai, por dimensão |
| `faixa-nunca` | faixa efetiva `nunca` ⇒ `executor` é pessoa |
| `licao-atrito` | regra do tipo `licao` acima |
| `papel` | `dono`, `executor`, `revisor` existem em `sistema.yaml` (pessoas ou agentes), ou são um agente `ia:<nome>` |

Avisos (não falham): `prazo` vencido, Observação com janela vencida, `<alvo>:<id>` não verificado, nó parado há mais de 14 dias.
