# Ledger — contrato v1

O ledger é **o contrato entre o `zeno/` e a `avaliacao/`** (D3: só leitura, por formato). O Zeno registra fatos brutos;
a `avaliacao/` define as métricas e interpreta (D17/D20). Quem é medido não edita o registro.

## Arquivo
- `<alvo>/.agents/ledger.jsonl`: UTF-8, uma linha = um objeto JSON = um evento, `\n` no fim de cada linha.
- Só a CLI escreve, sempre no fim, sob a trava `.agents/.zeno.lock`.
- `.agents/.gitattributes` declara `ledger.jsonl merge=union`: dois branches que acrescentaram linhas se fundem sem conflito.
- A ordem do arquivo **não** é a ordem do tempo depois de um merge: o leitor ordena por `ts` e, no empate, por `id`.

## Campos comuns (todo evento)

| Campo | Tipo | Obrigatório | Sentido |
|---|---|---|---|
| `v` | int | sim | versão do contrato. Este documento é `1`. |
| `id` | string | sim | único no arquivo: `<ms desde 1970 em base36>-<8 hex aleatórios>` |
| `ts` | string | sim | ISO 8601 UTC com ms, momento da escrita |
| `ev` | string | sim | tipo do evento (tabela abaixo) |
| `alvo` | string | sim | nome do alvo (`sistema.yaml` → `alvo`) |
| `no` | string \| null | sim | id do nó, ou `null` em evento de alvo |
| `ator` | string | sim | `<pessoa>` ou `ia:<agente>` (em alvo `empresa`/`cliente`: `h:<8 hex>` do sha256 de `sal:id`, com o sal do alvo fora do git; T73) |
| `estrato` | objeto \| null | sim | o nó **naquele momento**: `{tipo, tamanho, faixa, modulo, expressa}` (`faixa` = efetiva). `null` sem nó. |
| `dur_ms` | int | sim | tempo de parede da chamada da CLI (o mesmo em todos os eventos da chamada) |
| `cmd` | string | sim | id da chamada da CLI (formato de `id`); agrupa os eventos de uma chamada |
| `config_sha256` | string | sim | sha256 de `sistema.yaml` + `faixas.yaml` concatenados, na hora do evento |
| `retro` | bool | não | `true` = registro retroativo |
| `ts_fato` | string | não | quando o fato aconteceu, se ≠ `ts` (só com `retro`) |
| `sandbox` | string | não | `fora` (a CLI não achou o marcador `/run/zeno-agente`: o ato foi de fora do `zeno sessao`, com certeza) ou `sessao` (achou: **declaração** do marcador, não prova contra o mesmo uid; [seguranca](seguranca.md#resíduos-declarados)). Entra na assinatura. Ausente = evento de antes da marca (T105) |
| `sessao` | string | não | com `sandbox: sessao`: o id do `sessao.aberta` que o lançador gravou no marcador. Ausente com `sessao` = marcador sem id (lançador anterior à T105) |
| `assinatura` | objeto | não | `{pessoa, sig}`: Ed25519 (base64) sobre o JSON canônico do evento sem este campo. Obrigatório nos eventos de decisão humana ([controle](controle.md#decisão-humana-assinada)) |
| `dados` | objeto | sim | campos do tipo (abaixo); `{}` se nenhum |

Nada de texto livre de conteúdo no ledger (sem título, sem motivo, sem URL): só ids, enums, números, hashes e tamanhos.
O texto mora no nó e no fio. Em alvo `empresa`/`cliente`, todo identificador de pessoa vira `h:<8 hex>` (T73): `ator`, `assinatura.pessoa`,
`dados.dono`/`revisor`/`executor`, `dados.pessoas`, `dados.para`, `dados.decisor.id` (humano) e `antes`/`depois` de `ajuste`
de papel. A assinatura é sobre a linha como está no disco (com o hash).

## Tipos de evento v1 (`ev` → `dados`)

| `ev` | `dados` |
|---|---|
| `no.criado` | `pai`, `tipo`, `tamanho`, `faixa` (declarada), `acoes`, `procedencia`, `origem_classes` (só o prefixo: `web`, `pessoa`…), `depende_de`, `dono`, `executor`, `revisor`, `orcamento`, `janela`, `checks`, `expressa`, e `codigo: true` só no nó da via expressa de código (T76); `sensor: <nome>` só no nó com origem `sensor:<nome>` (T117, vocabulário fechado `a-z0-9-`; é dele que a trava de 1 por sensor e 5 por semana ISO conta) |
| `fase.avancou` | `de`, `para` (`fechado` depois de `aprendizado`), `gate` (id do `gate.decidido`); `atrito_padrao: true` (T70) quando sai do Aprendizado com o `atrito: nenhum` que a própria CLI preencheu |
| `artefato.incompleto` | `fase`, `faltando` (chaves) |
| `artefato.escrito` | `fase`, `chaves`, `bytes` (o que a CLI escreveu no corpo) |
| `gate.aberto` | `fase`, `tipo` (`humano`), `papeis`, `pessoas`; `reabertura: true` quando a seção aprovada mudou (T15); `artefato_sha256` da seção na abertura (T87) |
| `gate.retirado` | `fase`, `motivo_sha256` — o agente tirou da caixa o gate aberto de um nó em revisão (`zeno revisar`, T87); o nó volta a `ativo`, e o próximo `avancar` abre o gate de novo. O texto do motivo vai para o fio, como `aviso` ao revisor (T110); os 2 eventos de antes da T110 têm o motivo em claro e ficam como estão |
| `gate.decidido` | `fase`, `tipo` (`check`/`humano`/`juiz`), `decisao` (`aprovado`/`reprovado`), `modo` (`real`/`sombra`), `decisor` (`{tipo, id}`), `espera_ms` (humano: desde o `gate.aberto`; check: 0), `artefato_sha256` (humano: das seções até a fase), `evidencia` (`{checks: [{nome, exit, ms}], motivo_sha256}`) |
| `caixa.mostrada` | `listados` (os ids na ordem da tela), `mudou` (os marcados MUDOU), `abertos` (os de detalhe aberto sozinho), `vistos` (os abertos com `v N`), `resposta` (`todos`/`numeros`/`vazio`/`invalida`), `escolhidos`, `mudou_pulado` (o MUDOU que ficou fora depois do "todos"), `leitura_ms` (da tela à última resposta) — evento de alvo, **sem assinatura**, com o ator do processo; não é ato humano (quem prova a aprovação é o `gate.decidido`, no mesmo `cmd`). Uma rodada de `caixa --aprovar` depois da tela: vazio, escolha inválida, passphrase recusada ou aprovação (T114) |
| `msg.enviada` | `msg`, `tipo`, `para` (ids, ou hashes na fronteira), `responde_a`, `bytes` |
| `msg.recusada` | `tipo`, `faltando` (campos), `regras` |
| `gasto.registrado` | `tokens`, `usd`, `fonte` (`medido`/`declarado`/`indisponivel`), `bytes_sistema`, `bytes_total` (medido), `sessao_sha256` (medido). Só no `medido` (T55/T66): `tokens_cache_leitura` (tokens lidos do cache na sessão, fora de `tokens`), `nos_na_sessao` (em quantos nós a sessão foi dividida: há um evento por nó, `tokens` é a parte de cada um, e `bytes_*`/`tokens_cache_leitura` são da sessão inteira repetidos em cada evento — some-os uma vez por `sessao_sha256` e `ts`), `ja_medido_tokens` (o que a mesma sessão já tinha gravado antes desta medição; os `tokens` deste evento são só a diferença). Campos aditivos (T103, opcionais; o leitor antigo os ignora): `origem` (`cli`/`fim-sessao`: quem mediu), `subagentes` (quantos transcripts de subagente entraram), `nos_fora` (nós citados na sessão que são de outro alvo: entram em `nos_na_sessao`, mas a parte deles vai para o ledger deles; com nenhum nó daqui, um evento com `no: null` e `tokens: 0` só avança a base), `sessao_total` (`{tokens, cache, bs, bt}`: o total cumulativo da sessão nesta medição, a base da próxima diferença). No `indisponivel`: `origem` e `motivo` (`sem-transcript`/`formato`). Transcript sem chamada de modelo não grava `indisponivel` (antes gravava). |
| `disjuntor.disparou` | `limite` (`tokens`/`usd`/`tentativas`), `no_limite` (id do nó cujo teto estourou), `consumo`, `teto` |
| `disjuntor.liberado` | `motivo`, `orcamento` (o que segue valendo). Sempre assinado (T98): `gate <id> --despausar`, solta sem subir o teto |
| `teto_diario.estourou` | `dimensao`, `consumo`, `teto` (evento de alvo, `no: null`) |
| `orcamento.alterado` | `antes`, `depois` (para cima: assinado; só o assinado tira o nó da pausa, T98). Com `no: null` (T93): `dia` (UTC) e `acrescimo` (`usd`/`tokens`), a liberação do teto diário do alvo naquele dia, sempre assinada |
| `ajuste` | `campo`, `antes`, `depois`, `afrouxa` (bool; `true` exige assinatura). Para `origem` só as classes. Nunca para `orcamento` nem `estado` (esses têm evento próprio). Opcional (T115): `motivo: tamanho` no ajuste de `faixa` que o verbo grava ao subir o tamanho até o piso. |
| `faixa.alterada` | `de`, `para`, `motivo` (`procedencia`/`acao`/`heranca`/`ajuste`/`piso`/`tamanho`; `tamanho`, T115: o ajuste subiu o tamanho e a faixa subiu ao piso) |
| `no.cancelado` | `motivo_sha256` (fora da `autonoma`: assinado) |
| `contaminacao.marcada` | `sessao_sha256`, `ferramenta` (`WebFetch`/`WebSearch`/`mcp`) — evento de alvo |
| `contaminacao.limpa` | `sessao_sha256`, `como` (`fim-sessao`/`pessoa`; `pessoa` é assinado) |
| `contexto.montado` | `fase`, `bytes`, `camadas` (`{agents, no, cartao, skills, refs, licoes}` em bytes) |
| `recusa` | `verbo`, `regra`, `codigo` (saída 1, 3 ou 4 de um verbo que muda estado; a 5 não é gravada). Da guarda (`verbo: guarda`, T70): `regra` é a do shell ou `arquivo-protegido` (hook de Edit/Write, T69); o `no` do evento é o id de nó citado num `zeno <verbo> <id>` do comando negado (ou o do `.fio.md` tocado), quando há; `dados.sessao_sha256` sempre que o hook traz `session_id`; na `mcp-fora-da-lista` (T99), `dados.servidor` é o servidor MCP negado; na `sem-no` (T113, valor novo e compatível), o hook `Stop` viu trabalho de agente no alvo sem nó tocado e pediu o `registrar --retro`: `codigo: 1`, `dados.porta: "stop"`, `no: null` (o denominador da ficha de "% retro"; o commit sem nó não grava evento) |
| `trava.assumida` | `pid_antigo`, `idade_ms` |
| `install.executado` | `modo` (`novo`/`adocao`), `modulos` (`{nome: versao}`), `locais` (quantos), `sync` (bool), `fronteira` (`pessoal`/`empresa`/`cliente`; T70) |
| `zeno.promovido` | `commit`, `anterior` (a cópia que era a atual, ou `null`), `copia` (caminho), `testes`, `censo`, `nos` (os nós do alvo com `ref` num commit entre a cópia anterior e a nova, T76), `prova` (`"bwrap"` quando a prova rodou isolada, T90), `root` e `sha256` (T95: `true` e o sha256 do tar quando o instalador root instalou em `/opt/zeno`; `copia` é então `/opt/zeno/<commit>`) — evento de alvo, assinado (T68) |
| `publicacao.preparada` | `commit` (o commit criado no clone público), `arvore`, `tag`, `origem` (o commit do monorepo), `clone` (caminho), `arquivos` (quantos), `prova`, `checks` (`{nomes, casa, gitleaks, lista, historico, root}`, todos `"ok"`) — evento de alvo, assinado; o check `historico` do próximo portão lê os `commit` daqui (T118) |
| `sync.executado` | `check` (bool), `deriva` (quantos arquivos), `gerados` (quantos) |
| `sessao.aberta` | `agente`, `comando` (o nome da CLI), `hosts` (a allowlist do perfil), `binds` (quantos): o `zeno sessao` abriu o bwrap (T82); o ator é quem lançou. O `id` deste evento vai no marcador, como 2ª palavra depois do agente, e os atos de dentro o levam em `sessao` (T105) |
| `sessao.fechada` | `agente`, `codigo` (a saída do agente), `dur_ms`, `rede` (`permitidas`, `negadas`, `negados[]`: até 20 `host:porta (motivo)`) (T82) |

O fechamento é o `fase.avancou` com `para: "fechado"`. A **entrega** de um nó é o `fase.avancou` com `de: "entrega"`.

## Replay (a projeção)
O estado de controle de um nó é o resultado de aplicar os eventos dele em ordem (`ts`, `id`). Evento que não encaixa
(ex.: dois `fase.avancou de: execucao` vindos de dois branches; decisão humana sem assinatura válida) **não** é aplicado e
vira erro `conflito` no `validar`. Uma pessoa resolve com um `ajuste` assinado; nada é reescrito.

## O que a `avaliacao/` consegue calcular (insumos, não fórmulas)
As fórmulas e as fichas são da `avaliacao/` (D20). O ledger v1 garante os insumos:

| Métrica (D19/D20) | Insumos no ledger |
|---|---|
| **lead time por nó** | `ts` (ou `ts_fato`) do `no.criado` → do `fase.avancou de: entrega` (entregue) e do `para: fechado` (fechado) |
| **espera em gate humano** | `gate.decidido` `tipo: humano` → `espera_ms`; ou o par `gate.aberto`/`gate.decidido` |
| **imposto do Sistema** | `gasto.registrado fonte: medido` (`bytes_sistema`/`bytes_total`, tokens da sessão), espera em gate humano, `dur_ms` por `cmd` distinto (menos os `checks`, que são trabalho: `evidencia.checks[].ms`), `contexto.montado`, sobre o lead time e os tokens totais do nó |
| **retrabalho** | `gate.decidido` reprovado por nó e fase |
| **atos sem prova de isolamento** (D9) | `sandbox` e `sessao` de cada evento de ator `ia:*`, cruzados com o `sessao.aberta`/`sessao.fechada` do mesmo `id` (agente, janela), inclusive no ledger de outro alvo; `assinatura` em nó com ato de agente `fora`. `sessao` é declarado; sem `sandbox` = antes da marca (T105) |
| **atrito** (D15/D18) | `recusa`, `msg.recusada`, `disjuntor.disparou`, `artefato.incompleto` |
| **n e estrato** | `estrato` em toda linha. Para contar n **por nó**, vale o `estrato` do último evento do nó (o do fechamento, se houver). `retro` separa o registro retroativo. |

**O imposto v1 é um piso**, e a ficha precisa dizer isso: o tempo humano de ler e escrever artefato fora da CLI não é
medido; a parte de tokens depende do probe `transcript-formato`; `fonte: declarado` e `indisponivel` são estratos à parte.

## Regras de versão
- Mudança **compatível** (novo `ev`, novo campo opcional em `dados`, valor de enum aditivo) **não** muda `v`. O leitor
  **ignora** campo desconhecido e conta `ev` desconhecido como "desconhecido", sem falhar.
- Mudança **incompatível** (renomear ou tirar campo, mudar sentido ou unidade) cria `v: 2`, documentado aqui antes de o
  Zeno escrever a primeira linha `v: 2`. O leitor **pula e conta** a linha de `v` que não conhece (não falha o arquivo) e
  mostra a contagem no placar.
- Linhas de versões diferentes podem coexistir no mesmo arquivo; nada é reescrito.

## Append-only
- Camada 1: `Edit`/`Write` no `ledger.jsonl` negados ao agente; camada 2 nega escrita por shell ([seguranca](seguranca.md)).
- Camada 4: `validar --staged` (pre-commit e pre-merge-commit) compara o arquivo do índice com o do `HEAD`: as linhas do
  `HEAD` têm de aparecer **iguais e na mesma ordem** (subsequência) no novo arquivo. Isso aceita o acréscimo no fim e o
  resultado do `merge=union`, e recusa edição, remoção e truncamento. Arquivo removido = truncado.
- Uma linha acrescentada por fora da CLI passa no append-only, mas: se for decisão humana, não tem assinatura e não vale;
  se for outro evento, ela é só um fato a mais, que o replay aplica ou acusa (`conflito`). Resíduo em [seguranca](seguranca.md#resíduos-declarados).
- Correção de um fato errado: um evento novo, nunca edição da linha.

## Exemplo

```json
{"v":1,"id":"mhgk2x1a-3f0c9a12","ts":"2026-11-02T18:04:11.000Z","ev":"no.criado","alvo":"zeno","no":"ledger-formato","ator":"ia:claude","estrato":{"tipo":"tarefa","tamanho":"M","faixa":"aprovacao","modulo":"nucleo","expressa":false},"dur_ms":41,"cmd":"mhgk2x19-a1b2c3d4","config_sha256":"9f2c…","dados":{"pai":"spec-inc1","tipo":"tarefa","tamanho":"M","faixa":"aprovacao","acoes":[],"procedencia":"confiavel","origem_classes":["pessoa"],"depende_de":[],"dono":"filipe","executor":"ia:claude","revisor":"filipe","orcamento":null,"janela":"0d","checks":["testes"],"expressa":false}}
```
