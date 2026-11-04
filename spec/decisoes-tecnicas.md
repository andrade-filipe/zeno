# Decisões técnicas do Inc. 1

Detalhes que as D's não fecham. Uma linha cada: a escolha e o porquê. Numeração `T<n>`. Esta é a versão 1, já revista
pela crítica adversarial de 2026-11-02 (achados `C1`–`C21` citados onde mudaram a decisão). Daqui em diante, uma decisão
revista ganha linha nova com "substitui T<n>" (nada é apagado).

## Estado e formato
- **T1.** O estado de controle é **lido do ledger** (projeção); o frontmatter é vista regravada pela CLI; o `validar` acusa a diferença — porque cumpre "CLI única porta de escrita" (D10) sem proibir o agente de editar o corpo, onde mora o artefato (C10).
- **T2.** `filhos`, faixa efetiva, consumo e arestas inversas são **derivados, nunca escritos** — porque dado duplicado diverge (mesma regra do motor do hub).
- **T3.** Id = slug do título (`-2` se colidir); opaco (`n-` + 6 hex) em alvo `empresa`/`cliente` — porque é legível na CLI e o título da empresa não vaza por id.
- **T4.** Mensagens num arquivo por nó (`<id>.fio.md`), separado do nó — porque o fio é append-only e o nó não.
- **T5.** Ledger num arquivo só com `merge=union` em `.agents/.gitattributes` — porque o git já traz o driver e acréscimo em dois branches não vira conflito.
- **T6.** Append-only = as linhas do `HEAD` aparecem iguais e na mesma ordem no novo arquivo (subsequência) — porque aceita o resultado do `merge=union`, que o "prefixo" do hub recusaria.
- **T7.** Ledger sem texto livre; pessoas em hash em alvo `empresa`/`cliente` — porque é o arquivo que a `avaliacao/` agrega e pode atravessar fronteira (C18).
- **T8.** `estrato` copiado em toda linha; para n por nó vale o do último evento — porque a `avaliacao/` calcula n e estrato só pelo ledger, e o estrato muda na vida do nó (C18).
- **T9.** `origem` (valor completo) é descritiva; o controle é `procedencia` + as classes no ledger — porque URL não entra no ledger e a projeção tem de fechar com o contrato (C10).
- **T10.** `depende_de` é campo de controle; as outras arestas são descritivas — porque `depende_de` trava fase e não pode sumir por edição à mão (C10).
- **T11.** Replay: evento que não encaixa vira erro `conflito`, resolvido por `ajuste` assinado — porque dois branches podem avançar o mesmo nó (C11).
- **T12.** Subconjunto de YAML do hub com chave que aceita `.` e conversão de tipo pela CLI — porque `entrega.push-main` e números do orçamento precisam passar (C17).

## Pessoa, ator e assinatura
- **T13.** Ator: `ZENO_ATOR` > `CLAUDECODE` ⇒ `ia:claude` > e-mail do git **só com TTY** > `ia:desconhecido` — porque processo sem terminal não vira pessoa por padrão (C1).
- **T14.** Decisão humana é **assinada com Ed25519**, chave privada cifrada por passphrase em `~/.config/zeno/`; a projeção só honra evento assinado — porque TTY e `CLAUDECODE` são forjáveis pelo agente e a passphrase não (o aprendizado do `sign.mjs` do hub) (C1).
- **T15.** A assinatura cobre o `artefato_sha256` das seções até a fase; seção aprovada que muda reabre o gate — porque a aprovação tem de valer para o conteúdo aprovado (C6).
- **T16.** Core com `io`/`env` injetados; só o `cli.mjs` lê `process` — porque testar o caminho "pessoa aprova" não pode criar uma variável de modo teste que vire contorno (C14).

## Faixas, gates, procedência
- **T17.** Piso de faixa por tamanho (P → `autonoma`, M/G → `aprovacao`); agente não declara abaixo — porque a faixa não pode ser auto-declarada (C2).
- **T18.** Afrouxar é definido **pelo efeito** (baixa faixa efetiva, tira ação/check/dependência/origem, sobe orçamento, cancela fora da `autonoma`) e exige assinatura — porque a lista por campo deixava rotas laterais (C2).
- **T19.** Piso do módulo aplicado em tempo de execução (máximo entre módulo e local); `sistema.yaml`/`faixas.yaml` negados ao agente; `config_sha256` em todo evento — porque a CLI lê a configuração a cada chamada (C3).
- **T20.** Gates humanos padrão só em Especificação e Entrega (na `nunca`, também Verificação) — porque são os pontos onde errar custa mais; o resto é check. Não engessar.
- **T21.** Marca mecânica de contaminação por hook `PostToolUse` (WebFetch, WebSearch, MCP), limpa no fim da sessão ou por pessoa — porque o agente injetado é justamente quem não declara a origem (C5).
- **T22.** Checks são comandos nomeados no `sistema.yaml` (+ `checks_padrao`); o nó só cita o nome — porque nó pode vir de insumo não confiável e não traz comando.
- **T23.** Contramétrica do tamanho: na Entrega de P com commit, linhas mudadas ≤ `limites.P_linhas` (80) — porque o tamanho é declarado e a via expressa não pode virar atalho (C2).
- **T24.** `entrega.push-main` = push para um main remoto compartilhado, não o commit local — porque no monorepo se commita direto no main e a ação tem de ser rara para ter sentido (C15).

## Fluxo e anti-engessamento
- **T25.** Chave faltando = `artefato.incompleto` (saída 1), **não** gate reprovado nem tentativa — porque erro de digitação não é retrabalho nem atrito (C8).
- **T26.** `tentativas` contam só no próprio nó (não somam entre filhos) — porque três typos em filhos pausavam a árvore inteira (C8).
- **T27.** Atrito do Aprendizado = gate reprovado, disjuntor, recusa de guarda ou escalada; `[[licao]]` opcional; `licao` pode correr pela via expressa — porque a cascata de atrito virava burocracia (C8).
- **T28.** `--tamanho` obrigatório no `novo`, sem padrão — porque qualquer padrão esconde uma escolha de custo (C15).
- **T29.** `pedido` obrigatório só em nó M/G delegado de verdade (quem criou ≠ executor agente); o resto usa `delegacao_padrao` — porque o agente não escreve contrato para si mesmo (C15).
- **T30.** O pai sai da Verificação quando todo filho já passou da Entrega (ou foi cancelado) — porque a janela de Observação do filho não pode travar o pai (C15).
- **T31.** Verificação de nó G exige `- sessao: nova` declarada — porque D21 manda sessão nova só para nó grande; a declaração vira dado.
- **T32.** Lição só com `origem` num evento de atrito do ledger ou numa `escalada` — porque torna "atrito observado" (D18) checável.
- **T33.** `registrar --retro` por agente fora da `autonoma` para no gate humano da Entrega — porque o retro não pode furar a faixa (C7).
- **T34.** `prazo`, janela vencida e nó parado são avisos, não erros — porque aviso informa sem travar.
- **T35.** Comentário `<!-- -->` não conta como artefato — porque template vazio não passa em gate.

## Orçamento e medição
- **T36.** Orçamento em `tokens`, `usd`, `tentativas`; tempo só como `prazo` — porque tempo de parede não é custo ativo.
- **T37.** Ausente/`null` = sem teto; `0` = teto zero; `teto_diario.usd: 0` no Inc. 1 — porque um parser só lê o 0 de um jeito, e nenhuma rodada paga sem OK (C13).
- **T38.** Teto diário bloqueia `novo`/`avancar` no alvo inteiro e se desfaz na virada do dia UTC, sem pausar nó; o disjuntor do nó só uma pessoa rearma — porque são escopos diferentes (C13).
- **T39.** Tokens medidos pelo hook `SessionEnd` lendo o transcript, com bytes de ferramenta do Sistema × total; `registrar gasto` vira `fonte: declarado` — porque a D19 pede medida, nunca autorrelato (C4).
- **T40.** `contexto` escreve `contexto.montado` — porque o contexto é custo do Sistema.

## CLI, instalação, hooks
- **T41.** Verbos a mais: `ajustar`, `chave`, `guarda` (hooks), `ajuda`, `versao` — porque mudar controle e gerar chave precisam de porta auditada, e o hook precisa de código que o alvo não leva.
- **T42.** `registrar` tem duas formas: retroativo e `gasto` — porque ambos registram um fato que a CLI não viu acontecer.
- **T43.** Códigos de saída 0–6 e 9 — porque hook e scripts distinguem recusa (1), pessoa (3) e orçamento (4) sem ler texto.
- **T44.** Trava `.agents/.zeno.lock` com `{pid, ts}`, assumida se o pid morreu ou passou de 60 s; checks fora da trava — porque trava órfã não pode parar o alvo e o agente não pode apagar arquivo (C9, C21).
- **T45.** Skills de módulo vão direto para `.claude/skills/zeno-<nome>/` (cópia); `.agents/skills/` só para skills locais — porque o Claude Code não lê `.agents/skills/`.
- **T46.** Cabeçalho de JSON gerado = a entrada no `gerados.lock` — porque chave desconhecida no `settings.json` pode falhar a validação do Claude Code.
- **T47.** Regras de `deny` geradas com caminho absoluto (`//…`) e uma guarda que prova o casamento — porque regra relativa pode virar no-op em silêncio (C16; a lição do Inc. 0).
- **T48.** Hooks de git do `zeno/` chamam `node ./cli.mjs`; `install --sem-sync`; `sync` recusa gerar hook sem `zeno` no PATH — porque o dogfood não pode depender do shim antes de o Filipe ligá-lo (C9).
- **T49.** `pre-merge-commit` além do `pre-commit`; a camada 2 nega `--no-verify` e reescrita de histórico com `.agents/` — porque merge com union também precisa de `validar` (C11).
- **T50.** Cartões e lint ficam no módulo, lidos na versão fixada; o alvo não guarda cópia — porque o alvo leva só os dados que ele mesmo edita.
- **T51.** `node --test` no pre-commit só se couber em 10 s — porque pre-commit lento convida a contornar.
- **T52.** Ordem do ledger: `ts`, depois `id` — porque o `merge=union` intercala blocos de branches.

