# CLI `zeno` — contrato

`zeno <verbo> [args] [--json]`. Node ESM sem dependências (D28). Entrada `zeno/cli.mjs`; shim `bin/zeno`
(`exec node "<zeno>/cli.mjs" "$@"`), que o Filipe liga no PATH (`ln -s …/zeno/bin/zeno ~/.local/bin/zeno`) **só até o 1º
`zeno promover`**. O promover troca esse shim por um que roda a cópia fixada (T68), ou o move para o `_lixo/` no modo
root (T95). Refazer o `ln -s` depois disso desliga a cópia fixada: o PATH volta a rodar o clone que o agente edita.
Os hooks de git do próprio `zeno/` chamam `node ./cli.mjs` e não dependem do shim.

## Convenções comuns

**Alvo.** `--alvo <dir>`; sem ele, a CLI sobe do cwd até achar `.agents/sistema.yaml`. Sem alvo ⇒ saída 2 (exceto `install`).

**Ator.** Quem chama (filtro, não prova — a prova de pessoa é a assinatura, [controle](controle.md#decisão-humana-assinada)):
1. `ZENO_ATOR` no ambiente, se existir;
2. senão, se `CLAUDECODE` está no ambiente ⇒ `ia:claude`;
3. senão, **com TTY**, a pessoa de `sistema.yaml → pessoas` cujo `git` casa com `git config user.email`;
4. senão ⇒ `ia:desconhecido` (um processo sem terminal não vira pessoa por padrão).

Recusa (saída 1, regra `ator`): `CLAUDECODE` presente com `ZENO_ATOR` de pessoa.

**Saída humana.** Texto curto no stdout; erros no stderr como `arquivo:linha regra mensagem`. A mensagem de recusa diz
**o que** foi recusado e **qual regra**; não ensina como contornar (D15).

**Saída `--json`.** Um único objeto no stdout, sempre com o mesmo envelope:
```json
{"v":1,"verbo":"avancar","ok":false,"codigo":3,"dados":{...},"erros":[{"regra":"gate-humano","arquivo":".agents/trabalho/x.md","linha":0,"msg":"…"}],"eventos":["mhgk2x1a-3f0c9a12"]}
```
`eventos` = ids das linhas que a chamada escreveu no ledger.

**Códigos de saída.**

| Código | Sentido |
|---|---|
| 0 | ok |
| 1 | recusa por regra (validação, lint, artefato incompleto, gate check reprovado, faixa, ator, papel, assinatura inválida) |
| 2 | uso errado (verbo, argumento, alvo não achado) |
| 3 | precisa de pessoa: gate humano aberto, ou o verbo é de pessoa e quem chamou não é (agente, sem TTY, com `CLAUDECODE`) |
| 4 | orçamento: disjuntor do nó, nó pausado, ou teto diário do alvo |
| 5 | trava ocupada por outro processo vivo |
| 6 | não implementado no Inc. 1 (ex.: gate `juiz` sozinho) |
| 9 | erro interno (bug) |

**Escrita e trava.** Todo verbo que escreve: pega `.agents/.zeno.lock` (`O_EXCL`, com `{pid, ts}` dentro), lê o estado do
ledger, valida o resultado **antes** de gravar, grava ledger → fio → vista do nó, solta a trava. Espera até 5 s; trava cujo
pid morreu ou com mais de 60 s é assumida (evento `trava.assumida`). Os `checks` rodam **fora** da trava; o resultado é
revalidado com ela. Uma recusa de verbo que muda estado escreve um evento `recusa` (atrito medido).

## Verbos

### `zeno novo "<título>" --tamanho P|M|G`
`--tamanho` é **obrigatório** (sem padrão: o padrão caro ou o barato seriam escolhas escondidas).
Opções: `--tipo iniciativa|tarefa|licao|proposta` (padrão `tarefa`) · `--pai <id>` · `--faixa …` (agente: ≥ piso do
tamanho) · `--acao <ação>` · `--depende <id>` · `--dono` `--executor` `--revisor` (padrões de `sistema.yaml`; `executor`
padrão = o ator) · `--origem <classe:valor>` (repetível; o ator entra sempre) · `--orcamento tokens=N,usd=X,tentativas=K,prazo=AAAA-MM-DD`
· `--janela 7d` (padrão pelo tamanho: P `3d`, M e G `7d`; a via expressa `0d`; T102) · `--check <nome>` · `--porque "<texto>"` · `--expressa` (= `--tamanho P`, faixa `autonoma`; exige `--porque`) · `--codigo` (com `--expressa`, só no alvo que é o
código do zeno: a procedência não sobe a faixa, e a Entrega reprova commit fora de `cli.mjs core/ bin/ modulos/
test/*.test.mjs`; T76).
Escreve: `trabalho/<id>.md` (frontmatter + 7 seções; `- porque:` se dado), `trabalho/<id>.fio.md` vazio, ledger `no.criado`
(+ `faixa.alterada` se a efetiva difere da declarada). Saída: o id.
Recusa: pai inexistente ou fechado; orçamento acima do saldo do pai; papel de gate humano sem pessoa; agente com faixa
abaixo do piso; `--expressa` com faixa efetiva ≠ `autonoma` (ex.: sessão contaminada).

### `zeno avancar <id>`
Opções: `--ate <fase|fim>` · chaves de artefato `--porque --para --fora --pronto --restricoes --riscos --feito --evidencia --pronto-confere --sessao --ref --desfazer --observado --atrito`
(escrevem `- <chave>: <valor>` na seção da fase certa antes do gate) · cartão de decisão `--cartao-muda --cartao-porque
--cartao-risco --cartao-desfazer --cartao-reprovar --cartao-conferir` (T75: vão para a fase do próximo gate humano; campo de
cartão desconhecido sai com 2). Gate humano sem o cartão completo não abre (saída 1, [fases](fases.md)).
Faz: fase a fase até o alvo, roda o gate de saída ([controle](controle.md#gates-d13)). Para na chave que falta (saída 1),
no check reprovado (1), no primeiro gate humano (3) ou no orçamento (4). Reabre o gate de uma fase cujo artefato aprovado mudou.
Escreve: corpo (chaves passadas), vista do nó, ledger (`artefato.escrito`, `artefato.incompleto`, `gate.decidido`,
`fase.avancou`, `gate.aberto`, `disjuntor.disparou`).

### `zeno gate [<id>]` (de pessoa)
Exige TTY, sem `CLAUDECODE`, ator pessoa com o papel, e a **passphrase** da chave da pessoa. Senão, saída 3.
A passphrase errada pede de novo, até 3 vezes, em todo verbo que a pede (T100), e só então sai com 1, sem evento. A
chave que não confere com a `chave_pub` sai com 1 na hora.
- `--aprovar [--motivo "<texto>"] [--completo]` / `--reprovar --motivo "<texto>"`: mostra o cartão do gate no formato da caixa (D40) e uma linha com onde está o texto inteiro; `--completo` mostra também as seções até a fase. Decide o gate humano aberto.
- `--orcamento <dim>=+N[,…]`: aumenta o orçamento / rearma o disjuntor.
- `--despausar --motivo "<texto>"` (T98): solta do disjuntor um nó pausado sem subir o teto (`disjuntor.liberado`,
  assinado). Saída 1 se o nó não está pausado, 2 sem `--motivo`. Só pessoa tira um nó da pausa: o `ajustar` que baixa o
  orçamento não despausa.
- `--descontaminar`: limpa a marca de contaminação do alvo. Não leva id.
- `--teto <dim>=+N[,…]` (T93): libera o teto diário do alvo só no dia UTC de hoje (`usd` ou `tokens`, a dimensão que tem
  teto). Não leva id e não muda o `sistema.yaml`. Saída 2 sem o `+` ou numa dimensão sem teto.
Escreve: ledger (`gate.decidido` com `espera_ms` e `artefato_sha256`, `fase.avancou`, `orcamento.alterado` ou
`contaminacao.limpa`, todos **assinados**), vista do nó, e no fio uma `decisao` no molde fixo do gate
(`o-que: gate <fase> <aprovado|reprovado>`, `porque: <motivo ou "sem motivo">`, `alternativas: aprovar, reprovar`,
`quem-decidiu: <pessoa>`); o ledger guarda só o `motivo_sha256`.

### `zeno ajustar <id> <campo><op><valor> [<campo><op><valor> …] [--motivo "<texto>"]`
Muda campos de controle (`op`: `=`, `+=`, `-=`), todos juntos. Apertar é livre; **afrouxar** (definido pelo efeito em
[controle](controle.md#apertar--afrouxar)) é de pessoa: TTY, passphrase, `--motivo`, evento assinado (senão saída 3).
Escreve: vista do nó, ledger `ajuste` (+ `faixa.alterada`, `orcamento.alterado` para baixo, `no.cancelado` para
`estado=cancelado`). Orçamento para cima não passa por aqui: é `gate --orcamento`.
**T115:** `tamanho=` que sobe e deixa a faixa declarada abaixo do piso do tamanho novo também grava o `ajuste` de `faixa`
até o piso e o `faixa.alterada`, os dois com `motivo: tamanho` ([controle](controle.md), item 2). Ex.: P autônomo
ajustado para M vai a `aprovacao`, e o próximo gate de Especificação ou Entrega é de pessoa. Nunca baixa a faixa.

### `zeno msg <id> <tipo> --para <dest> --<campo> "<valor>" …`
Ou `--arquivo <f.md>` com as linhas `- **campo:** valor`. Roda o lint ([mensagens](mensagens.md)).
Escreve: fio (append), ledger `msg.enviada` ou `msg.recusada` (saída 1). Saída: o id da mensagem.

### `zeno caixa [--de <dest>]`
Lista as mensagens que esperam pelo destinatário (padrão: o ator), uma por linha cortada na largura do terminal. Só lê.
Os gates abertos, com a vista inteira de cada um, estão no `zeno pendentes --json` (D39/D40): `dados.gates[]` tem `no`,
`fase`, `espera_ms`, `titulo`, `tipo`, `nivel`, `mudou`, `sha`, `ref` e `cartao` (`muda`, `porque`, `risco`, `nivel`,
`desfazer`, `reprovar` e `conferir[]`), para outra porta ou UI renderizar sem raspar texto.

### `zeno revisar <id> --motivo "<texto>"` (agente ou pessoa; T87)
Tira da caixa o gate humano aberto de um nó que volta para revisão. Só adia, nunca aprova (apertar é livre). Escreve:
ledger `gate.retirado` com `fase` e `motivo_sha256`, e o fio do nó ganha um `aviso` ao revisor com o texto do motivo
(T110); o nó volta a `ativo`. O próximo `zeno avancar <id>` abre o gate de novo,
com o texto e o cartão atuais. Saída 1 se o nó não tem gate aberto; 2 sem `--motivo`.

### `zeno caixa --aprovar [--motivo "<texto>"] [--promover] [--de <dir>]` (pessoa; T53, T78)
T87: o gate cujo texto mudou depois de aberto aparece marcado **MUDOU** e fica fora do "todos" (só por número).
T101: depois de um "todos" com MUDOU, a caixa pergunta por ele antes da passphrase ("E o MUDOU (N id)? número para
aprovar · v N para ver · enter pula"). O número escolhido entra no mesmo lote e na mesma passphrase.
**D40, resumo antes do detalhe** ([tela](tela.md)): a caixa abre com uma linha por gate (número, fase, tipo, risco,
título).
- **Tipo:** sai do diff do `ref` (código, docs, segurança ou registro).
- **Risco:** é o nível do cartão.
- **Detalhe aberto sozinho:** o cartão de quem pede olho, isto é, risco alto, tipo segurança, MUDOU ou cartão sem
  nível. Os outros ficam fechados: `v N` abre um, e `--detalhe` abre todos.
- **Cada detalhe mostra:** o cartão com rótulos alinhados, o conferir numerado, o id, o ref e o `artefato_sha256`. Num
  gate sem cartão, aparece o resumo das chaves da seção.

Pergunta quais aprovar (`todos` ou `1,3`, como antes; `v N` mostra um e pergunta de novo; vazio cancela), pede **uma**
passphrase e grava um `gate.decidido` assinado por
gate (com `espera_ms`), a `decisao` no fio e o `fase.avancou`. Reprovar continua sendo `zeno gate <id> --reprovar`.
Saída: os ids aprovados. Recusa com 3 fora de TTY, dentro do Claude Code ou para quem não é pessoa.
**A rodada deixa rastro (T114):** toda saída depois da tela (vazio, escolha inválida, passphrase recusada, aprovação)
grava um `caixa.mostrada` sem assinatura, só com ids e números ([ledger](ledger.md)); nenhuma rodada conta como ato humano.
**Uma passphrase por rodada (T78):** quando o alvo (ou `--de`) é o código do zeno e há mudança no código desde a cópia
fixada (`git diff <cópia>..HEAD` nos caminhos do código), a caixa, depois da escolha dos gates e **antes** da
passphrase, mostra o que o `promover` mostra (commits e nós da cópia) e pergunta `promover também, com a mesma
passphrase? (s/N)`; `--promover` responde sim sem perguntar (e falha se o promover não puder rodar). Os gates são
gravados antes da prova; o promover segue igual (fora da trava, testes, censo, `zeno.promovido` assinado), com a chave
já destravada na memória **daquele** processo: nada vai para disco nem para outro processo.

### `zeno pendentes [--de <pessoa>]`
Gates humanos que a pessoa decide, nós pausados de que é dona, Observações vencidas, teto diário estourado, total da caixa. Só lê.

### `zeno status [<id>]`
Sem id: a árvore do grafo por `pai`, uma linha por nó: `id fase estado faixa-efetiva tamanho título`, e no topo o que
falta neste alvo (camadas 1–2 ausentes em adoção, chave pública ausente, marca de contaminação ativa). Com id: o nó, os
filhos, as arestas, o consumo × teto de cada dimensão, o histórico de gates e as mensagens abertas. Só lê.

### `zeno vista --obsidian [--check] [--saida <dir>]`
O grafo de trabalho do alvo como notas do Obsidian (D10, degrau 1 da escada das telas), em `<alvo>/zeno-grafo/`: o
`.agents/` é oculto e o Obsidian o ignora. Um `<id>.md` por nó, com frontmatter `tags: [zeno/fase/<fase>,
zeno/tamanho/<T>, zeno/faixa/<efetiva>, zeno/estado/<estado>]`, `aliases: [<título>]` e o cabeçalho de gerado
(`gerado_por: zeno vista --obsidian`, `fonte: .agents/ledger.jsonl`, `ledger_ultimo: <id do último evento>`, e a linha
"GERADO pelo zeno vista --obsidian; não edite"). O corpo tem `pai`, `filhos`, `depende de` e `cita` (os ids de nós do
alvo que aparecem no corpo) como links de wiki, e depois o corpo do nó como está. Um pai ou dependência `<alvo>:<id>`
sai como texto. Há também um `_indice.md`, com as raízes e a contagem por fase. A pasta leva um `.gitignore` próprio
com `*`, então fica fora do git sem mexer no `.gitignore` do alvo. Um `.gitignore` que já estava lá e não é do Zeno
não é mexido, e a vista avisa. Uma nota sem o cabeçalho de gerado é de pessoa: nunca é sobrescrita, a vista a pula e
avisa. A nota de um id que deixou de existir vai para `zeno-grafo/_lixo/`, nunca é apagada. `--check` regera em
memória e compara: sai 0 se está igual, e sai 1 com os arquivos nomeados se o ledger andou ou se uma nota foi editada.
`--saida <dir>` troca a pasta, mas só dentro da raiz do alvo e fora do `.agents/` e do `.git/`; fora disso sai 1.
Assim, o grafo de um alvo de empresa ou cliente nunca cai no monorepo nem no vault. Só lê o ledger: sem trava e sem
evento. O modelo (nós, arestas, tags) é a função pura `modeloGrafo` de `core/grafo.mjs`. As cores por tag ficam com a
pessoa, no grafo do Obsidian, e o Zeno não escreve `.obsidian/`. Resíduo: num cofre com vários alvos, dois nós com o
mesmo id em alvos diferentes deixam o link de wiki ambíguo.

### `zeno validar [--staged] [--reparar] [--codigo [<dir>]]`
Roda as regras de [no.md](no.md#validação-zeno-validar). `--staged` lê o índice do git (pre-commit/pre-merge-commit) e
liga `append-only`. `--reparar` regrava as vistas dos nós a partir da projeção (escreve só frontmatter; nunca o ledger).
`--codigo [<dir>]` (padrão: o código do zeno) confere o código, não o alvo: `isolamento` (D3, nada de `../conhecimento`
nem `../avaliacao`), `sem-dependencia` (D28) e `sem-flag-de-teste` (T16); é o "código ok" do pre-commit.
Saída 0 ou 1.

### `zeno contexto <id> [--fase <fase>] [--sem-agents]`
Monta o pacote de contexto (D21), em Markdown (ou `--json` com uma chave por camada):
1. `AGENTS.md` do alvo (`--sem-agents` troca por uma linha "já carregado");
2. o nó (frontmatter + seções preenchidas), a Especificação do pai e o `pedido` do fio;
3. o cartão da fase (padrão: a fase atual);
4. as skills que o módulo do nó liga àquela fase (o texto do SKILL.md); na Execução, na Verificação e na Entrega, mais
   um bloco só, "Ferramentas deste alvo", com o cartão de cada ferramenta do alvo (as do `zeno ferramentas`) e o
   caminho da skill inteira, lida sob demanda (T107). O bloco ocupa uma das até 3 vagas de skill da fase;
5. as `refs` do nó, recortadas pelo intervalo `#Lx-Ly` quando houver;
6. até 3 nós `licao` do alvo, por busca textual das palavras do título (sem vetor).
Escreve: ledger `contexto.montado` (bytes por camada): o contexto é custo do Sistema.

`zeno contexto --bloco` (sem id, T83): imprime só o fragmento do `AGENTS.md` do módulo `nucleo` e uma linha dizendo que
ele chega pela porta do Claude Code. É o comando do `SessionStart` que o `sync` gera no `settings.local.json` de uma
adoção ([instalacao](instalacao.md#modo-adoção-zeno-install---adocao), item 2). Só lê, não grava evento, saída 0.

### `zeno install <dir> [--adocao] [--sem-sync] [--fronteira pessoal|empresa|cliente] [--alvo-nome <nome>]`
Cria `.agents/` (sistema.yaml, faixas.yaml, trabalho/, ledger.jsonl, .gitattributes, .gitignore) e os blocos do
`AGENTS.md`; depois roda `sync`, salvo `--sem-sync` (escreve só `.agents/` e o bloco do `AGENTS.md`). Recusa se já
instalado (saída 1). `--adocao`: [instalacao](instalacao.md#modo-adoção-zeno-install---adocao).
Escreve: os arquivos acima, ledger `install.executado`, e o alvo na lista da máquina
([registro de alvos](instalacao.md#registro-de-alvos-da-máquina-t104)). Se o registro falhar, o install segue e avisa.
Também avisa (`fronteira`) quando a regra por pasta é mais restrita que a fronteira gravada, ou quando não houve
`--fronteira` nem regra (o install grava `pessoal`; a H21 diz `cliente` para o que não é declarado).

### `zeno alvos [--json] | --descobrir <pasta>… | --esquecer <caminho>…` (T104)
Lê e mantém o [registro de alvos da máquina](instalacao.md#registro-de-alvos-da-máquina-t104). Funciona fora de um alvo.
- **Sem opção:** lista cada alvo com a fronteira efetiva, e `opera` quando a frota pode agir nele sem pedir. Avisa a
  divergência entre a fronteira declarada e a efetiva, e a lista ou as regras ilegíveis.
- **`--descobrir <pasta>…`:** acha os alvos já instalados sob as pastas dadas e os põe na lista. Não sobe acima delas,
  não segue link, pula pasta oculta, `node_modules` e `_lixo`, para em 6 níveis e pula worktree ligado. Recusa (1) se a
  lista estiver ilegível.
- **`--esquecer <caminho>…`:** tira da lista. Um caminho que não estava vira aviso, com saída 0.
- **`--json`, o contrato** que a frota, as telas e os sensores leem: `dados.registro` (o caminho da lista),
  `dados.regras` (os arquivos de regra lidos), `dados.erro` (lista ou regras ilegíveis, ou `null`) e `dados.alvos[]`, com
  `caminho`, `nome`, `registrado`, `declarada` (a do `sistema.yaml`, crua, ou `null`), `regra` (a mais restrita das
  regras que casam, ou `null`), `regras` (os globs que casaram), `efetiva`, `divergencia`, `sumiu`, `worktree` e `opera`.
  `opera` é `true` só com efetiva `pessoal`, `sistema.yaml` presente, checkout principal e lista e regras legíveis.
- Saídas: 0; 1 (lista ilegível no `--descobrir`, sem home); 2 (uso).

### `zeno ferramentas [--json]` (T107)
As ferramentas de terminal do SDLC do alvo e o estado de cada uma. Só lê: não pega a trava, não grava evento.
- **Quais:** a chave `ferramentas:` do `sistema.yaml` (editada pela pessoa; nome desconhecido sai). Sem ela, detecção
  sem LLM e sem segredo: `git` (o alvo está num repo git), `gh` (remoto no github.com), `glab` (remoto num host com
  "gitlab"), `docker` e/ou `podman` (há `Dockerfile`, `Containerfile` ou `compose*.yml`; o que estiver no PATH, ou
  `docker` se nenhum), `testes` (há `checks:`).
- **Para cada uma:** `presente` (no PATH, procurado sem shell); `login`: `sim (<host>)`, `não (<host>)`, "não dá para
  saber sem ler segredo" (docker, podman), "não se aplica" (git, testes), ou "não conferido (…)" (ausente, sem host,
  dentro do sandbox); `servico` (docker, podman): `de pé`, `parado`; `avisos`. Dentro do `zeno sessao` o login de fora
  não aparece: não confere e avisa. Nenhum aviso de licença.
- **Como confere:** só a tabela fixa de `core/ferramentas.mjs` (`gh auth status --hostname <h>`, `glab auth status
  --hostname <h>`, `docker info`, `podman info`), pelo `ctx.sondar` do `cli.mjs`: sem shell, com tempo-limite de 5 s,
  saída do filho descartada. Só o código de saída volta (guarda `ferramentas-sem-segredo`).
- `--json`: `dados.fonte` (`sistema.yaml`/`deteccao`) e `dados.ferramentas[]` (`nome`, `presente`, `login`, `servico`
  quando há, `avisos`, `checks` nos testes). Saída 0 sempre: o que falta é dado.

### `zeno sync [--check]`
Gera os adaptadores a partir do canônico ([instalacao](instalacao.md)). `--check`: não escreve; compara e sai 1 se houver
deriva, listando os arquivos com o tipo de cada um (T106), a de segurança primeiro: **segurança** (`.claude/settings*.json`,
`.mcp.json`, `.agents/githooks/`, `.git/`) e **forma** (o resto). `--json`: `dados.deriva` (na mesma ordem),
`dados.tipos` e um erro `{regra: "deriva", arquivo, tipo}` por arquivo. Sem `--check`: escreve os gerados, `gerados.lock`, blocos gerados do `AGENTS.md`, ledger
`sync.executado`. Recusa (1): versão do módulo em `zeno/modulos/` ≠ a fixada; `zeno` fora do PATH (os hooks gerados negariam tudo).

### `zeno sessao <agente> [--plano] [-- <comando> …]` (T82, camada A da D39)
Abre a CLI do agente (o `comando` do perfil, ou o que vem depois de `--`) num bwrap, com o perfil do registro `agentes:`
do `sistema.yaml`. A fronteira inteira está em [T82](decisoes-tecnicas.md), e os passos com root no
[roteiro](roteiro-t82.md).
- **O que faz:** sobe o proxy da allowlist num socket Unix e grava `sessao.aberta`. Roda o bwrap com o filtro seccomp
  no fd 3, o marcador em `/run/zeno-agente` e o shim do zeno em `/run/zeno-bin`. No fim, grava `sessao.fechada`, com as
  contagens de rede, e apaga a pasta temporária da sessão.
- **`--plano`:** só imprime o argv do bwrap (`--json`: `dados.args`, `binds` e `hosts`) e não grava nada.
- **Saídas:**
  - 0, se o agente saiu com 0; 1 nos outros casos;
  - 1 se o agente não tem perfil, se o perfil pede caminho proibido ou se a CLI não está no PATH;
  - 1 se já está dentro de uma sessão (a sessão não se aninha).
- **`zeno relay <porta> <socket> -- <comando> …`** é interno: roda dentro do sandbox, liga o `HTTPS_PROXY` ao socket do
  proxy e roda o comando.

### `zeno registrar`
- `zeno registrar "<título>" --retro --tamanho P|M|G --inicio <ISO> --fim <ISO> --porque … --pronto … --feito … --evidencia … --ref … --desfazer … [--pai …] [--atrito …]`:
  cria o nó e passa as 7 fases com `retro: true` e `ts_fato`. Agente, fora da faixa `autonoma`: para no gate humano da
  Entrega (saída 3). Faixa `nunca`: só pessoa.
- `zeno registrar gasto <id> --tokens N [--usd X]`: ledger `gasto.registrado` com `fonte: declarado`; roda o disjuntor.
  (O gasto medido vem do hook `SessionEnd`, [seguranca](seguranca.md#medição-mecânica).)

### Verbos de apoio
- `zeno chave nova` (de pessoa): gera o par Ed25519; a privada cifrada por passphrase em `~/.config/zeno/<pessoa>.key`;
  imprime a linha `chave_pub:` para a pessoa pôr no `sistema.yaml`.
- `zeno chave pub [--pem | --em <arquivo>]` (de pessoa; T96): pede a passphrase e tira a pública da chave privada. Sem
  opção, imprime a linha `chave_pub:`. `--pem` imprime o PEM. `--em` grava o PEM num arquivo novo (modo 644; recusa com 1
  se ele existe) e imprime a linha. Avisa no stderr se a pública não bate com a `chave_pub` do `sistema.yaml`, ou se ela
  falta. Não grava ledger. Como todo verbo de pessoa, exige TTY no stdin e no stdout, por isso não há pipe: use `--em`.
- `zeno promover [--de <dir>]` (de pessoa; T68): exige árvore commitada (git status limpo em `cli.mjs core bin modulos
  test guardas.json`), mostra os commits desde a cópia anterior (`%h %s`, T75) e os nós com `ref` nesse intervalo (os de via expressa de
código marcados, T76), pede a passphrase (antes da prova, T72), roda os testes e o censo num bwrap sem rede, com a casa em tmpfs, o
  repositório só leitura e o seccomp do `zeno sessao` (T90; nada roda fora: a sonda que cria um bwrap aninha), copia o código para `~/.local/share/zeno/<commit>`, troca o `atual` de
  forma atômica, troca o shim `~/.local/bin/zeno` por um que roda a cópia fixada (o antigo vai para `_lixo/`) e grava
  `zeno.promovido` assinado. Recusa com 3 para agente; com 1 se a árvore está suja, os testes ou o censo falham, ou falta a chave.
  T79: recusa com 1, **antes da passphrase** e de novo antes da prova, se a cópia traria o commit da `ref` de um nó que
  toca o código e não passou da Entrega (exceto a via expressa de código); a mensagem nomeia os nós. Na `caixa --aprovar`,
  os gates de Entrega aprovados na mesma rodada contam.
  T95, o modo root: quando `/opt/zeno` existe, é do root e não é gravável por outros, o `promover` não troca a cópia da
  casa nem grava o shim. Depois da prova, ele empacota a cópia num tar e assina (commit, sha256) com a chave já aberta.
  Então chama por `sudo` o `/opt/zeno/atual/bin/zeno-instalar-root`, que confere a `pessoa.pub`, a assinatura e o sha256,
  instala em `/opt/zeno/<commit>` e troca o `atual`. Grava `zeno.promovido` com `root: true` e `sha256`; se a gravação
  cair, chama o mesmo instalador com `--voltar <anterior>`. O shim `~/.local/bin/zeno` vai para o `_lixo/`, porque vem
  antes do `/usr/local/bin/zeno` no PATH. Recusa com 1 se o instalador recusa. Se `/opt/zeno` existe mas não é do root,
  avisa e segue no modo da casa. Sem `/opt/zeno`, nada muda.
  T106, a frota: depois de trocar a cópia e soltar a trava, o `promover` confere cada alvo do registro (`zeno alvos`)
  com o `sync --check` da cópia nova. Imprime `frota: N alvo(s) no registro; M com deriva`, os alvos com deriva (a de
  segurança primeiro) em dois blocos (os pessoais, que a frota opera, e os de empresa, cliente ou fora da frota, cada um
  com `cd '<alvo>' && zeno sync`), e os alvos pulados (sumidos, worktree ligado) ou não conferidos. Se há pessoal com
  deriva, pergunta uma vez `rodar o zeno sync nos N alvo(s) pessoal(is) acima? (s/N)`; com `s`, roda o sync em cada um,
  confere de novo e imprime o `git add`/`commit` por pathspec dos gerados (o sync não faz commit). Empresa e cliente
  nunca são sincronizados. A mensagem final é o resumo (`frota: X alvo(s) com deriva; sync feito em K; Y só à mão`);
  `--json`: `dados.frota.alvos[]` (`caminho`, `nome`, `fronteira`, `opera`, `deriva[{arquivo,tipo}]`, `erro`, `pulado`,
  `sync`: `null`, `"ok"` ou `"falhou (…)"`), ou `dados.frota.erro` com o registro ilegível. Nada da frota muda a saída: a
  promoção já foi feita.
  T118, o portão de publicação: `zeno promover --publicar <clone público> [--de <dir>]` (de pessoa) exige também o
  `zeno/` inteiro commitado, pede a passphrase e roda a mesma prova isolada, mas não troca a cópia que guarda nem roda a
  frota. Monta um snapshot num diretório temporário (o `zeno/` sem `.agents/`, `.claude/`, `CLAUDE.md`, `_lixo/` e
  `.githooks/`; as páginas de `docs/` da lista fixa em `core/portao.mjs`; links reescritos, e o de fora do que entra vira
  texto; os caminhos do monorepo trocados pelos do repo público, T119; o `CHANGELOG.md` gerado dos commits desde a
  origem da publicação anterior) e roda os 7 checks, todos falhando
  fechado: (1) `nomes`, a lista da máquina `~/.config/zeno/portao-nomes.txt`, sem acento e sem caixa, sendo que a lista
  ausente ou vazia reprova; (2) `casa`, a casa da máquina e qualquer `/home/<nome>` fora dos de exemplo; (3) `gitleaks`,
  com `detect --no-git` limpo, e sem ele reprova; (4) `lista`, nada fora da lista do que entra e nada faltando; (5)
  `historico`, o clone limpo, todo commit dele com um `publicacao.preparada` no ledger e a tag ainda livre; (6) `root`,
  a cópia do root ativa; (7) `layout`, nenhum `$CE/`, `$CE/avaliacao/` ou `<clone>/zeno` sobrando na doc, no
  README, no AGENTS.md e no `bin/`. Recusa com 1 (`portao`) se algum reprova, e então nada é escrito no clone. Com os 7 verdes, o
  que estava no clone vai para o `_lixo/` da casa, o snapshot entra, e o portão faz o commit e a tag `v<versão>`
  e grava `publicacao.preparada` assinado. O push é da pessoa, no terminal dela.
  Na 1ª publicação (sem `publicacao.preparada` no ledger), o `CHANGELOG.md` sai só com o resumo fixo da versão, sem assunto de commit.
- `zeno ajuda [verbo]`, `zeno versao`. Só leem. `zeno ajuda --json` dá o mesmo como dado (T91): `versao`, `verbos[]`
  (`verbo`, `uso`, `faz`, `pessoa`, `pessoa_se`, `quem`, `muda`) e `codigos[]`. `quem: "hook"` (T92) marca o verbo que só o
  hook chama: ele não é de pessoa, mas a camada 2 o nega ao agente no shell.
- `zeno guarda pre-tool | contaminou | fim-sessao | parar`: os hooks da camada 2 ([seguranca](seguranca.md)); `parar` é o
  `Stop`, a deixa do hábito (T113), e sai sempre 0. Leem o JSON do hook
  no stdin; respondem no formato de decisão do Claude Code. Não são para uso humano, e o agente não os chama pelo shell
  (a camada 2 nega; no `ajuda --json`, `quem: "hook"`).
