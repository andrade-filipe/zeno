# Segurança (D15) e registro de guardas (D33)

Quatro camadas, da mais forte para a mais fraca. Uma regra que tem de valer sempre fica fora do contexto do agente
(permissão, hook ou assinatura); o texto do `AGENTS.md` é conselho.

**O que só uma pessoa faz é provado por assinatura, não por ambiente** ([controle](controle.md#decisão-humana-assinada)).
TTY, `CLAUDECODE` e e-mail do git são controláveis pelo agente; servem de filtro, não de prova.

## As 4 camadas aplicadas ao próprio `zeno/`

### 1. Negação declarativa (`zeno/.claude/settings.json`, gerado pelo `zeno sync` no alvo `zeno/`)
`permissions.deny` com `Edit(/<rel>)`: `/` é a raiz do alvo (o diretório onde a sessão abre), então o arquivo é o mesmo
em qualquer clone ou worktree (T69). Só `Edit`: regra de caminho em `Write` nunca casa (docs do Claude Code), e `Edit`
cobre Write, MultiEdit e NotebookEdit.
- `.agents/ledger.jsonl`, `.agents/trabalho/*.fio.md`, `.agents/gerados.lock`;
- `.agents/sistema.yaml` e `.agents/faixas.yaml` (configuração é de pessoa);
- os gerados (`CLAUDE.md`, `.claude/**`);
- `Bash(rm:*)` (nunca apagar: vai para `zeno/_lixo/` com `mv`).

`conhecimento/**` e `avaliacao/**` (D3, `negar_escrita`) ficam **fora** do alvo, e `..` em regra não é documentado
(regra que não casa vira no-op em silêncio, a lição do Inc. 0): quem nega é o hook de arquivo da camada 2.

Os guardas globais do Filipe (`~/.claude/hooks`: banco, chaves, hub de fora, CLI do Obsidian) continuam valendo por cima;
o de chaves já nega `~/.config`, onde moram as chaves privadas do Zeno.

### 2. Hooks fail-closed (gerados)
- `PreToolUse` (matcher `Bash`): `zeno guarda pre-tool || exit 2`. Zeno ausente ou quebrado ⇒ nega. A decisão sai de um
  **tokenizador mínimo de shell** (`core/shell.mjs`, T67): aspas, escapes, `;` `&&` `||` `|` `&`, `( )`, `$( )`, crases,
  redirecionamentos e here-docs; o código de `sh -c`/`bash -c`/`eval`/`find -exec`/`$( )` é analisado também. Texto entre
  aspas num argumento é dado, não comando. Nega, sem ensinar o contorno:
  - definir ou apagar `ZENO_ATOR`/`CLAUDECODE`/`CLAUDE_CODE_SESSION_ID` (atribuição, `export`, `env -u`, `unset`; a
    última diz de qual sessão a CLI mede o gasto, T103);
  - **escrita** nos arquivos da camada 1: redirecionamento `>`/`>>`, `tee`, `sed -i`/`perl -i` (só o arquivo operando conta, e o `w <arquivo>` do sed; T71), `cp`/`install`/`ln` com destino
    protegido, `mv`/`rm`/`truncate` com o protegido, `dd of=`, `git checkout|restore -- <protegido>`, `find … -exec rm`; e
    `node -e`/`python -c`/here-doc para intérprete **só** se o código cita o caminho protegido **e** uma API de escrita
    (`writeFile`, `appendFile`, `open(…,'w'|'a')`, `createWriteStream`…). O caminho conta em qualquer lugar do código, e
    isso dá um **falso positivo aceito** (T109): o código que escreve num arquivo comum um texto que cita um protegido é
    negado como `arquivo-protegido`, e o porquê da negação diz isso e manda editar texto pelo Edit ou Write. Fica assim
    porque o caminho chega à API por variável, e separá-lo do texto pediria um parser por linguagem ou afrouxaria a guarda.
    Ler (`cat`, `grep`, `node -e` que só lê) passa;
  - `zeno gate|chave|guarda|promover` e `zeno caixa --aprovar` com `zeno` (ou `node …/cli.mjs`) **em posição de comando**;
  - `git commit|push|merge|rebase|am|cherry-pick … --no-verify`, `git commit -n|--amend`, `git rebase`, `filter-branch`, `filter-repo`, `git reset --soft|--hard|--mixed|HEAD~|HEAD^`;
  - **o que o tokenizador não entende** (aspas, `$( )`, crase ou here-doc sem fechar; aninhamento fundo): nega e diz por quê (`shell-ilegivel`).
- `PreToolUse` (matcher `Edit|Write|MultiEdit|NotebookEdit`): o mesmo `zeno guarda pre-tool || exit 2` (T69). Resolve o
  `file_path` contra a raiz do checkout, segue symlink e nega o rol da camada 1 **e** o `negar_escrita` (o de fora do
  alvo também). Uma lista só (`core/protegidos.mjs`) alimenta as duas camadas.
- `PreToolUse` (matcher `mcp__.*`, T99): o mesmo `zeno guarda pre-tool || exit 2`. Nega todo servidor MCP fora da lista
  `mcp:` do `sistema.yaml` (padrão: nenhum) e do `mcp:` do perfil do ator em `agentes:` (`mcp-fora-da-lista`, com o
  `servidor` na recusa). O servidor novo, que ninguém conhece, cai aqui. Na camada 1, o `permissions.deny` leva
  `mcp__<servidor>` para os que escrevem fora da máquina, conhecidos em 2026-11-03 (`MCP_ESCRITA` em `core/config.mjs`:
  Gmail, Drive, Calendar, Canva, Claude Docs, Vercel, AWS, monday, Cloudflare, Chrome), menos os listados no alvo ou num
  perfil. O que sobra: os conectores seguem na conta (o hook só vale onde o Zeno roda), e um alvo sem o Zeno não tem
  nada disso.
- `PostToolUse` (matcher `WebFetch|WebSearch|mcp__.*`): `zeno guarda contaminou` ([controle](controle.md#procedência-d15)).
- `SessionEnd`: `zeno guarda fim-sessao` (medição mecânica, abaixo; limpa a marca de contaminação da sessão).
- `Stop` (T113): `zeno guarda parar || true`, a deixa do hábito. Lê o transcript (e os dos subagentes) e só age se houve
  Edit/Write/MultiEdit/NotebookEdit em arquivo do alvo fora de `.agents/`, ou `git commit` no Bash, sem nó tocado: sem
  `zeno novo|avancar|registrar|msg|ajustar|revisar|contexto <id>` no transcript e sem nó mudado por agente no ledger
  desde o 1º timestamp. Aí responde `decision: block` com o `zeno registrar "…" --retro` pronto (`--inicio` = 1º
  timestamp do transcript, `--fim` = agora) e grava `recusa` com `regra: sem-no`. Nunca impede a parada: com
  `stop_hook_active` não bloqueia (uma vez por parada; probe `stop-formato`), e entrada ruim, fora de alvo ou sem
  transcript saem 0 calados. Não mede gasto nem limpa a contaminação (é o `fim-sessao`). Nada cria nó: o hook pede, o
  agente registra (guarda `stop-sem-no`).
- O commit (camada 4, T113): o `validar --staged` do githook cobra o nó. Commit com caminho do alvo fora de `.agents/`,
  sem evento novo de nó no ledger do índice e sem nó em Execução: o agente reconhecido (marcador, `CLAUDECODE` ou CLI de
  agente acima) sai 1 com o retro pronto; a pessoa, e o ator que o zeno não reconhece, só levam o aviso (a pessoa nunca é
  barrada). Merge não conta. Vale para qualquer ferramenta, e o githook gerado não muda (guarda `commit-sem-no`).
- O `sync` recusa gerar os hooks se `zeno` não resolve no PATH (senão todo Bash seria negado).

### 3. A CLI
- O estado de controle é **lido do ledger** (projeção), nunca do frontmatter; o frontmatter é uma vista. Editar à mão não muda o estado e falha no `validar`.
- Só evento assinado vale para decisão humana; o `artefato_sha256` amarra a aprovação ao conteúdo.
- Agente não declara faixa abaixo do piso; afrouxar é definido pelo efeito e exige assinatura.
- Faixa efetiva `nunca` ⇒ só pessoa sai da Execução; `executor` de agente é recusado.
- Procedência calculada (classes de origem + marca de contaminação) e herdada.
- `checks` só de `sistema.yaml`; um nó nunca traz comando.
- Piso do módulo aplicado em tempo de execução; `config_sha256` em todo evento.
- Disjuntor do nó e teto diário do alvo; `teto_diario.usd: 0`.
- Toda recusa de verbo que muda estado vira evento `recusa` (negação é atrito medido).
- `fronteira: empresa|cliente` ⇒ ids opacos e pessoas como hash em tudo que é commitado (ledger, fio, vista do nó,
  `sistema.yaml`; T73), com o sal e os nomes fora do git; sem o sal, nada escreve. No Inc. 3, verbo que exporta recusa nesses alvos.
- **Testabilidade sem porta dos fundos:** o core recebe `io` e `env` por injeção; só o `cli.mjs` lê `process.stdin.isTTY`
  e `process.env`. Os testes injetam um TTY e uma chave de fixture. Nenhuma variável de ambiente liga "modo teste"
  (guarda `sem-flag-de-teste`).

### 4. Pre-commit e pre-merge-commit (`zeno/.githooks/`)
Chamam `node ./cli.mjs` (não dependem do shim no PATH):
- `validar --staged` (append-only, projeção, assinaturas, `aprovado-mudou`, piso);
- `sync --check` (deriva);
- isolamento (D3): nenhum `.mjs` de `zeno/` importa de `../conhecimento/` ou `../avaliacao/`, nem há symlink para lá;
- sem dependência (D28): nenhum `package.json` com `dependencies`/`devDependencies`, nenhum `node_modules/`;
- `node --test` do `zeno/`, se couber em 10 s; se passar disso, vai para o bench da `avaliacao/` (registrado).

**A camada 4 de um alvo instalado (T97).** O `sync` gera `.agents/githooks/` (`validar --staged` e `sync --check`, que
falham fechado sem o Zeno) e liga o `core.hooksPath` só num clone livre. Num clone com hooks próprios, não toca e
avisa como encadear. O `sync --check` acusa o clone livre ainda não ligado e o hooksPath que saiu depois de ligado
(guardas `githooks-saida` e `githooks-intacto`; ver [instalacao](instalacao.md#hooks-de-git-de-um-alvo-t97)).
O resíduo: a config é local e um processo do uid da pessoa a desliga com um `git config`.

## Medição mecânica
O imposto (D19) é medido, não autorrelatado. No Inc. 1:
- os nós que a sessão tocou saem do próprio transcript (comandos `zeno <verbo> <id>`), sem arquivo de estado (T55);
- **quem mede (T103):** os verbos que mudam estado de nó (`novo`, `avancar`, `registrar`) e o hook `SessionEnd`. A CLI
  acha o transcript pela `CLAUDE_CODE_SESSION_ID` (`<config>/projects/*/<id>.jsonl`; `<config>` é o `CLAUDE_CONFIG_DIR`
  ou `~/.claude`), sem hook e em qualquer pasta. O transcript é lido **antes** da trava do ledger. Os transcripts dos
  subagentes (`<id>/subagents/agent-*.jsonl`) entram na conta (guarda `gasto-subagentes`). Não há hook `Stop`.
- a medição soma os tokens de uso da sessão e os **bytes** de entrada e saída das chamadas de ferramenta que são do
  Sistema (`zeno …`, leitura/escrita em `.agents/`); grava `gasto.registrado` com `fonte: medido` por nó, **por
  diferença** contra o `sessao_total` da última medição da mesma sessão neste ledger (T66). Os nós são os da chamada e os
  citados no transcript depois da última medição (no `SessionEnd`, também os mudados por agente na janela). Um citado que
  não é deste alvo conta na divisão (`nos_fora`), mas a parte dele fica para o ledger dele.
- só o `SessionEnd` grava `contaminacao.limpa`; a medição pela CLI nunca limpa a marca.
- Dependência declarada: nem o formato do transcript nem a variável da sessão nem a pasta `subagents/` são contrato
  público do Claude Code. Sondas: `transcript-formato`, `gasto-subagentes` (com a parte de ambiente) e `sessao-claude`.
  Transcript sem chamada de modelo não grava nada. Transcript ausente (no `SessionEnd`) ou com chamada de modelo e sem
  `usage` grava `fonte: indisponivel` com o `motivo` (`sem-transcript`/`formato`), e o placar mostra o buraco. A CLI
  sem a variável ou sem o arquivo não grava gasto e sai com o código de sempre.
- o agente escreve o próprio transcript (mesmo uid; no `zeno sessao`, a pasta de config tem escrita): o `medido` é
  indício, não prova.

## Resíduos declarados
- **A C1 (agente forjar decisão humana assinada) NÃO está fechada nesta máquina** (crítica adversarial da T80,
  2026-11-03, por inspeção, sem executar ataque). A assinatura prova a chave, não a pessoa: o agente roda com o mesmo uid
  do Filipe, e um agente desviado alcança a passphrase por (1) o shim `~/.local/bin/zeno` e a cópia fixada, que o shell
  escreve (a guarda de shell só casa esses caminhos como texto); (2) o que roda no terminal dele: `.zshrc`, o prompt, os
  `.githooks/`, scripts do repo; (3) os `/dev/pts/*` do mesmo uid (prompt falso, leitura disputada); (4) o WSL interop
  (`powershell.exe` com SendKeys ou keylogger; `wt.exe`). O conserto de verdade é isolar o agente (outro uid, sandbox ou
  contêiner) e/ou tirar a chave e o prompt do alcance do uid (FIDO com toque, ou um assinador noutro uid): decisão do
  Filipe, no nó "Isolar o agente do usuário do Filipe" (T82). Até lá, a T78 só reduz quantas vezes ele digita.
  **T82, passo 1 (o que o SO impõe, por camada e por ferramenta):**
  - **(A) `zeno sessao`, para qualquer CLI de agente.** Dentro dele, as rotas (2) a (4) acima fecham **para o próprio
    agente**: o repo não escreve `.githooks/`, `.git/config` nem `.claude/`; os ptys e o interop do host não aparecem; o
    127.0.0.1 do host não responde; o vsock e o chaveiro são negados; a casa não aparece. A rota (1) segue até o passo 2
    do [roteiro](roteiro-t82.md), que põe a cópia fixada e o shim com dono root.
  - **(B) o sandbox do Claude Code** (managed-settings): cobre o Bash de toda sessão `claude`, também a aberta fora do
    `zeno sessao`. Read, Edit, os hooks e os MCPs ficam fora dele. Entra pelo roteiro.
  - **(C) o marcador e o `sessao_obrigatoria`:** o ledger diz qual agente agiu, e um claude aberto fora do lançador não
    usa ferramenta nenhuma. Outra ferramenta sem porta segue só com as camadas 3 e 4.
  - **(D) A marca de sandbox (T105) e o marcador forjável.** Todo evento leva `sandbox`: `fora` quando a CLI não acha o
    marcador, e `sessao` quando acha, com `sessao` = o id do `sessao.aberta` que o lançador gravou nele. A marca diz o
    que a CLI observa, e só isso: o `bwrap` não é setuid e o kernel deixa user namespace sem privilégio, então um
    processo de fora, do mesmo uid, roda `bwrap --bind / / --ro-bind <arquivo> /run/zeno-agente -- zeno …` e a CLI acha
    o marcador; os outros sinais da fronteira somem do mesmo jeito com `--tmpfs` (dedução por leitura, sem executar o
    ataque). **Sem marcador, o ato foi de fora com certeza; com ele, é declaração**, e quem copia o id de uma sessão
    aberta passa no cruzamento ato↔sessão. Só um uid próprio do agente faz da marca uma prova. Uma assinatura num nó em
    que o agente agiu `fora` não tem prova de isolamento. Quem conta (atos de agente por marca, assinaturas em nó com ato
    de agente `fora`, marcas `sessao` sem `sessao.aberta` conhecido, fora da janela aberta–fechada ou de outro agente) é
    a `avaliacao/`, lendo os ledgers; o `validar` do alvo não julga a marca.
  - **O que segue aberto:**
    - **(i)** código que o agente escreveu e que roda **fora** (por você, pelo Zed, pelo git, por outro agente) alcança a
      chave e a passphrase. A prova do `promover` saiu dessa rota (T90): a suíte e o censo inteiros rodam num bwrap sem
      rede, com a casa em tmpfs e o repositório só leitura, e nada roda fora. O preço é que esse bwrap deixa criar user
      namespaces (para a sonda que cria o próprio bwrap aninhar), o que é mais superfície de kernel para o código da prova;
    - **(ii)** os conectores do claude.ai, a menos que a conta do agente não os tenha. **Aceito pelo Filipe em
      2026-11-03** (decisão A1 do [roteiro da T82](roteiro-t82.md), opção 3: o agente usa a conta dele como está).
      Reabre se o agente rodar sem supervisão (Inc. 4) ou se mudar a conta. **Reaberta em 2026-11-03:** as sessões da
      noite de 2026-11-02/03 já rodaram sem ninguém olhando, com os conectores e os MCP de escrita à mão, e o Filipe
      pediu escopos cada vez mais específicos. **Fechada nas raias com o Zeno pela T99** (nó
      `conectores-e-mcps-so-por-allowlist-do-al`): a allowlist `mcp:` do alvo e do perfil, imposta pelo hook, com o deny
      estático dos de escrita (camada 2 acima). Vale depois do `promover` e do `zeno sync` de cada alvo. Fora disso
      (o `conhecimento/`, a `avaliacao/`, um claude aberto fora de um alvo), o resíduo segue o da opção (3);
    - **(iii)** o toque ou a passphrase às cegas.

    Quem fecha a C1 é o passo 2 (FIDO), num nó à parte.
- O código que guarda roda da **cópia fixada** (T68); editar `zeno/core` não muda a guarda até uma pessoa promover. Mas
  o agente tem um shell: um `node` com código próprio pode escrever qualquer arquivo que o usuário escreve, inclusive os
  gerados e os `.githooks/`. A camada 2 filtra, não isola; a prova continua sendo a assinatura e o `validar` da cópia
  fixada no pre-commit. Enquanto não houver cópia fixada (antes do 1º `promover`), o pre-commit avisa e roda do repo.
- **T95, a cópia do root.** Na casa, a cópia fixada é do uid da pessoa, e um agente fora do sandbox a troca. Com
  `/opt/zeno` do root (bloco C do [roteiro da T82](roteiro-t82.md)), os dois git hooks, o `zeno sessao` e o
  `/usr/local/bin/zeno` rodam de `/opt/zeno/atual`, e só o root troca essa cópia. O `promover` empacota a cópia
  provada num tar, a pessoa assina (commit, sha256) com a chave já aberta, e o `bin/zeno-instalar-root` da cópia que
  está valendo roda por `sudo`, em `sh`, sem git e sem node. Ele recusa se a `pessoa.pub` faltar ou for gravável por
  outro usuário, se a assinatura não for dela para aquele commit e sha256, ou se o tar não tiver o sha256 assinado
  (guardas `instalar-pub`, `instalar-assinatura`, `instalar-sha256`). Não apaga nada: cada cópia e o que chegou ficam
  em `/opt/zeno`. **O que sobra:**
  - a 1ª cópia do instalador vem da casa, copiada à mão no bloco C, com o sha256 conferido contra o cartão do nó;
  - a `pessoa.pub` sai da `chave_pub` do `sistema.yaml` commitado, a mesma âncora das assinaturas de gate;
  - o `--voltar <commit>` não pede assinatura: ele só volta a uma cópia que o root já instalou e conferiu;
  - com a opção (b) (sudo sem senha), um erro no instalador fica exposto a qualquer processo do uid da pessoa.
- O hook da camada 2 tokeniza o comando, mas não o executa: um script escrito antes num arquivo e rodado depois, um caminho
  guardado em variável (`f=…; echo > $f`), alias ou função, e código que monta o caminho em tempo de execução passam. Em
  `node -e`/`python -c`, a escrita é detectada por nome de API: uma API fora da lista passa. O efeito que importa (decisão
  humana, afrouxar) está protegido pela assinatura; o resto (apagar arquivo por script, escrever no ledger um evento **não**
  assinado) é pego pelo `validar` no pre-commit ou não muda o estado.
- Reescrita de histórico (`reset --soft` + novo commit, `--no-verify`) muda o `HEAD` de comparação do append-only. A
  camada 2 nega as formas diretas; um script passa. Contramétrica para a `avaliacao/`: comparar o ledger com o do remoto.
- O `tamanho` é declarado. Contramétrica: na Entrega de nó P cuja `ref` é commit, o check compara as linhas mudadas com
  `sistema.yaml → limites.P_linhas` (padrão 80) e reprova acima.
- A marca de contaminação cobre ferramentas do Claude Code; conteúdo trazido por `curl` no Bash não marca. Os hooks globais
  e a cláusula "não contorne" seguem valendo.
- Fora do Claude Code (outro agente sem hooks), só a camada 3 e a 4 valem; a assinatura continua sendo a prova de pessoa.
- Mensagem de pessoa no fio não é assinada (só o que muda estado é). Um agente com TTY falso pode escrever como pessoa no
  fio; não muda gate nem orçamento. Sinal para o mapa: resposta de pessoa sem sessão de terminal correspondente.

## Registro de guardas (D33)

`zeno/guardas.json` é o **contrato com o censo da `avaliacao/`**: cada guarda tem um probe que prova que ela dispara e uma
mutação que prova que o probe pega a falha. A leitura de um agente nunca conta como prova.

```json
{"v":1,"guardas":[
  {"id":"faixa-nunca","camada":3,"o_que":"agente não sai da Execução de nó com faixa efetiva nunca",
   "fecha":"C2","estado":"ativa","probe":"test/probes/faixa-nunca.test.mjs",
   "mutacao":{"marcador":"/*G:faixa-nunca*/","por":"false&&"},"caminhos":["core/fluxo.mjs","core/verbos/escrita.mjs"]},
  {"id":"gate-juiz","estado":"declarada, adiada","custo":"…","sinal_reativa":"…"}
]}
```
- `caminhos`: arquivos que a guarda usa; o censo falha se algum não existir.
- A mutação (T58) copia o `zeno/` para uma pasta temporária, troca o marcador `/*G:<id>*/` por `false&&` ali e roda o probe: o probe **tem de falhar**. `node test/censo.mjs` roda o censo; marcador sem guarda ativa também falha.
- Guarda `"declarada, adiada"` (T56) não tem probe: tem `custo` e `sinal_reativa`.
  O `zeno/` real nunca é mutado.

Guardas do Inc. 1 (cada uma com probe + mutação na Etapa 2):

| id | Camada | Dispara quando |
|---|---|---|
| `deny-camada1` | 1 | cada regra de `deny` gerada casa com um caminho real (o probe prova o casamento, não só a presença) |
| `settings-portatil` | 1 | o gerado cita o caminho do checkout: `sync --check` acusa deriva num clone ou worktree ligado (T69) |
| `hook-fail-closed` | 2 | `zeno guarda` falha ou falta ⇒ a chamada é negada |
| `guarda-arquivo` | 2 | `Edit`/`Write`/`MultiEdit`/`NotebookEdit` num protegido ou no `negar_escrita` de fora do alvo, inclusive por symlink e em worktree (T69) |
| `guarda-shell` | 2 | escrita por shell em arquivo protegido, verbo de pessoa, `--no-verify`, mexer em `ZENO_ATOR`/`CLAUDECODE`/`CLAUDE_CODE_SESSION_ID` |
| `gasto-subagentes` | 0 | os transcripts dos subagentes entram na medição do gasto da sessão (T103) |
| `ferramentas-sem-segredo` | 0 | o `zeno ferramentas` confere login só pelo código de saída da tabela fixa: o que o comando imprime (um token) não chega à saída do zeno, nada é gravado e nenhum argumento pede token (T107) |
| `shell-por-parser` | 2 | texto citado num argumento ou código que só lê é negado (os 2 falsos positivos do 1º dia viram probe; T67) |
| `copia-fixada` | 2 | o shim da pessoa (ou o hook) roda o repositório editável em vez da cópia promovida (T68) |
| `chave-antes-da-prova` | 3 | o `promover` roda testes ou censo antes de conferir a passphrase (T72) |
| `adocao-intacta` | 1 | na adoção, o harness do repo muda fora do bloco do Zeno, ou o alvo adotado fica sem deny e hooks do Zeno (T74) |
| `pessoas-hash` | 3 | nome ou e-mail de pessoa em claro no disco de um alvo `empresa`/`cliente`, ou escrita sem o sal (T73) |
| `shell-ilegivel` | 2 | comando que o tokenizador não entende passa (tem de negar, fail-closed; T67) |
| `assinatura` | 3 | decisão humana sem assinatura válida (inclusive com TTY falso e sem `CLAUDECODE`) |
| `aprovado-mudou` | 3 | seção aprovada alterada depois do gate |
| `aprovado-mudou-aviso` | 4 | o `validar` aceita seção aprovada mudada sem o gate daquela fase reaberto (T87) |
| `gate-retirado` | 3 | o gate retirado por `zeno revisar` segue aprovável na caixa (T87) |
| `caixa-mudou` | 3 | o "todos" da caixa aprova um gate cujo texto mudou depois de aberto (T87) |
| `caixa-abre-o-que-importa` | 3 | a caixa fecha no resumo um gate de risco alto, de segurança (pelo diff), MUDOU ou sem nível (D40, T88) |
| `prova-isolada` | 0 | o `promover` roda os testes ou o censo fora do bwrap sem rede, sem a casa e com o repositório só leitura (T90) |
| `instalar-sha256` | 0 | o instalador root instala um tar cujo sha256 não é o assinado (T95) |
| `instalar-assinatura` | 0 | o instalador root instala cópia de outra chave, ou com assinatura de outro commit (T95) |
| `instalar-pub` | 0 | o instalador root confia numa `pessoa.pub` ausente, de outro dono ou gravável por outros (T95) |
| `teto-assinado` | 3 | uma liberação do teto diário (`gate --teto`) sem assinatura válida solta o alvo (T93) |
| `piso-faixa` | 3 | agente declara faixa abaixo do piso; P com commit acima de `limites.P_linhas` |
| `afrouxar` | 3 | afrouxar pelo efeito sem pessoa, motivo e assinatura (T63) |
| `faixa-nunca` | 3 | agente sai da Execução de nó `nunca`, ou é posto como executor dele |
| `ator-falso` | 3 | `CLAUDECODE` + `ZENO_ATOR` de pessoa |
| `marca-sandbox` | 3 | um evento sai sem `sandbox` (`fora` sem marcador, `sessao` com ele), o ato de dentro não leva o id do `sessao.aberta`, ou a marca fica fora da assinatura (T105) |
| `procedencia` | 3 | origem não confiável não sobe a faixa efetiva (fora da via expressa de código, T76) |
| `expressa-codigo` | 3 | P de via expressa de código fecha com commit fora de `cli.mjs core/ bin/ modulos/ test/*.test.mjs`, ou mexendo na prova das guardas (T76) |
| `promover-entrega` | 3 | o `promover` liga na cópia fixada código de nó cujo gate de Entrega não foi aprovado (T79) |
| `promover-so-pessoal` | 3 | depois de trocar a cópia, o `promover` roda o sync num alvo de empresa ou de cliente, mesmo com a confirmação da pessoa (T106) |
| `cartao-gate` | 3 | gate humano abre sem o cartão de decisão completo (T75) |
| `contaminacao` | 3 | nó criado em sessão marcada nasce sem `sessao:contaminada` (T63) |
| `disjuntor` | 3 | consumo acima do teto (`tokens`/`usd` >, `tentativas` ≥; T60) ou teto diário (alvo) |
| `lint-msg` | 3 | mensagem sem campo obrigatório |
| `append-only` | 4 | ledger ou fio editado/truncado no índice |
| `projecao` | 3/4 | frontmatter de controle editado à mão |
| `deriva` | 4 | gerado editado à mão |
| `isolamento` | 4 | import de `../conhecimento` ou `../avaliacao` |
| `sem-dependencia` | 4 | `package.json` com dependência |
| `sem-flag-de-teste` | 4 | código lê variável de ambiente que liga modo teste ou TTY falso |
| `transcript-formato` | — | o leitor do transcript ainda acha uso de tokens no formato atual |