## Etapa 2 (construção): desvios e acréscimos
- **T53.** `zeno caixa --aprovar`: aprovação **em lote** dos gates humanos da pessoa (nó, fase, resumo das chaves, `artefato_sha256`); ela escolhe todos ou alguns, digita **uma** passphrase, e sai um `gate.decidido` assinado por gate. A chave aberta vive só na memória do processo daquela chamada; nada fica em disco nem em processo que o agente alcance — porque dois gates por nó M/G, um a um, custavam caro demais para "não engessar" (origem: ajuste da orquestradora no Checkpoint 1, 2026-11-02; o Filipe escolheu "manter os gates + lote" quando perguntado direto na sessão do Inc. 1, numa escolha entre opções; a revisão dele do desenho completo ainda está pendente).
- **T54.** Hash das pessoas no ledger (fronteira `empresa`/`cliente`) **adiado** para o Inc. 2; o `install` avisa e os ids de nó já são opacos fora da fronteira pessoal — porque o Inc. 1 só tem alvo pessoal ([guardas.json](../guardas.json), `pessoas-hash`).
- **T55.** Os nós tocados por uma sessão saem do **transcript** no `SessionEnd`, não de `.agents/.sessoes/`: os citados em comandos `zeno <verbo> <id>` ∪ os que um agente mudou no ledger dentro da janela de tempo do transcript — porque um arquivo de estado a menos; e o dogfood mostrou que só o comando perde o id guardado em variável de shell (a 1ª medição pôs a sessão inteira num nó só).
- **T56.** **Orçamento de complexidade por guarda**: guarda cujo custo passa do que protege (modo síncrono, uma pessoa) vira `"declarada, adiada"` no `guardas.json`, com o custo e o **sinal que a reativa**, e entra na lista do mapa de pontos de atenção. As guardas que fecham C1, C2, C3, C5 e C6 não se adiam. Adiadas no Inc. 1: `pessoas-hash`, `gate-juiz`, `custo-por-ferramenta`, `trava-entre-maquinas` (`shell-por-parser` foi adiada e reativada no mesmo dia: T67).
- **T57.** A marca de contaminação é **evento no ledger** (`contaminacao.marcada` / `contaminacao.limpa`, por `sessao_sha256`), não `.agents/.contaminacao` — porque assim ela entra na projeção, na ordem e no `validar` como todo o resto.
- **T58.** Mutação do censo = o marcador `/*G:<id>*/` na condição da guarda, trocado por `false&&` numa cópia temporária (`test/censo.mjs`), em vez de um script por guarda em `test/mutacoes/` — porque o marcador mostra no código onde a guarda está, e o censo também acusa marcador sem guarda.
- **T59.** `dur_ms` de evento assinado = do início da chamada até a assinatura (inclui ler a seção e digitar a passphrase); `gate.decidido` humano leva `espera_ms` = da abertura do gate até a assinatura — porque a espera em gate humano é medida desde o dia 1 (pedido do orquestrador).
- **T60.** Disjuntor: `tokens` e `usd` disparam acima do teto (`>`), `tentativas` no teto (`≥`) — porque gastar exatamente o orçamento é cumprir; a 3ª reprovação com teto 3 é a que para.
- **T61.** Seção aprovada que muda reabre o gate com `gate.aberto` e `dados.reabertura: true` (sem evento novo) — porque o vocabulário de eventos fica fechado.
- **T62.** A camada 2 também nega `zeno guarda …` ao agente — porque o hook é a porta do Sistema, e um agente que chama `guarda fim-sessao` falsifica a medição.
- **T63.** Guardas separadas de C2 e C5 para cada uma ter probe próprio: `afrouxar` (fora de `piso-faixa`) e `contaminacao` (fora de `procedencia`). São 20 guardas ativas.
- **T65.** A contramétrica de linhas do P (T23) não conta arquivos em `.agents/` — porque o ledger e as vistas são a contabilidade do Sistema, e no dogfood eles sozinhos passavam de 80 linhas num P de verdade.
- **T66.** O `fim-sessao` mede **por diferença**: subtrai o que a mesma sessão (`sessao_sha256`) já gravou como `medido` e grava só o resto, com `ja_medido_tokens` no evento — porque o transcript é cumulativo; sessão retomada, ou medida à mão antes de o hook existir (o dogfood desta), contaria em dobro.
- **T67.** A guarda de shell da camada 2 decide por **tokenizador mínimo de shell** (`core/shell.mjs`), não por regex sobre o texto cru: verbo de pessoa só com `zeno`/`cli.mjs` em posição de comando e o verbo no argumento 1; arquivo protegido só com alvo de **escrita**; `node -e`/`python -c` só negam se o código cita o protegido **e** uma API de escrita; o código de `sh -c`, `eval`, `$( )`, crases e `find -exec` também é analisado; o que o tokenizador não entende é negado com o porquê (`shell-ilegivel`). Duas guardas novas com probe e mutação (`shell-por-parser`, `shell-ilegivel`): 22 ativas — porque houve **2 falsos positivos no 1º dia** de hooks ativos (texto citado num argumento; `node -e` que só lia o ledger), e a D19 manda cortar esse atrito (reativação decidida pela orquestradora em 2026-11-02).
- **T68.** **Cópia fixada**: o código que guarda roda de `~/.local/share/zeno/atual` (cópia por commit, troca atômica do `atual`), não do repositório que o agente edita. Só uma pessoa promove (`zeno promover`, assinado, TTY, fora do Claude Code), e só de árvore commitada com testes e censo verdes. O `promover` troca o shim `~/.local/bin/zeno` (antes um symlink para o repo) por um arquivo que roda a cópia fixada — porque a pessoa também digita a passphrase nele. O pre-commit roda `validar --staged` e `sync --check` da cópia fixada; `validar --codigo` e os testes seguem no código em desenvolvimento. A camada 2 nega ao agente `promover` e escrita na cópia, no shim, em `.claude/settings*.json` e `CLAUDE.md` — porque o agente editava a trava e a mudança valia no comando seguinte, sem commit, teste nem censo (achado de 2026-11-02, quando a T67 entrou; escolha do Filipe: "cópia fixada"). Fase B, depois da 1ª promoção: os hooks gerados chamam a cópia fixada por caminho absoluto, e a camada 1 nega a cópia e o shim.
- **T69.** **Gerados portáveis.** O `settings.json` não cita o caminho do checkout: as regras do alvo são `Edit(/<rel>)`, que as docs do Claude Code ancoram no diretório onde a sessão abre (a raiz do alvo, pela regra do AGENTS.md). Só `Edit(...)`: as docs dizem que regra de caminho em `Write(...)` é aceita e **nunca casa**, e que `Edit` cobre Write, MultiEdit e NotebookEdit. O que fica **fora** do alvo (`negar_escrita`, ex.: `../conhecimento`) não vira regra de camada 1, porque `..` em regra não é documentado (C16: regra que não casa é no-op calado); vai para um hook `PreToolUse` com matcher `Edit|Write|MultiEdit|NotebookEdit` (`zeno guarda pre-tool`, fail-closed), que resolve o `file_path` contra a raiz **deste** checkout, segue symlink e nega o rol inteiro (o de dentro também: segunda camada se a sessão abrir numa subpasta). Uma lista só (`core/protegidos.mjs`) alimenta as duas camadas. Guardas `settings-portatil` e `guarda-arquivo`, com probe em worktree ligado e clone reais e mutação. A pasta `.agents/trabalho` conta como existente para a `deny-camada1` (o git não leva pasta vazia) — porque com caminho absoluto o `sync --check` acusava deriva em todo clone e worktree e o pre-commit do `zeno/` falhava (achado do censo da `avaliacao/`, `dispatcher:zeno`, 2026-11-02). A fase B da T68 usa `~/` (prefixo documentado), não caminho absoluto. Resíduo: a ancoragem de `/` e o hook de arquivo foram lidos nas docs e provados pelo probe do Zeno; a prova ao vivo no Claude Code é uma tentativa de `Edit` numa sessão real depois do `zeno sync`.
- **T70.** **Contrato do ledger, acréscimos pedidos pela `avaliacao/`** (compatíveis: `v` continua 1): `recusa` da guarda leva o `no` citado no comando negado (ou no `.fio.md`), quando há, e `sessao_sha256` (B2); `fase.avancou` de saída do Aprendizado leva `atrito_padrao: true` quando o `atrito: nenhum` foi preenchido pela CLI (B3); `install.executado` leva `fronteira` (B5); `gasto.registrado` medido documenta `tokens_cache_leitura`, `nos_na_sessao` e `ja_medido_tokens` (B6); `recusa` ganha a regra `arquivo-protegido` (T69). Teste: `test/contrato.test.mjs` — porque a `avaliacao/` precisava atribuir atrito a nó e sessão e separar o "nenhum" automático do declarado sem ler texto livre. B1, B4 e B7 ficam para depois (decisão da orquestradora).
- **T71.** `sed -i`/`perl -i` negam só quando um **arquivo operando** é protegido: o script (o 1º operando sem `-e`/`-f`, ou o valor de `-e`/`--expression`) é texto, não alvo. As opções valem em qualquer posição (o getopt do GNU permuta: `sed 's/a/b/' -i f`), `--` encerra as opções, e o que não se reconhece conta como arquivo. No sed, `w <arquivo>` dentro do script também escreve: se o arquivo é protegido, nega. O comando literal da escalada `m-mvzv2ceu-8ba3db16` é a fixture FP4 do probe `shell-por-parser` — porque a regra antiga olhava todo argumento e negou um `sed -i` em arquivos de teste cujo script citava o ledger como texto (2026-11-02). Resíduo: o comando `e` do sed e um `-f script.sed` não são lidos (como antes).
- **T73.** **Pessoas em hash** (reativa a T54) em alvo de fronteira `empresa`/`cliente`: no disco vai `h:<8 hex>` de `sha256(sal + ":" + id)` — no ledger (`ator`, `assinatura.pessoa`, `dono`/`revisor`/`executor`, `pessoas` do gate, `para`, `decisor.id` humano, `antes`/`depois` de ajuste de papel), no cabeçalho do fio e no `quem-decidiu`, na vista do nó e nas chaves de `pessoas` e no `padrao` do `sistema.yaml` (e-mail como `git_sha256`). O sal e a lista de nomes moram fora do git, em `~/.config/zeno/sal/<alvo>.sal`, criados pelo `install`. A tradução é **só na borda** (`core/pessoas.mjs`): na memória a CLI usa o nome (`--para ana` continua valendo), e a assinatura é feita e conferida sobre a forma do disco. Sem o sal, `abrir` recusa (`pessoas-hash`): nada é escrito em claro. Alvo pessoal: identidade, byte a byte igual. O subconjunto YAML aceita chave entre aspas — porque o 1º alvo de cliente é fronteira `cliente` e o repo vai para o GitLab do cliente (D35), e com o nome como chave no `sistema.yaml` o hash não esconderia nada (achado de 2026-11-02; escolhas do Filipe: sal fora do git, hash também no `sistema.yaml`). Resíduos: texto livre escrito por pessoas nos artefatos não é coberto; uma 2ª máquina precisa do arquivo do sal (T44); acrescentar pessoa a um alvo hasheado ainda é à mão; quem abre sessão num alvo hasheado sem o sal tem os hooks negando (ver T74).
- **T74.** **Adoção num harness rico**: o `.claude/settings.json` do repo fica **intacto** (local), e as regras do Zeno — deny da camada 1 e os hooks da camada 2 — vão num `.claude/settings.local.json` gerado, por máquina e fora do git. Nas adoções o deny cobre só os arquivos do Zeno (`.agents/…`, a skill `zeno-*`) e os dois settings; `CLAUDE.md`, `AGENTS.md` e o resto de `.claude/` ficam com as regras do próprio repo (o hook de arquivo usa o mesmo rol, `core/protegidos.mjs`). `settings.local.json` manual já existente: o `sync` recusa sem tocar. Probe `adocao-intacta`: harness sintético rico, idêntico byte a byte fora do bloco do Zeno no `AGENTS.md` — porque com os hooks fail-closed no settings **commitado**, todo colega do time sem o zeno teria todo Bash e Edit negado, e o deny no settings tiraria o ask do time (achado do plano a seco no 1º alvo de cliente, 2026-11-02; escolhas do Filipe: deny só do Zeno + settings, regras no local; a Especificação aprovada dizia "somar no settings.json", e mudou na Execução). O plano a seco achou também que o `install` **com** sync num diretório novo falhava na `deny-camada1` (o lock ainda não existe): consertado, com teste. Resíduos: (1) **camada 4 no alvo adotado** — o Zeno não instala githook; o repo tem os seus, e ganhar uma linha do Zeno no githook do próprio repo é decisão para depois (pedido da orquestradora, D36); (2) quem abre sessão no alvo sem o `settings.local.json` (outra máquina, o time) não é governado pelo Zeno: é o desenho, não um furo; (3) a guarda de shell (`PROT`) ainda nega escrita por shell em `CLAUDE.md` e `.claude/settings*` também no alvo adotado, mais estrita que o ask do repo, e só nas sessões do Filipe.
- **T72.** O `zeno promover` abre a chave da pessoa (passphrase) **antes** dos testes e do censo, como a `caixa --aprovar` (T53): passphrase errada sai com 1 sem ter rodado nada. Guarda `chave-antes-da-prova` (probe conta as chamadas de `rodar`) — porque no 1º `promover` real a passphrase errada só apareceu depois de 1–2 min de prova, e a 2ª tentativa refez tudo (2026-11-02).
- **T75.** **Cartão de decisão** em todo gate humano (D36): 6 chaves `cartao-*` na seção da fase do gate (o que muda,
  por quê, risco, como desfazer, se reprovar, 1 a 3 coisas a conferir). Sem o cartão completo o gate não abre
  (`artefato.incompleto` com só os nomes dos campos, saída 1); campo vazio, genérico (os `vazios` do `lint.yaml`) ou com
  menos de 8 letras não vale. `--cartao-*` vai para a fase do próximo gate humano. A `caixa --aprovar` e o `gate --aprovar`
  mostram o cartão inteiro antes da passphrase; o `promover` mostra o assunto dos commits desde a cópia anterior. Guarda
  `cartao-gate` (probe + mutação). Chaves de linha (`- cartao-x:`), não uma subseção `### Cartão`: o parser de chaves já
  existe, o cartão entra no `artefato_sha256` assinado, e o ledger segue sem texto livre — porque o Filipe disse que
  acabava aprovando pela CLI sem entender o que aprovava (tempo de assinatura perto de zero na ficha da espera em gate),
  e a D36 pede humano só quando necessário e então bem contextualizado (2026-11-02). Gate reaberto (T15) e gate aberto
  antes da T75 não pedem cartão; a caixa mostra o resumo de antes. Resíduo: o lint não julga se o cartão é verdadeiro,
  só se não é vazio — cartão no automático continua possível (o risco que a Especificação nomeou).
- **T76.** **Via expressa de código do zeno** (D36): `novo --expressa --codigo`, só no alvo que é o código do zeno
  (`cli.mjs` e `core/run.mjs` na raiz), cria um P cuja procedência `nao-confiavel` **não** sobe a faixa; o piso das ações e a
  herança de `nunca` continuam. Na Entrega, o gate check confere o commit da `ref` (`git diff-tree`): só `cli.mjs`,
  `core/`, `bin/`, `modulos/` e `test/*.test.mjs`; qualquer outro arquivo reprova (guarda `expressa-codigo`), e o caminho é
  `ajustar faixa=aprovacao` (gate humano com cartão). O `zeno.promovido` leva `nos` (os nós com `ref` entre a cópia anterior
  e a nova), e o `promover` mostra esses nós antes da passphrase, com os de via expressa marcados — porque num P de código
  o gate humano repetia o que o `promover` assinado (testes, censo, T68) já faz antes de o código chegar às guardas, e a
  D36 manda cada ato humano valer a pena; com `nos`, a `avaliacao/` conta "atos humanos por nó" (gates + promover +
  mensagens de pessoa). Pré-condição provada antes: a cópia fixada e o shim fechados à ferramenta Edit pelo
  `settings.local.json` do Filipe (2026-11-02). **Duas mudanças na Execução, escolhas do Filipe:** (1) a Especificação dizia
  "mesmo com pai em aprovacao", mas a faixa do pai só passa ao filho quando é `nunca`; o que põe os P de código em
  `aprovacao` é a procedência (sessão contaminada), então a regra isenta a procedência — afrouxa a C5 nesse recorte;
  (2) o agente lateral achou que, com `test/` e `guardas.json` na via sem gate, um mesmo commit afrouxaria uma guarda, o
  probe dela e a lista do censo, e o promover passaria: a **prova das guardas** (`guardas.json`, `test/probes/`,
  `test/censo.mjs`, `test/ajuda.mjs`, `test/fp-shell.mjs`, `test/fixtures/`) ficou fora da via expressa. Resíduos: o
  assunto do commit que o promover mostra é escrito pelo agente (ler o diff continua sendo da pessoa); uma mudança em
  `core/` que afrouxa uma guarda sem que o probe dela perceba passa pelos testes e pelo censo — o mesmo resíduo de
  qualquer probe, agora sem o gate humano do nó.
- **T77.** **Os 4 atritos da instalação real no 1º alvo de cliente** (a sessão de instalação no 1º alvo de cliente, 2026-11-03), consertados pela
  via expressa de código (T76; 1º uso real, 4 nós sem gate, `nos` no `zeno.promovido` de `7f7c3aa`): (1) num worktree
  ligado o `install` tirava o nome do alvo da pasta do worktree (`zeno-piloto`); agora vem do checkout principal
  (`git rev-parse --git-common-dir --show-prefix`), e sem ele o `install` pede `--alvo-nome` (`892cce2`); (2) o
  `status` de um alvo adotado avisava "camadas 1–2 ausentes" com elas no `settings.local.json` gerado (`50c9014`);
  (3) o `local` da adoção só declarava o rol fixo; agora declara todo o harness que já existia (`.claude/` item a item,
  `bench/`, `scripts/`, os `.md` da raiz; o `AGENTS.md` fora, com o porquê no `sistema.yaml`) (`d7e35f2`); (4) o
  `settings.local.json` só ficava fora do git pelo gitignore global da máquina; agora vai no `info/exclude` do clone, e
  o `sync --check` acusa se faltar (`8b94609`) — porque o plano a seco da T74 conferia que o harness não mudava, mas não
  o que o Zeno diz, declara e deixa fora do git; a instalação real foi o teste que faltava. Resíduos: o sal órfão
  `~/.config/zeno/sal/zeno-piloto.sal` da 1ª tentativa é do Filipe (não tocado); um clone já adotado ganha a linha do
  `info/exclude` no próximo `zeno sync`. **Achado, não implementado:** o `zeno pendentes` lista para a pessoa (o dono)
  "janela de Observação vencida" de nó já entregue, inclusive de janela `0d`; num nó P expresso ou autônomo isso é um
  ato humano que não vale a pena (D36). Caminhos possíveis: a Observação de janela `0d` sair sozinha com
  `observado: sem janela`, ou o item ir para a caixa do executor quando ele é agente.
- **T78.** **Uma passphrase por rodada**: a `caixa --aprovar` oferece o `promover` quando há código novo desde a cópia
  fixada, e usa a mesma chave destravada na memória do processo (`--promover` não pergunta). O `promover` virou
  `prepararPromover` (validação, commits, nós; antes da passphrase) + `executarPromover` (prova fora da trava, cópia,
  shim, evento assinado) — porque o Filipe se incomodava de digitar a passphrase a cada gate e a cada promover, e escolheu
  "os dois, em ordem": primeiro isto, depois avaliar um cache com TTL preso ao terminal, só se resistir a uma crítica
  adversarial contra a C1 (2026-11-03). Entrou pela via expressa de código (`925b11f`). **Achados, não implementados**
  (o Filipe pediu um nó à parte que proponha o caminho): (a) o `promover` liga na cópia fixada código cujo gate de
  Entrega ainda não foi aprovado (nota de um agente lateral; não aconteceu na T76, aprovada antes do promover, mas nada
  impede); (b) todo conserto expresso que muda comportamento pede um nó de docs à parte, com 2 gates humanos (atrito D36).
- **T81.** **Adoção sem skill no `.claude/` do repo**: na adoção o `sync` não gera `.claude/skills/zeno-*`; a skill chega
  pelo `zeno contexto`; o órfão de adoção antiga vai para `.agents/_lixo/`; o deny da adoção deixa de citar a skill —
  porque a CI do 1º alvo de cliente quebrou depois do merge do !28: o bench do harness do repo exige regra de ativação para
  toda skill em `.claude/skills/`, e o install em adoção não roda o bench do alvo (2026-11-03). Escolhida sobre "rodar o
  bench do alvo no install", que dependeria de conhecer o harness de cada repo. Custo aceito pelo Filipe: o agente no
  repo adotado perde a skill como gatilho automático. Achado de processo: o plano a seco de uma adoção roda também a CI
  ou o bench do próprio alvo, na cópia.
- **T79.** **Promover só com a Entrega aprovada; decisão técnica no expresso**: (a) o `promover` recusa, antes da
  passphrase e de novo antes da prova (os gates da mesma rodada já gravados), quando a cópia traria o commit da `ref` de
  um nó que toca o código e não passou da Entrega, exceto a via expressa de código; na `caixa --aprovar`, as Entregas
  aprovadas na mesma rodada contam. Git que falha conta como "toca" (fail-closed). Guarda `promover-entrega`. (b) O
  commit de um nó expresso de código pode tocar também `spec/decisoes-tecnicas.md`, só por acréscimo (`--numstat`, 0
  linhas removidas); o resto da spec segue com gate — porque eram os 2 achados da T78: o promover ligava código antes da
  decisão do Filipe, e cada expresso de código pedia um nó de docs com 2 gates humanos (D36). A Especificação aprovada
  escolheu recusar, não só tirar da lista, porque tirar da lista não tira o código da cópia. Resíduo: um acréscimo em decisoes-tecnicas
  pode contradizer uma linha antiga sem removê-la.
- **T80.** **Cache da chave destravada preso ao terminal: rejeitado.** O Filipe pediu o cache com TTL só se resistisse a
  uma crítica adversarial contra a C1; a crítica (subagente novo, read-only, por inspeção) achou ao menos 6 caminhos
  viáveis nesta máquina: processo com o ctty do Filipe (rc, prompt, `.githooks/`, shim, servidores MCP); reuso do número
  do pty depois de fechada a aba; ler e escrever `/dev/pts/N` do mesmo uid; WSL interop (SendKeys, keylogger, `wt.exe`);
  o SIGUSR1 do Node abrindo o inspector no daemon (core dump com `prlimit`, provável); Node sem dependência não tem
  `SO_PEERCRED`; e um daemon falso amarra o socket antes. Com o cache, "o agente precisa capturar a passphrase" viraria
  "qualquer código com o terminal dele assina calado durante o TTL". Achado maior: a C1 já não está fechada hoje (ver
  `seguranca.md`, Resíduos); o conserto (isolar o agente, ou a chave fora do alcance do uid) é o nó T82. A T78 fica.
- **T84.** **O `anterior` do `zeno.promovido` sai do ledger quando o `atual` já aponta para o commit novo**: uma
  promoção que caiu depois de trocar o `atual` e antes do evento (antes da T72, a passphrase errada caía ali) deixa o
  `atual` no commit novo; a retentativa gravava o próprio commit como `anterior` e perdia os commits e os `nos` da
  faixa. Agora, nesse caso, o `anterior` é o `commit` do último `zeno.promovido` do ledger, com aviso — porque o mapa do
  Zeno achou o evento de `9caeaf7d60c7` com `anterior: 9caeaf7d60c7` (o certo é `cd9434d9d495`): duas trocas do shim
  com 13 s de diferença no `_lixo/` (20:02:39 e 20:02:52) mostram a 1ª tentativa caída. O evento antigo **não** é
  reescrito (append-only), e o contrato não tem evento de correção para o `zeno.promovido`: quem lê a cadeia (a
  `avaliacao/`) toma o `anterior` de um evento como o `commit` do evento anterior quando os dois discordam.
- **T85.** O `pendentes` lista a Observação vencida só para o **executor** do nó (ou o criador): a Observação é check,
  preenchida por quem executou — porque mandava ao Filipe a Observação de nó P de docs executado por agente (a T78 docs),
  um ato humano que não vale (D36; atrito da T77).
- **T86.** **A troca da cópia fixada só fica com o evento assinado gravado**: o `promover` troca o `atual` e o shim e
  depois grava o `zeno.promovido`; qualquer falha entre as duas coisas (a trava, a gravação do ledger) agora desfaz a
  troca: o `atual` volta para a cópia de antes (ou vai para o `_lixo/`, se não havia), e o shim de antes volta do
  `_lixo/`; o shim novo vai para o `_lixo/` (nada é apagado) — porque a T84 só corrigia o campo `anterior`, e o código
  novo ficava valendo sem o registro assinado da pessoa (nota de um agente lateral, 2026-11-03).
- **T83.** **O bloco do `AGENTS.md` só vale onde o Zeno está instalado** (D39: cada porta entrega o bloco junto com as
  próprias travas):
  - Na adoção com a porta do Claude Code, o `sync` não põe o bloco no `AGENTS.md` commitado. Ele gera, no
    `settings.local.json`, um `SessionStart` com `zeno contexto --bloco`, que só lê e não grava evento. O bloco de
    adoções antigas sai no próximo `sync`, e o resto do arquivo fica byte a byte. Guarda `bloco-pela-porta`, no probe
    `adocao-intacta` estendido.
  - Conferido na doc do Claude Code, por um subagente de docs: a saída de texto do `SessionStart` entra no contexto, com
    teto de 10.000 caracteres (o bloco tem ~1,3 kB); um erro no hook não para a sessão.
  - A Verificação é por tentativa, simulada sem rodada de LLM: sem a CLI no PATH, o comando do Zeno falha e nada é
    escrito no ledger.
  - O contrato mínimo de uma porta está em [portas](portas.md).
  - Porque o bloco chegava a toda sessão do repo do time, e as travas só à máquina do Filipe (pedido da orquestradora;
    o hub, CQ-0014, reforçou: texto condicional não é trava, e tirar o bloco corta ~20% de custo para quem não usa o
    Zeno).
  - Resíduos: (1) uma sessão numa subpasta do repo adotado pode ficar sem o bloco e sem as travas. A doc não diz se o
    `settings.local.json` da raiz carrega ali; a confirmação fica para o uso real. (2) Uma sessão de verdade sem a porta
    tentando o Zeno (`claude -p`, pelo `portao-llm`) é do Filipe, se ele quiser a prova com o modelo.
- **T82.** **Isolar o agente do usuário do Filipe, passo 1** (D37, D39; a Especificação revista no nó). A Execução cobre
  a parte que não pede root nem o Filipe.
  - **(A) A base, de SO: `zeno sessao <agente> [--plano] [-- comando …]`** abre qualquer CLI de agente num bwrap, com o
    perfil do registro `agentes:`.
    - **Namespaces:** pid, ipc, uts, cgroup e **rede**, com `--disable-userns`, `--new-session`, `--die-with-parent`,
      `--cap-drop ALL` e `--clearenv`.
    - **Sistema:** `/usr` e `/etc` só leitura; `/proc`, `/dev` (devpts próprio, sem `/dev/dxg`), `/tmp` e `/run` novos.
    - **Casa:** a do Filipe vira tmpfs, e o que roda (o binário do agente, o node e a cópia fixada) entra só leitura.
    - **Repositório:** leitura e escrita, com bind só leitura por cima do controle do git e do harness (`.git/config`,
      `hooks`, `info`, `.githooks/`, `.claude/`, `.mcp.json`, `.zed/`, `.vscode/`).
    - **Seccomp:** um filtro BPF escrito em Node, sem dependência (`core/seccomp.mjs`), nega AF_VSOCK, TIOCSTI e
      TIOCLINUX, o chaveiro do kernel, o io_uring e toda outra ABI.
    - **Rede:** a saída é só por um proxy CONNECT de fora (`core/proxy.mjs`), num socket Unix, com allowlist de host e
      porta. Endereço privado ou de loopback é negado mesmo para host permitido. Dentro, o `zeno relay` (no `cli.mjs`,
      T16) liga o `HTTPS_PROXY` ao socket.
    - **Env:** só a allowlist do perfil; o interop, a tela, o barramento, o canal entre sessões e o `ZENO_ATOR` nunca
      entram.
    - **Perfil:** nunca expõe a casa, `~/.config`, `~/.ssh`, `~/.aws`, `~/.claude` nem `/mnt`.
    - **Ledger:** `sessao.aberta` e `sessao.fechada` (agente, código e rede permitida ou negada).
    - **Custo:** a sessão de prova inteira leva de 0,3 a 0,6 s, com 2 chamadas do zeno dentro.
  - **(C) A identidade:**
    - **Marcador:** `/run/zeno-agente` é bind só leitura, que o agente de dentro não troca e o de fora não cria (o
      `/run` é do root). Ele é o ator, e o `ZENO_ATOR` não o troca.
    - **Achado do inventário (D39):** um processo com TTY e o e-mail da pessoa não sai como ela se uma CLI de agente
      conhecida está acima dele (`/proc`, pelo `cli.mjs`).
    - **Hook:** com `sessao_obrigatoria: true` no `sistema.yaml`, o hook (`*`) nega toda ferramenta fora da fronteira.
  - **Guardas** no censo, cada uma morta por mutação: sessao-rede, sessao-env, sessao-repo-so-leitura,
    sessao-seccomp, sessao-proibidos, proxy-allowlist, proxy-privado, ator-marcador, ator-pai-agente e sem-sessao.
  - **(B) A porta do Claude Code** (managed-settings, a decisão de 2026-10-27) e os passos com root ou login estão no
    [roteiro da T82](roteiro-t82.md), que o Filipe roda de uma vez.
  - **Segue aberto:**
    - a C1, até o passo 2 (FIDO);
    - o lançador, a cópia fixada e o shim graváveis pelo uid 1000, até o roteiro;
    - a prova do `promover` ainda roda fora do sandbox (saiu para o nó `a-prova-do-promover-roda-isolada`: o bwrap não se aninha) (fechado depois pela T90);
    - `--new-session` tira o terminal de controle (o redimensionamento da TUI pode não chegar; o roteiro confere).
- **T88.** **A saída do Zeno é legível** (D40: "muito ruim de ler no terminal"; contexto ilegível vira carimbo, D36):
  - **`core/tela.mjs`:** quebra com recuo, corte por palavra, rótulos numa coluna, tabela e cor. Largura (de 60 a 100) e
    cor chegam por `ctx`; a cor só aparece em TTY, sem `NO_COLOR`, sem `--json`, e nada se diz só pela cor.
  - **`core/vista.mjs`:** o gate como a pessoa o lê.
    - O tipo sai do diff do `ref`; uma guarda `/*G:*/` nova ou um arquivo de segurança fazem dele "segurança".
    - O nível vem do cartão.
    - Mais o MUDOU, o sha e o cartão por campo.
    - A mesma vista vai para a tela e para o `pendentes --json`.
  - **Caixa:** abre com o resumo, e só o que pede olho abre sozinho (guarda `caixa-abre-o-que-importa`). `v N` e
    `--detalhe` abrem o resto. "todos" e "1,3" aprovam como antes.
  - **`gate --aprovar`:** o cartão vem primeiro, e as seções só com `--completo`.
  - **Outros verbos:** `status` em colunas (o título sai quando não cabe, porque o id já é o título em slug);
    `pendentes`, `caixa` e `promover` cortam ou quebram na largura.
  - **Lint do cartão:** 160 caracteres por campo, 100 por item do conferir, e o risco começa pelo nível. Vale só para
    os gates que abrem depois.
  - **Snapshot** a 80 e a 100 colunas no probe `caixa-legivel`; guia em [tela](tela.md).
  - **Desvio da Especificação:** a `caixa --aprovar --json` segue aprovando, porque a CLI e os testes já a chamam
    assim. A leitura para outra porta é o `pendentes --json`, que agora leva a vista inteira.
- **T87.** **Nó em revisão não fica aprovável na caixa**:
  - (1) `zeno revisar <id> --motivo` (agente ou pessoa) tira da caixa o gate aberto; evento `gate.retirado`. Apertar é
    livre: só adia, nunca aprova. O próximo `avancar` abre o gate de novo, com o texto e o cartão atuais.
  - (2) O `gate.aberto` grava o `artefato_sha256` da seção. A caixa marca **MUDOU** o gate cujo texto mudou depois de
    aberto e o tira do "todos" (só por número).
  - (3) Seção aprovada que mudou: o `status` e o `pendentes` dizem para rodar o `avancar`. O `validar` a trata como
    aviso com o gate daquela fase reaberto, e como erro sem ele.
  - Guardas `gate-retirado`, `caixa-mudou` e `aprovado-mudou-aviso` (probe `caixa-revisao`).
  - Porque a Especificação da T82 foi aprovada por engano: o Filipe respondeu "todos" a 12 gates, e o aviso "em revisão,
    não aprove" estava no corpo, que a caixa não mostra. Depois, o gate só reabriu no `avancar`, e a seção reescrita
    travou todo commit do `zeno/` no pre-commit até a reaprovação (2026-11-03). O aviso precisa estar no sistema, não
    numa mensagem (D36). Sinal de carimbo para o placar da `avaliacao/`: 12 gates numa resposta só.
- **T64.** O `node --test` do pre-commit roda só `test/*.test.mjs` e `test/probes/*.test.mjs` (≈1 s; T51 vale); o censo de mutação (`node test/censo.mjs`, ≈1 min) roda à mão e na `avaliacao/`, não no commit.

## Achados da crítica não adotados como pedidos
- **C4 (hooks classificando cada chamada de ferramenta no ledger):** adotado só no fim da sessão (T39), não por chamada — porque escrever no ledger a cada ferramenta engorda o arquivo e o custo; o transcript já tem o detalhe.
- **C20 (Obsidian):** `.agents/` fica (é o nome canônico da D12); a visão no Obsidian vai para o Inc. 3 — porque renomear quebraria a convenção canônica da D12.
- **T89 (Verificação da T83, sem rodada de LLM).** O `zeno contexto --bloco` sai no formato documentado do `SessionStart`: `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<bloco>"}}`. Esse formato não depende de o stdout cru virar contexto. Um teste roda de verdade o comando que o `sync` grava no `settings.local.json` de um alvo adotado sintético e confere três coisas: o formato, o fragmento do módulo inteiro byte a byte, e menos de 10.000 caracteres. A prova numa sessão real fica para a Observação da T83: a 1ª sessão do Filipe no 1º alvo de cliente depois do `sync`.
- **T90.** **A prova do `promover` roda isolada** (nó `a-prova-do-promover-roda-isolada`, opção (a) aprovada pelo Filipe; fecha a rota da C1 que a T82 deixou de fora). Os testes e o censo são código do agente, e o `promover` os rodava no terminal do Filipe, com a casa e a passphrase dele ao alcance. Agora o `promover` monta um bwrap (`core/prova.mjs`):
  - sem rede, pid/ipc/uts próprios, `--clearenv`, `--cap-drop ALL` e o mesmo seccomp do `zeno sessao` (fd 3);
  - `/usr` e `/etc` só leitura; `/tmp`, `/run` e a casa em tmpfs (a casa de verdade e a chave não existem lá dentro);
  - o repositório inteiro só leitura (a suíte lê `../` e `spec/`) e, num worktree, o git comum também.

  **Nada roda fora.** A 1ª versão deixava fora a sonda que cria um bwrap (`sessao-fronteira`), marcada por um campo no `guardas.json`. A revisão tirou isso por dois motivos. O campo era um dado que o agente edita e que mandaria qualquer teste para fora. E o passo de fora rodava também o `test/ajuda.mjs` e o `core/` que a sonda importa. O bwrap aninha quando o de fora não leva `--disable-userns`, então o da prova não leva: a suíte inteira e o censo inteiro rodam dentro, num passo cada, sem lista. O preço é que o código da prova pode criar user namespaces, o que é mais superfície de kernel, sem a casa, sem a rede e com o repositório só leitura. O `zeno sessao` dos agentes segue com `--disable-userns`.

  Aninhado, o `sessao-seccomp` sobrevivia à mutação, porque o filtro da prova já negava o vsock e o keyctl. A sonda agora também confere que a sessão põe o **próprio** filtro: o `Seccomp_filters` de `/proc/self/status` lá dentro é um a mais que o da sonda. O `zeno.promovido` leva `prova: "bwrap"`. Sem bwrap, a prova cai com 127 e o `promover` diz para instalar o bubblewrap; não há como pular. Guarda nova: `prova-isolada` (camada 0). A sonda da fronteira ganhou um teste real: o plano da prova, num bwrap de verdade, não vê a casa do Filipe nem a do alvo, não alcança o 127.0.0.1 do host, e o repositório dá `EROFS`. Medido: dentro, os 111 testes levam 3,6 s e o censo 47/47 leva 42 s; fora, 4 s e 47 s. Sem custo medível.
- **T91 (via expressa de código).** **`zeno ajuda --json` estruturado**, a pedido da sessão de docs. O `dados` traz três coisas:
  - `versao`;
  - `verbos[]`, com `verbo`, `uso`, `faz`, `pessoa` (true/false), `pessoa_se` (só no `ajustar`: quando afrouxa) e `muda` (grava no ledger ou nos arquivos do alvo). A `caixa --aprovar` é uma linha à parte da `caixa`;
  - `codigos[]`, com `codigo`, `nome` e `o_que`.

  O catálogo mora em `core/run.mjs`, ao lado do despacho. Um teste confere três coisas: todo verbo do despacho está no catálogo e no texto da ajuda, os de pessoa são exatamente os marcados `(pessoa)` no texto, e dois deles recusam agente com 3. O texto da ajuda ganhou a linha do `guarda` e do `ajuda --json`. O `spec/cli.md` não muda nesta volta, porque a via expressa não o toca. A linha do `ajuda --json` entra lá na próxima volta de docs.
- **T92.** O `guarda` no `ajuda --json` ganha `quem: "hook"` e segue `pessoa: false`. O conjunto PESSOA do `shell.mjs` sai
  exportado, e um teste prende os dois: o shell nega ao agente exatamente os verbos que o catálogo marca como de pessoa ou
  só do hook. Porque o catálogo dizia `pessoa: false` e o shell negava o `guarda` ao agente, e quem lia o catálogo
  concluía que podia chamá-lo (divergência 6 da sessão de docs). Não afrouxa a camada 2: um `guarda` forjado só grava
  recusa, contaminação e gasto, e a negação no shell fica.
- **T93.** `zeno gate --teto dim=+N` (de pessoa, assinado, sem id) libera o teto diário do alvo só no dia UTC em que foi
  assinado. Grava `orcamento.alterado` com `no: null`, `dia` e `acrescimo`. A projeção soma o acréscimo ao teto daquele
  dia, e uma liberação sem assinatura válida não vale (guarda `teto-assinado`). O `usd: 0` da T37 fica. Porque, com
  `usd: 0`, o 1º gasto em dólar travava o `novo` e o `avancar` no alvo inteiro até a virada UTC, e o OK de custo da C13
  não tinha porta: o único jeito era a pessoa subir o teto de vez no `sistema.yaml` (divergência 2 da sessão de docs).
  As recusas de teto dizem como liberar, e o estouro conta de novo depois de cada liberação do dia. A mensagem de uso
  do `gate` passou a dizer que `--teto` e `--descontaminar` não levam id (resolve também a divergência 7).
- **T94.** A adoção é um fato gravado: o `install --adocao` escreve `adocao: true` no `sistema.yaml`, e o `adotado(cfg)`
  lê o campo, com o `settings.json` no `local` valendo para os adotados de antes. Num repo adotado sem
  `.claude/settings.json`, o `sync` vai pelo `settings.local.json` (fora do git, com o bloco pelo `SessionStart`, T83) e
  não gera `settings.json` nem `CLAUDE.md` versionados. Porque o `adotado` inferia a adoção do `settings.json` e esse repo
  caía no ramo do alvo novo: um `settings.json` commitado, com hooks fail-closed, deixava quem clona sem o `zeno` no
  PATH com tudo negado, e os protegidos viravam a lista inteira, contra a T74 (divergência 4 da sessão de docs).
- **T95.** A cópia que guarda pode ser do root. Com `/opt/zeno` do root (bloco C do roteiro da T82), o `promover`
  instala por `sudo` do `bin/zeno-instalar-root` (opção a: a senha do sudo a cada `promover`). O instalador é `sh`, sem
  git e sem node. A raiz dele é a constante `RAIZ=/opt/zeno` (os testes trocam essa linha numa cópia, e quem chama não
  a injeta). Ele confere a `pessoa.pub` (do dono que roda, sem escrita de grupo nem de outros), a assinatura Ed25519 de
  `zeno-instalar-root 1 / commit / sha256` (com `openssl pkeyutl -rawin`) e o sha256 do tar que copiou para dentro da
  raiz. As duas conferências são independentes: cada uma tem sonda de mutação. Os git hooks preferem
  `/opt/zeno/atual/cli.mjs`. O `ctx.root` vem só do `cli.mjs`, e sem ele (testes) o modo não existe. Os testes usam uma
  raiz `mkdtemp` com o dono declarado, sem sudo. Porque, com a cópia na casa, um agente fora do sandbox troca o código
  que o guarda, e o 1º `promover` depois do bloco C manual o desfazia. Desvios da Especificação: o tar sai da cópia
  provada na casa (área de preparo), não de um `git archive`; o rollback usa o instalador que instalou (resolvido antes
  da troca), não o novo.
- **T96.** `zeno chave pub [--pem | --em <arquivo>]` (de pessoa) tira a pública da chave privada decifrada pela
  passphrase. Sem opção, imprime a linha `chave_pub:`. Com `--pem`, imprime o PEM. Com `--em`, grava o PEM num arquivo
  novo (modo 644; não sobrescreve) e imprime a linha. Ela é conferida com a `chave_pub` do `sistema.yaml`, e um aviso
  no stderr diz quando não bate ou falta. Não grava ledger. O bloco C da T95 passa a usá-lo no lugar do `sed` no
  `sistema.yaml`: a pública que vai para o root prova que vem da chave que abre com a sua passphrase. Porque só o
  `chave nova` imprimia a pública, uma vez (divergência 1 da sessão de docs). Desvio da Especificação: ela previa
  `zeno chave pub --pem | sudo tee`, mas o gate de pessoa exige TTY no stdout e o pipe o desliga. Afrouxar esse gate
  para um verbo abriria uma exceção na guarda, então entrou o `--em`, que é a única escrita (um arquivo novo, nunca
  sobrescrito).
- **T97.** O `sync` de um alvo gera `.agents/githooks/pre-commit` e `pre-merge-commit` (gerados, versionados, modo 755,
  no lock e nos protegidos; `gerar.githooks: false` desliga). Ele liga `core.hooksPath` com a marca `zeno.githooks` na
  config local só quando o clone está livre (sem `core.hooksPath` em nenhum escopo e sem hook ativo em `.git/hooks`).
  Num clone com hooks próprios, não toca e avisa como encadear. O `sync --check` acusa `.git/config core.hooksPath` quando
  o clone livre ainda não foi ligado, ou quando o Zeno ligou e o hooksPath saiu. O bit de execução faz parte do gerado. O
  hook julga pela cópia do root, depois pela da casa, depois pelo `zeno` do PATH, e sem nenhum falha fechado. Porque a
  camada 4 só existia no `zeno/`, e um alvo instalado ficava sem gate de commit (divergência 3 da sessão de docs).
  Opção (a) da Especificação. A marca local foi acrescentada para distinguir "o Zeno ligou e saiu", que é acusado, de "o
  repo tem o seu", que não é. O próprio `zeno/` fica com o roteador do monorepo: o `sync` só avisa ali.
- **T98.** Só evento assinado de pessoa tira um nó da pausa do disjuntor: o `orcamento.alterado` assinado (`gate
  --orcamento`) ou o `disjuntor.liberado` (`gate <id> --despausar --motivo`, novo, solta sem subir o teto). Baixar o
  orçamento pelo `ajustar` segue livre, mas não despausa mais. A pausa passa a ser regra da projeção: `fase.avancou`,
  `gate.aberto` e `gate.decidido` num nó pausado não o mudam, e o `validar` acusa `pausado`. Guardas `despausa-assinada` e
  `pausa-fato`. Porque o `ajustar orcamento=<menor>` não pede assinatura (não afrouxa), e a projeção despausava com todo
  `orcamento.alterado`: um agente saía sozinho da pausa (achado da sessão de docs, 2026-11-03). Opção (c) da
  Especificação. O ledger do `zeno/` não tinha nenhum `disjuntor.disparou`, então nada antigo muda de sentido.
- **T99.** MCP só por allowlist. O `sistema.yaml` ganha `mcp:` (os servidores que o agente usa no alvo; ausente =
  nenhum), e um perfil em `agentes:` estende com o próprio `mcp:`. O `sync` põe o `zeno guarda pre-tool` também no
  matcher `mcp__.*`, e a guarda nega todo servidor fora da lista do alvo mais a do perfil do ator (`mcp-fora-da-lista`,
  com o `servidor` na recusa). O `permissions.deny` leva `mcp__<servidor>` para os que escrevem fora da máquina,
  conhecidos em 2026-11-03 (`MCP_ESCRITA`), menos os listados no alvo ou em algum perfil, porque o deny venceria a lista.
  Porque a A1 aceitou os conectores até o agente rodar sem supervisão, e as sessões da noite de 2026-11-02/03 já
  rodaram assim, com Gmail, Drive, Vercel, AWS e monday à mão. Em 2026-11-03, o Filipe pediu escopos cada vez mais
  específicos. Opção (a) com a (b) como cinto. O que sobra: só vale onde o Zeno roda (o `conhecimento/` e a `avaliacao/`
  têm harness próprio). O `mcp:` vive no `sistema.yaml`, que é do Filipe, então liberar um servidor é decisão dele.
- **T100.** A passphrase errada pede de novo, até 3 vezes (`comTentativas` no `core/sessao.mjs`), em todo verbo de pessoa:
  `gate`, `caixa --aprovar`, `promover` e `chave pub`. O que o verbo já decidiu antes de pedir (a escolha da caixa, o
  "promover também?") não se perde. Só a passphrase errada repete: a chave que não confere com a `chave_pub` recusa na
  hora. Porque uma passphrase errada no promover encerrou a caixa inteira, e o Filipe teve de refazer a rodada (D40,
  2026-11-03).
- **T101.** Depois de um "todos" com gate MUDOU, a caixa pergunta por ele antes da passphrase: o número o aprova no mesmo
  lote, `v N` mostra, enter pula. O MUDOU segue fora do "todos" (T87). Porque o MUDOU do nó dos conectores ficou de fora
  em 3 rodadas seguidas, sem a tela dizer como aprová-lo (D40, 2026-11-03).
- **T102.** Sem `--janela`, o `zeno novo` grava a janela de Observação pelo tamanho: P `3d`, M e G `7d`
  (`JANELA_PADRAO` em `core/verbos/escrita.mjs`). A via expressa (`--expressa`, inclusive `--codigo`) e o
  `registrar --retro` seguem em `0d`, porque o contrato deles é fechar de uma vez ([fases](fases.md)). A janela vem do
  `no.criado`, então os nós que já existiam não mudam. O `pendentes` só acusa a Observação vencida depois do prazo. Uma
  tentativa de sair antes do prazo com `--observado` grava `recusa` (regra `janela`), que conta como atrito.
  **Fato de pessoa (Filipe, 2026-11-03):** com `0d`, a Observação vencia na Entrega, e os 28 nós fechados naquele dia
  tiveram de 0,5 h a 13,3 h de Observação, o que não mede nada.
- **T114.** A **rodada da caixa deixa rastro**: `caixa --aprovar` grava `caixa.mostrada` (de alvo) em toda saída depois
  da tela, com `listados`, `mudou`, `abertos`, `vistos`, `resposta`, `escolhidos`, `mudou_pulado` e `leitura_ms`, só ids
  e números. O evento sai **sem assinatura**, com o ator do processo, e não conta como ato humano: assinar pediria a
  passphrase só para olhar a caixa. Forjar uma rodada só faria o placar acusar mais, porque a projeção ignora o evento e
  quem prova a aprovação segue sendo o `gate.decidido` assinado, no mesmo `cmd`. A caixa grava o evento ela mesma no
  vazio, na escolha inválida e na passphrase recusada: a `caixa` não está no `MUDA` do `run`, que por isso não grava o
  buffer de uma recusa dela. O `zeno gate <id> --aprovar` fica de fora (um gate só, que sempre decide). O leitor da
  avaliação (`EVS_V1`) recebe o evento antes da integração. Porque a rodada sem decisão não deixava nada, e o MUDOU
  pulado não se media (buraco B8 do mapa da avaliação; nó `a-rodada-da-caixa-deixa-rastro-no-ledger`, 2026-11-03).
- **T106.** A **deriva da frota depois do promover**. Depois de trocar a cópia (na casa ou no modo root), e já fora da
  trava, o `promover` confere cada alvo do registro (T104) com `sync --check`, rodando o código da cópia **nova** por
  import dinâmico, porque é ela que os hooks e o gate de commit passam a rodar. Ele lista os alvos com deriva, a de
  segurança primeiro, faz uma única pergunta e roda o `sync` só nos alvos com `opera` (pessoal, checkout principal).
  Empresa e cliente ficam na lista, cada um com o comando para rodar à mão, e nunca são sincronizados, nem com
  confirmação (guarda `promover-so-pessoal`). O sync não faz commit: o promover imprime o `git add`/`commit` por pathspec
  de cada alvo sincronizado. O `sync --check` diz o tipo de cada deriva: **segurança** para settings, `.mcp.json`, git
  hooks e `.git/`; **forma** para o resto. Alvo sumido ou worktree ligado é pulado; alvo cujo check não roda vira uma
  linha; registro ausente, vazio ou ilegível vira o resumo. Nada disso derruba a promoção, que já foi feita, e a saída
  segue 0. Limite: a primeira promoção que traz a T106 ainda roda o `promover` da cópia antiga, então a lista só aparece
  da promoção seguinte em diante. Porque cada promover que muda o que o sync gera deixa deriva em todos os alvos, e o gate
  de commit de cada um falha fechado sem dizer onde (nó `depois-de-um-promover-a-deriva-trava-o-c`, 2026-11-03).
- **T104.** O **registro de alvos da máquina** (H9, H21): `alvos.json` (a lista, escrita só pela CLI) e `regras.yaml`
  (pasta → fronteira, da pessoa), em `~/.local/share/zeno/`, fora de qualquer git; no modo root, também as regras da raiz
  do root. O `install` registra o alvo; `zeno alvos` mostra a fronteira efetiva (a mais restrita entre a declarada e as
  regras; sem nada, `cliente`) e o campo `opera`, que a frota lê no lugar da lista à mão e da regra de
  empresa e cliente escrita no laço do scratchpad. O agente pode pôr e tirar alvo da lista, porque isso não afrouxa nada; não edita os dois arquivos
  (guarda `registro-maquina`, mais a guarda de shell). Lista ou regras ilegíveis: a frota não opera nada, e o install
  segue com aviso. A efetiva não muda o comportamento dentro do alvo (a composição em 3 níveis é do médio prazo), e o
  padrão `pessoal` do `config.mjs` e do `install` fica até o Filipe decidir. O install avisa quando não recebe
  `--fronteira` nem casa regra. Porque nada no Zeno sabia que os 27 alvos existiam, e os scripts de frota estavam num
  `/tmp` que some no reinício do WSL (nó `registro-de-alvos-na-maquina-com-regras`, 2026-11-04).
- **T103.** O gasto entra sozinho no ledger (nó `o-gasto-entra-sozinho-no-ledger`). Os verbos que mudam estado de nó
  (`novo`, `avancar`, `registrar`) medem a sessão da `CLAUDE_CODE_SESSION_ID` (`core/gasto.mjs`, chamado pelo
  `core/run.mjs`): leem o transcript e os dos subagentes **antes** de o verbo pegar a trava, e gravam a diferença depois
  dele, com a trava ainda segura e só com o buffer vazio. A base da diferença é o `sessao_total` da última medição da
  sessão neste ledger (ou a soma das partes, no formato antigo). A medição nunca muda o código do verbo; se falhar, sai
  como aviso. O `SessionEnd` fica (com o `|| true`); não entra hook `Stop`, porque o `fim-sessao` limparia a
  contaminação a cada turno e releria o transcript inteiro. A guarda de shell nega mexer na variável (regra `ator`).
  Porque só 2 de 52 sessões gravaram gasto: as sessões vivem dias sem terminar, as abertas fora do `zeno/` não têm o
  hook e os subagentes nunca eram lidos. Custo medido: ler e medir o transcript de 41 MB leva ~240 ms por verbo.
  Opção aprovada pelo Filipe na Especificação (2026-11-04); a declaração obrigatória de gasto ficou fora.
- **T105.** A marca de sandbox, e a correção da T82 (C). Todo evento ganha o campo comum opcional `sandbox`: `fora`
  quando a CLI não acha o marcador `/run/zeno-agente`, `sessao` quando acha. Ele é gravado no `base()` de
  `core/sessao.mjs`, então entra na assinatura dos eventos assinados. O lançador grava no marcador, depois do agente, o
  id do `sessao.aberta`, e o evento de dentro leva `sessao: <esse id>`. O `resolverAtor` segue lendo só a 1ª palavra.
  Uma 2ª palavra sem forma de id é ignorada. O `v` fica 1, e o evento sem o campo é de antes da marca. O nome é
  `sandbox`, não `isolamento`, que já é a checagem de import da camada 4. **Corrige a T82 (C):** "o de fora não cria (o
  `/run` é do root)" não vale. O `bwrap` não é setuid, e o kernel deixa user namespace sem privilégio. Assim, um
  processo de fora, do mesmo uid, monta o marcador num bwrap próprio, e a CLI o acha (dedução por leitura, sem executar
  o ataque). Sem marcador, o ato foi de fora com certeza. Com marcador, é declaração, e só um uid próprio do agente faz
  dela uma prova. A conta (atos de agente por marca, assinaturas em nó com ato de agente `fora`, marcas sem sessão
  conhecida) é da `avaliacao/`, e o `validar` do alvo não julga a marca. Porque o passo 2 da D9 (sandbox obrigatório
  na empresa e na faixa nunca) precisa do número, e o ledger não distinguia o ato isolado do solto. É a opção (A) da
  Especificação: o campo com o id da sessão. A opção (B), só o campo, não liga o ato à sessão. A opção (C), segredo e
  HMAC, não prova nada a mais, porque a pasta da sessão é do mesmo uid. Vale depois do `promover`.
- **T107.** Ferramentas de terminal: ensinar antes de integrar (nó `verificar-e-ensinar-as-ferramentas-de-te`; degraus
  1 e 2 da escada da D1 da grelha de domínio). Cada ferramenta da tabela de `core/ferramentas.mjs` (git, gh, glab,
  docker/podman, testes) tem em `modulos/nucleo/ferramentas/<skill>/` uma `SKILL.md` e um `cartao.md` de até 5 linhas.
  Elas ficam fora do mapa `skills:` do módulo, para o `install` não copiá-las a todo alvo. O `contexto` põe na camada
  `skills` da Execução, da Verificação e da Entrega um bloco só com os cartões e o caminho das skills: uma das 3 vagas
  por etapa, medida no `contexto.montado`. O verbo de leitura `zeno ferramentas` confere presença no PATH (sem shell) e
  login só pelo código de saída de uma tabela fixa de comandos de status, rodada pelo `ctx.sondar` do `cli.mjs` com a
  saída descartada (guarda `ferramentas-sem-segredo`). Docker e git respondem "não dá para saber"/"não se aplica",
  porque conferir exigiria ler a credencial. Dentro do `zeno sessao` não confere login (as pastas de config estão
  escondidas) e avisa. O padrão é a detecção, para não pedir ato humano; a chave `ferramentas:` do `sistema.yaml`
  sobrescreve. **Escolha do Filipe (2026-11-03):** nenhum aviso de licença do Docker Desktop no comando; só uma linha
  informativa na skill. Achado na Execução: o alvo pode ser uma subpasta do repo (o `zeno/` no monorepo), então o git
  é detectado por `git rev-parse`, não pela pasta `.git`. Fora: registrar a evidência, casar comando com faixa e
  adaptador (degraus 3 a 5).
- **T109.** A regra do código interpretado (`node -e`, `python -c`, here-doc para intérprete) fica igual: nega quando o
  código tem API de escrita e cita um protegido em qualquer lugar, mesmo dentro de um texto. É um falso positivo aceito
  ([seguranca](seguranca.md)), preso por `FP_ACEITO` em `test/fp-shell.mjs`. Muda só o porquê de `arquivo-protegido`
  (`POR_QUE` em `core/verbos/guarda.mjs`), que passa a dizer essa causa e manda editar texto pelo Edit ou Write. O Edit
  ou Write num protegido segue negado pelo hook de arquivo. Porque em 2026-11-03 dois comandos que só escreviam texto
  citando o `sistema.yaml` e a cópia fixada foram negados com "este arquivo é do sistema", e a raia parou para escalar.
  Separar o caminho que a API recebe do texto escrito foi pesado e recusado: o caminho chega por variável, e separar por
  literal deixaria passar `p='.agents/ledger.jsonl'; open(p,'a')`. A recusa no ledger e o placar não mudam.
- **T110.** O `gate.retirado` grava `motivo_sha256`, como o `gate.decidido` e o `no.cancelado`, e não mais o texto do
  `zeno revisar --motivo`. O texto vai para o fio do nó como `aviso` de quem retirou ao revisor, pelo mesmo `msgFio` da
  decisão de gate. A projeção guarda o `motivo_sha256` em `em_revisao`. Porque o contrato do ledger proíbe texto livre
  de conteúdo ([ledger](ledger.md)), e o motivo em claro tinha entrado com o verbo (T87), na tabela e no código. Os 2
  eventos antigos ficam como estão (append-only) e seguem projetando. Uma `causa` em enum ficou de fora: ninguém a lê, e
  ela entra quando um leitor pedir.
- **T111.** `githooks_encadeado: <pasta>` no `sistema.yaml` declara os hooks do repo que já rodam o gate de commit. O
  `sync` confere que o `pre-commit` e o `pre-merge-commit` da pasta existem e chamam `validar --staged` e `sync --check`
  (`encadeadoDe` em `core/verbos/instalar.mjs`). Coberto: o `sync` diz "coberto por …" e o `sync --check` cala; se não, o
  aviso nomeia o que falta. Troca o fim da T97 ("o `sync` só avisa ali"), porque no `zeno/` o roteador do monorepo já
  roda o gate, e o aviso saía em todo commit. Se fosse seguido, tudo rodaria duas vezes. Foram recusadas a marca no hook,
  que o agente escreveria (o `.githooks/` não é protegido), e o `gerar: { githooks: false }`, que moveria os gerados para
  o `_lixo/` sem conferir nada. O resíduo: a conferência lê o texto e não prova que o roteador chama o hook.
- **T112.** Antes de escrever o `info/exclude`, o `sync` pergunta ao git se o `settings.local.json` já é ignorado
  (`check-ignore --no-index`, com o ignore global desligado, porque ele é da máquina e não do repo). Se um `.gitignore`
  cobre, não escreve. Num worktree ligado, a saída diz que a linha foi no exclude do checkout principal, com o caminho e
  como tirá-la. O exclude por worktree (`extensions.worktreeConfig`) foi pesado e recusado: grava na config do checkout
  principal, o mesmo repo real. O install grava a `chave_pub` null e dá a dica: `zeno chave pub` quando o arquivo da
  chave existe na casa (só o `existsSync`, sem abrir), e `zeno chave nova` quando não. Gravar a chave pelo install fica
  para um nó próprio, porque é a âncora de todo gate. Porque um teste a seco num worktree mexeu calado no repo real, e
  em cada alvo novo a chave nascia vazia sem dica (2026-11-03).
- **T113.** O hábito no mecanismo (nó `o-agente-abre-o-no-e-o-trabalho-sem-no-v`, H4/H5 da grelha de horizontes de
  2026-11-03). Quatro peças. (1) O bloco do módulo abre com a rotina: o 1º ato num alvo, antes da 1ª edição, é abrir o
  nó (P pela via expressa). (2) A deixa no `Stop`: `zeno guarda parar || true` (`core/habito.mjs`) vê no transcript
  edição de arquivo do alvo fora de `.agents/`, ou `git commit`, sem nó tocado, e responde `decision: block` com o
  `registrar --retro` pronto e uma `recusa` `sem-no`. Ela não usa o `fim-sessao` (que mede e limpa a contaminação, T103):
  só lê, uma vez por parada (`stop_hook_active`), e nunca impede a parada. (3) A deixa no commit, dentro do
  `validar --staged`: o githook gerado não muda e vale para qualquer ferramenta. O agente reconhecido para; a pessoa e o
  ator `ia:desconhecido` sem CLI de agente acima só levam o aviso, porque "a pessoa nunca é barrada" vence quando o
  zeno não sabe quem é (um cliente git gráfico não tem TTY). Nó em Execução silencia a checagem (risco aceito: a medida
  é o retro, não a trava). (4) A fiação versionada: no `pessoal` adotado sem `settings.json` próprio, o `sync` gera o
  `.claude/settings.json` e manda o local gerado ao `_lixo/`; `fiacao: local` no `sistema.yaml` é a saída, e
  `empresa`/`cliente` não mudam. Isto reverte a T94 só no pessoal: a T94 protegia o clone sem o zeno, e o preço agora
  aceito é ele ficar negado. Nada cria nó sozinho (H4 recusou o hook que abre nó por sessão). Vale depois do
  `promover`; um `sync` antes dele grava um `Stop` que a cópia antiga não entende e, com `|| true`, só não dispara.
  Achado na Execução: o fixture da frota commitava um alvo recém-instalado pelo gate do alvo, com o zeno da casa de
  quem roda; com a deixa, um agente rodando os testes parava esse commit. O commit do fixture agora pula o gate.
- **T115.** Subir o tamanho sobe a faixa até o piso (nó `subir-o-tamanho-do-no-nao-sobe-a-faixa-o`, opção (a) da
  Especificação). O piso por tamanho só era conferido no `novo`; o `ajustar tamanho=` gravava só o campo, e um nó criado
  P autônomo e ajustado para M passava todos os gates por check (caso real: um retro que fechou M sem gate humano).
  Agora o `ajustar` que sobe o tamanho e deixa a faixa declarada abaixo do piso do tamanho novo grava, no mesmo comando,
  o `ajuste` de `faixa` até o piso e o `faixa.alterada`, os dois com `motivo: tamanho` (guarda `piso-tamanho`). É um
  apertar: livre para o agente, e nunca baixa a faixa (baixar o tamanho segue afrouxar e não mexe nela). A faixa que a
  pessoa declara no mesmo ajuste vale, como o "a pessoa pode declarar abaixo do piso, assinado" do controle.md; a do
  agente sobe ao piso. A regra fica no verbo, e não na `faixaEfetiva` (a opção (b)): no replay, os nós antigos não
  mudam, e o `validar` não acusa histórico num ledger append-only.
- **T116.** O `githooks_encadeado` (T111) aceita também o hook que chama o gerado de mesmo nome (`sh`, `bash` ou `exec`
  com `.agents/githooks/<nome>`, com ou sem prefixo de pasta) — porque a `avaliacao/` encadeia com
  `exec sh .agents/githooks/pre-commit`, que já roda `validar --staged` e `sync --check`, e o aviso do `sync` saía falso.
  Só conta linha de comando: o caminho num comentário não cobre (`chamaOGerado` em `core/verbos/instalar.mjs`). Não é
  guarda nova: a regra só cala um aviso e não muda o que o agente pode fazer.
- **T117.** A origem `sensor:<nome>` e a trava dos nós de sensor (nó `sensores-com-faixa-normal-e-a-linha-da-n`, parte do
  `zeno/`). Quem abre o nó do alarme é o agente da revisão semanal, pela CLI (`zeno novo … --origem sensor:<nome>`); o
  julgamento (o cálculo, o teto e a faixa) é da `avaliacao/`, e o `zeno/` não lê o que ela exporta. O core só ganha a
  classe de origem e a trava, porque o controle impõe: no máximo 5 nós de sensor por semana ISO (UTC, a semana começa na
  segunda) no alvo, e um por sensor por semana; o que passa sai 1 (regra `sensor`) e nada é gravado (guarda
  `trava-sensor`). O nome do sensor (`a-z`, `0-9`, `-`, até 32) vai no `no.criado` como `dados.sensor`, além da classe
  em `origem_classes`: é um rótulo de vocabulário fechado, não texto livre, e é dele que a trava conta, só no próprio
  ledger. Uma origem `sensor:` por nó. A classe é confiável (não sobe a faixa). Hoje, com 3 sensores e um nó por
  sensor por semana, o teto de 5 não morde; ele vale para os sensores que vierem.
- **T118.** O portão de publicação é um modo do `promover` (`--publicar <clone>`), não um verbo novo (nó
  `portao-de-publicacao-e-a-v0-1-publica-do`). O verbo já é de pessoa no despacho e no shell, e já traz a árvore
  commitada, a passphrase antes da prova e a prova isolada. Publicar é a ação `entrega.publicar`, da faixa `nunca`. O
  portão para antes do push, que a pessoa faz no terminal dela. Os 6 checks (`core/portao.mjs`, guardas `portao-*`)
  falham fechado. A lista de nomes de empresa e cliente mora em `~/.config/zeno/portao-nomes.txt`, fora de qualquer git,
  porque nada da empresa é escrito no monorepo; a saída diz o número do nome na lista, não o nome. O check `casa` pega
  também a forma com `-` da casa (a das pastas de projeto do Claude Code). O snapshot deixa de fora também o
  `.githooks/` (os hooks gerados deste monorepo, dado de alvo), e os links de todo `.md` são reescritos, não só os das
  páginas de `docs/`. O que estava no clone vai para o `_lixo/` da casa e continua no histórico do clone. O histórico
  confere com o ledger, não com o remoto (sem rede): a pessoa roda `git fetch` antes. O root vem antes da publicação
  porque a cópia que guarda, e que vai assinar o evento, não pode ser a que o agente edita. Linux e WSL2 são
  suportados; o macOS não, porque o `zeno sessao` precisa do bwrap.
  O 1º CHANGELOG sai só com o resumo da versão (nó `o-changelog-da-1-publicacao-sai-sem-os-a`, opção (b) do Filipe): os assuntos de ~100 commits do dia a dia poderiam levar um nome fora da lista; da 2ª publicação em diante, entram os assuntos desde a anterior.
  O snapshot sai do commit (`git archive` do `zeno/` e do `docs/`), não da pasta no disco (nó `o-portao-monta-o-snapshot-do-commit-nao`, guarda `portao-commit`): o `git status` que barra a árvore suja não mostra o arquivo ignorado pelo git, que antes entraria no público.
- **T119.** **A doc publicada no layout do repo público** (nó `a-doc-publicada-funciona-no-layout-do-re`, v0.1.1). A
  doc da raiz `docs/` segue escrita para o monorepo, onde o doc-exec dela a prova; quem adapta é o portão, na montagem.
  Uma tabela fixa e pequena (`LAYOUT` em `core/portao.mjs`) troca em `docs/`, `bin/`, `README.md` e `AGENTS.md`, o mesmo
  escopo do check 7 (`ESCOPO`; na v0.1.1 ela rodava em todo `.md` e entortava os trechos da spec que a descrevem; a
  spec e os testes saem como estão desde a v0.1.2, nó `a-troca-de-layout-do-portao-roda-so-onde`): `$CE/zeno/` por `$CE/`,
  `<caminho do clone>/zeno` e `<repo>/zeno` sem o `zeno`, o shim `` `zeno/bin/zeno` `` por `` `bin/zeno` `` e "clone do
  `context-engineering`" por "clone do `zeno`". O bloco de código que roda algo de `$CE/avaliacao/` sai, com o bloco de
  saída logo depois, e vira uma frase: o placar não vem nesta publicação. Cada página de `docs/` ganha, depois do
  título, uma nota fixa: ela vem do monorepo de origem, `zeno/` lá é a raiz aqui, e `avaliacao/` e `conhecimento/` não
  vêm. O `AGENTS.md` publicado perde a linha do vault e troca a do Stack por uma sem o `../conhecimento/`. O check 7,
  `layout` (guarda `portao-layout`), reprova o que sobrar em `docs/`, `bin/`, `README.md` e `AGENTS.md`: frase nova fora
  da tabela trava a publicação até a tabela ganhar a linha, de propósito. A versão da CLI sobe para 0.1.1; a do módulo
  `nucleo` fica em 0.1.0, porque o conteúdo dele não mudou, e subir a versão mudaria o cabeçalho gerado em todos os alvos
  da frota sem mudança de regra. Fora: reescrever a doc de conceitos e trazer o placar para o repo público.
