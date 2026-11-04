---
tipo: referencia
publico:
  - usuario
  - agente
  - contribuidor
responde: "Onde está a fonte da verdade de cada coisa: verbos, códigos de saída, formatos, guardas, decisões e métricas?"
fonte:
  - zeno/guardas.json
  - zeno/spec/README.md
  - avaliacao/AGENTS.md
  - zeno/spec/cli.md
  - zeno/spec/instalacao.md
verificado-em: 4372d91
---

# A referência

**Resumo.** Esta página aponta, e não copia. Cada linha leva à fonte da verdade de um assunto. A única lista desta
página, a das guardas, é **gerada** do `zeno/guardas.json` e conferida pelo portão `doc-gerado`.

## Onde está cada coisa

| Assunto | Fonte da verdade | Também |
|---|---|---|
| verbos da CLI, opções, o que cada verbo escreve | [`zeno/spec/cli.md`](../spec/cli.md#verbos) | `zeno ajuda` |
| códigos de saída (0 a 9) e o envelope `--json` | [`zeno/spec/cli.md`](../spec/cli.md#convenções-comuns) | a última linha do `zeno ajuda` |
| o nó: frontmatter, layout em disco, arestas, validação | [`zeno/spec/no.md`](../spec/no.md) | `zeno validar` |
| as 7 fases, os cartões e a via expressa | [`zeno/spec/fases.md`](../spec/fases.md) | `zeno contexto <id>` |
| faixas, gates, procedência e orçamento | [`zeno/spec/controle.md`](../spec/controle.md) | — |
| o ledger (o contrato v1 que a `avaliacao/` lê) | [`zeno/spec/ledger.md`](../spec/ledger.md) | — |
| os 7 tipos de mensagem e o lint | [`zeno/spec/mensagens.md`](../spec/mensagens.md) | — |
| a instalação, o modo adoção, o `sync` e os githooks de um alvo (T97), a fiação versionada (T113) e o `githooks_encadeado` (T111) | [`zeno/spec/instalacao.md`](../spec/instalacao.md) | — |
| o registro de alvos da máquina e as regras por pasta (T104) | [`zeno/spec/instalacao.md`](../spec/instalacao.md#registro-de-alvos-da-máquina-t104) | `zeno alvos`, Registrar os alvos |
| as ferramentas de terminal do SDLC (T107) | [`zeno/spec/cli.md`](../spec/cli.md#zeno-ferramentas---json-t107) | `zeno ferramentas`, Ver as ferramentas |
| o grafo de trabalho como notas do Obsidian | [`zeno/spec/cli.md`](../spec/cli.md), a seção do `zeno vista --obsidian` | Ver o grafo no Obsidian |
| o domínio: fluxo, etapa, garantia, receita, contratos e confiança (quase tudo plano) | [`zeno/spec/dominio.md`](../spec/dominio.md) | [os termos](glossario.md#termos-do-domínio) |
| as 4 camadas, a allowlist de MCP (T99), a cópia do root (T95), os resíduos e o registro de guardas | [`zeno/spec/seguranca.md`](../spec/seguranca.md) | `node zeno/test/censo.mjs` |
| o portão de publicação, `zeno promover --publicar` e os 6 checks (T118) | [`zeno/spec/cli.md`](../spec/cli.md), a seção do `zeno promover` | [`zeno/SECURITY.md`](../SECURITY.md), [`zeno/CONTRIBUTING.md`](../CONTRIBUTING.md) |
| núcleo × porta do Claude Code | [`zeno/spec/portas.md`](../spec/portas.md) | — |
| decisões técnicas (T…) | [`zeno/spec/decisoes-tecnicas.md`](../spec/decisoes-tecnicas.md) | — |
| decisões de desenho (D…) | o vault do Filipe, `1 Projects/Zeno/decisoes.md` (fora do repo) | [`zeno/spec/rastreabilidade.md`](../spec/rastreabilidade.md) |
| as métricas do placar | `avaliacao/fichas/` | `avaliacao/placar.md` |
| os sensores da semana, a linha da noite e a trava dos nós de sensor (T117) | `avaliacao/placar/sensores.mjs`, [`zeno/spec/no.md`](../spec/no.md) | `avaliacao/sensores.md`, Ler os sensores |
| os riscos e os "para depois" | `avaliacao/mapa-pontos-de-atencao.md` | — |
| os portões desta doc | `docs/portoes.json` | `node docs/test/censo.mjs` |
| o hub: tipos de nó, schema, regras do agente | `conhecimento/schema/README.md` e `conhecimento/CLAUDE.md` | Consultar o hub |

Os verbos e os códigos de saída estão no `zeno ajuda`, e em JSON no `zeno ajuda --json` (T91: `dados.verbos`, com o
uso, se é de pessoa, se muda estado e `quem: "hook"` no verbo que só o hook chama, T92; e `dados.codigos`). A lista ainda não é gerada aqui. Gerar daqui faria o checador
da doc rodar a CLI do clone, que um agente pode editar, inclusive no hook de commit: essa escolha é do Filipe (nó).

## As guardas do Zeno

Cada guarda fecha um risco (`C1` a `C7`) ou atende uma decisão (um D ou um T), numa camada. Uma guarda `ativa` tem uma
sonda e uma mutação que o censo roda.
O que cada risco significa está em [seguranca](../spec/seguranca.md#registro-de-guardas-d33).

<!-- gerado:inicio fonte=zeno/guardas.json gerador=guardas -->
| id | camada | fecha | estado | o que garante |
|---|---|---|---|---|
| `trava-sensor` | 3 | T117 | ativa | o nó de sensor (origem sensor:<nome>) passa só uma vez por sensor por semana ISO e no máximo 5 por semana no alvo; o que passa sai 1 e nada é gravado |
| `portao-commit` | 3 | T118 | ativa | o snapshot do portão sai do commit (git archive), não da pasta no disco: arquivo ignorado pelo git ou não rastreado fica fora, e o snapshot é exatamente o commit menos o que fica fora |
| `portao-nomes` | 3 | T118 | ativa | o check 1 do portão de publicação reprova, sem escrever no clone, a lista de nomes da máquina ausente ou vazia e um nome da lista no snapshot (texto ou caminho, sem acento e sem caixa) |
| `portao-casa` | 3 | T118 | ativa | o check 2 do portão reprova caminho de casa real no snapshot: a casa da máquina (também com '-') e /home/<nome> fora dos de exemplo |
| `portao-gitleaks` | 3 | T118 | ativa | o check 3 do portão reprova sem o gitleaks no PATH e quando o gitleaks detect --no-git acha segredo ou falha no snapshot |
| `portao-lista` | 3 | T118 | ativa | o check 4 do portão reprova arquivo do snapshot fora da lista do que entra (ou em pasta que fica fora, como .agents) e arquivo da lista que falta (LICENSE, NOTICE, CONTRIBUTING, SECURITY, CHANGELOG, docs) |
| `portao-historico` | 3 | T118 | ativa | o check 5 do portão reprova o clone público com commit que não veio do portão (fora dos publicacao.preparada do ledger) e o clone sujo |
| `portao-root` | 3 | T118 | ativa | o check 6 do portão reprova enquanto a cópia que guarda não é a do root (/opt/zeno do root com a cópia atual) |
| `piso-tamanho` | 3 | T115 | ativa | o ajustar que sobe o tamanho e deixa a faixa declarada abaixo do piso do tamanho novo sobe a faixa ao piso no mesmo comando (ajuste e faixa.alterada com motivo tamanho) |
| `stop-sem-no` | 2 | T113 | ativa | no Stop, o transcript com edição de arquivo do alvo fora de .agents/ (ou git commit) e sem nó tocado faz o guarda parar pedir o registrar --retro pronto e gravar a recusa sem-no |
| `stop-formato` | 0 | T113 | ativa | o guarda parar lê a entrada do Stop do Claude Code (stop_hook_active, transcript_path, cwd) e responde só decision/reason; com stop_hook_active nunca bloqueia (sem loop) |
| `commit-sem-no` | 4 | T113 | ativa | o validar --staged do githook para o commit de agente com arquivo fora de .agents/, sem evento novo de nó e sem nó em Execução; a pessoa só leva o aviso |
| `fiacao-versionada` | 1 | T113 | ativa | num alvo pessoal adotado sem settings.json próprio e sem fiacao: local, o sync gera a fiação do Zeno no .claude/settings.json versionado |
| `ferramentas-sem-segredo` | 0 | T107 | ativa | o zeno ferramentas confere login e serviço só pelo código de saída da tabela fixa; a saída do comando (um token, por exemplo) nunca chega à saída do zeno, e nada é gravado |
| `deny-camada1` | 1 | C3 | ativa | cada regra de deny gerada casa com um caminho real; regra órfã recusa o sync |
| `hook-fail-closed` | 2 | C3 | ativa | os hooks que guardam negam quando o zeno falha ou falta (\|\| exit 2) |
| `guarda-shell` | 2 | C1 | ativa | escrita por shell em arquivo de controle, verbo de pessoa (gate, chave, caixa --aprovar, guarda, promover), ZENO_ATOR/CLAUDECODE e reescrita de histórico são negados |
| `assinatura` | 3 | C1 | ativa | decisão humana (gate, orçamento, afrouxar, cancelar, descontaminar) sem assinatura Ed25519 válida não muda o estado |
| `aprovado-mudou` | 3 | C6 | ativa | seção aprovada alterada depois do gate: o próximo avancar reabre o gate |
| `cartao-gate` | 3 | D36 (T75) | ativa | gate humano só abre com o cartão de decisão completo (6 campos, nenhum vazio ou genérico, 1 a 3 coisas a conferir) |
| `expressa-codigo` | 3 | D36 (T76) | ativa | P de via expressa de código (--codigo) só fecha se o commit da ref fica em cli.mjs, core/, bin/, modulos/ ou test/*.test.mjs; spec/, .agents/ e a prova das guardas (guardas.json, test/probes/, test/censo.mjs, test/ajuda.mjs, test/fp-shell.mjs) reprovam a Entrega |
| `piso-faixa` | 3 | C2 | ativa | agente não declara faixa abaixo do piso do tamanho; P com commit acima de limites.P_linhas é reprovado |
| `afrouxar` | 3 | C2 | ativa | afrouxar pelo efeito (faixa, ação, check, dependência, origem, executor) pede pessoa, motivo e assinatura |
| `faixa-nunca` | 3 | C2 | ativa | nó de faixa efetiva nunca não tem agente como executor nem sai da Execução por agente |
| `ator-falso` | 3 | C1 | ativa | dentro do Claude Code, ZENO_ATOR de pessoa é recusado |
| `procedencia` | 3 | C5 | ativa | origem não confiável sobe a faixa efetiva para aprovação |
| `contaminacao` | 3 | C5 | ativa | enquanto o alvo tem a marca (WebFetch/WebSearch/MCP numa sessão ainda aberta), todo nó novo no alvo nasce com origem sessao:contaminada |
| `disjuntor` | 3 | C7 | ativa | consumo acima do teto (tokens/usd >, tentativas ≥) pausa o nó; teto diário bloqueia o alvo |
| `lint-msg` | 3 | D23 | ativa | mensagem sem campo obrigatório não entra no fio |
| `append-only` | 4 | T6 | ativa | ledger ou fio commitado editado, truncado ou removido no índice |
| `projecao` | 4 | T1 | ativa | campo de controle do frontmatter diferente do que o ledger projeta |
| `deriva` | 4 | D12 | ativa | gerado diferente do canônico (sync --check) |
| `isolamento` | 4 | D3 | ativa | import ou symlink para conhecimento/ ou avaliacao/ |
| `sem-dependencia` | 4 | D28 | ativa | node_modules/ ou dependência em package.json |
| `sem-flag-de-teste` | 4 | T16 | ativa | código do core lê o processo (ambiente, entrada, terminal) ou tem variável de modo teste |
| `transcript-formato` | 0 | T39 | ativa | o leitor do transcript ainda acha message.id + usage no formato atual |
| `gasto-subagentes` | 0 | D19 | ativa | os transcripts dos subagentes (<sessão>/subagents/agent-*.jsonl) entram na medição do gasto da sessão |
| `shell-por-parser` | 2 | T67 (D19) | ativa | a guarda de shell decide por tokenizador: texto entre aspas num argumento e código que só lê passam; os 2 falsos positivos do 1º dia de hooks, literais, passam |
| `shell-ilegivel` | 2 | T67 (C3) | ativa | comando que o tokenizador não entende (aspas, $( ), crase ou here-doc sem fechar; aninhamento fundo) é negado, com o porquê |
| `copia-fixada` | 2 | T68 | ativa | o código que guarda (shim da pessoa, hooks via PATH, validar do pre-commit) roda da cópia fixada promovida por pessoa, não do repositório que o agente edita |
| `chave-antes-da-prova` | 3 | T72 | ativa | o promover confere a chave e a passphrase da pessoa antes de rodar testes e censo: passphrase errada sai com 1 sem ter rodado nada |
| `bloco-pela-porta` | 1 | T83 | ativa | na adoção, o bloco do Zeno não entra no AGENTS.md commitado: chega pelo SessionStart do settings.local.json, junto com as travas; o bloco de adoções antigas sai no sync |
| `sessao-rede` | 0 | T82 | ativa | o zeno sessao abre o agente num namespace de rede próprio: o 127.0.0.1 do host (o do Windows, em mirrored) não é alcançável; a saída é só pelo proxy |
| `sessao-env` | 0 | T82 | ativa | o env da sessão é só a allowlist, e o interop, a tela, o barramento, o canal entre sessões e o ZENO_ATOR nunca entram, nem se o perfil pedir |
| `sessao-repo-so-leitura` | 0 | T82 | ativa | dentro da sessão, o controle do git (.git/config, hooks, info), o .githooks/, o .claude/, o .mcp.json e o .zed/ são só leitura: o repo deixa de ser canal para o que roda fora |
| `sessao-seccomp` | 0 | T82 | ativa | o seccomp da sessão nega AF_VSOCK (ignora o namespace de rede no 6.6), TIOCSTI/TIOCLINUX, o chaveiro do kernel e o io_uring |
| `sessao-proibidos` | 0 | T82 | ativa | o perfil de um agente nunca expõe a casa, a chave do Zeno, ~/.ssh, ~/.aws, ~/.claude, /mnt nem o interop (le, credenciais, escreve e config_dir) |
| `proxy-allowlist` | 0 | T82 | ativa | o proxy da sessão só conecta a host e porta da allowlist do perfil |
| `proxy-privado` | 0 | T82 | ativa | o proxy nega endereço privado ou de loopback mesmo para host permitido (o gateway hermes e o 127.0.0.1 do Windows) |
| `ator-marcador` | 3 | T82 | ativa | dentro do zeno sessao, o ator é o agente do marcador /run/zeno-agente e ZENO_ATOR não o troca; verbo de pessoa é recusado |
| `marca-sandbox` | 3 | T105 (D9, passo 1) | ativa | todo evento leva sandbox: fora (sem marcador) ou sessao (declarado pelo marcador, com o id do sessao.aberta em sessao); a marca entra na assinatura e o ledger sem ela segue válido |
| `ator-pai-agente` | 3 | T82 (achado D39) | ativa | um processo com TTY e o e-mail do git da pessoa não sai como ela se uma CLI de agente conhecida está acima dele na árvore de processos |
| `sem-sessao` | 2 | T82 | ativa | com sessao_obrigatoria, o hook nega toda ferramenta fora da fronteira do zeno sessao (sem marcador, interop ou chave à vista, env fora da allowlist) |
| `caixa-abre-o-que-importa` | 3 | D40 (D36) | ativa | a caixa resume todos os gates numa tabela e expande sozinha os de risco alto, de segurança (tirado do diff), MUDOU ou sem nível; os de risco baixo ficam fechados, e v N abre um |
| `prova-isolada` | 0 | T90 | ativa | o promover roda os testes e o censo inteiros num bwrap sem rede, com a casa em tmpfs e o repositório só leitura; nada roda fora (a sonda que cria bwrap aninha) |
| `instalar-sha256` | 0 | T95 | ativa | o instalador root recusa um tar cujo sha256 não é o assinado (troca no meio do caminho) |
| `instalar-assinatura` | 0 | T95 | ativa | o instalador root recusa cópia assinada por outra chave ou assinatura de outro commit |
| `instalar-pub` | 0 | T95 | ativa | o instalador root recusa sem pessoa.pub, ou com ela de outro dono ou gravável por grupo ou outros |
| `teto-assinado` | 3 | T93 | ativa | a liberação do teto diário do alvo (zeno gate --teto) só vale assinada por uma pessoa; forjada, o alvo segue preso e o validar acusa |
| `mcp-allowlist` | 2 | T99 | ativa | o hook pre-tool (matcher mcp__.*) nega todo servidor MCP fora da lista mcp: do alvo (padrão: nenhum) e do perfil do agente; o deny estático cobre os de escrita conhecidos |
| `despausa-assinada` | 3 | T98 | ativa | só evento assinado de pessoa (gate --orcamento ou gate --despausar) tira o nó da pausa do disjuntor; o agente que baixa o orçamento segue pausado |
| `pausa-fato` | 3 | T98 | ativa | a pausa é regra da projeção: fase.avancou, gate.aberto e gate.decidido num nó pausado não mudam o nó, e o validar acusa |
| `githooks-saida` | 4 | T97 | ativa | o sync --check acusa o clone cujo core.hooksPath saiu de .agents/githooks depois de o Zeno ligá-lo, e o clone livre ainda não ligado |
| `githooks-intacto` | 4 | T97 | ativa | o sync não liga o gate de commit num clone que já tem o seu (core.hooksPath em qualquer escopo, ou hook ativo em .git/hooks): avisa como encadear |
| `gate-retirado` | 3 | T87 | ativa | o gate que o agente retira com zeno revisar sai da caixa (o todos não o aprova) e volta no próximo avancar |
| `caixa-mudou` | 3 | T87 | ativa | gate humano cujo texto mudou depois de aberto fica fora do todos da caixa, marcado MUDOU, e só se aprova por número |
| `aprovado-mudou-aviso` | 4 | T87 | ativa | seção aprovada que mudou é erro no validar enquanto o gate daquela fase não foi reaberto; só com ele reaberto vira aviso |
| `promover-entrega` | 3 | T79 | ativa | o promover recusa, antes da passphrase, uma cópia com código de nó cujo gate de Entrega não foi aprovado (expressa de código à parte); na caixa, a Entrega aprovada na mesma rodada conta |
| `adocao-intacta` | 1 | T74 | ativa | na adoção, o harness do repo fica idêntico byte a byte fora do bloco do Zeno no AGENTS.md, e as regras do Zeno (deny e hooks) vão no .claude/settings.local.json; local manual existente faz o sync recusar sem tocar |
| `settings-portatil` | 1 | T69 | ativa | os gerados (settings.json, gerados.lock) não citam o caminho do checkout: sync --check limpo num clone e num worktree ligado |
| `guarda-arquivo` | 2 | T69 | ativa | hook pre-tool de Edit/Write/MultiEdit/NotebookEdit nega o arquivo protegido e o negar_escrita de fora do alvo, resolvidos contra a raiz do checkout (segue symlink) |
| `registro-maquina` | 2 | T104 (H21) | ativa | o hook pre-tool de Edit/Write/MultiEdit/NotebookEdit nega os arquivos do registro de alvos da máquina (as regras por pasta, da pessoa, e a lista, só da CLI), também por ~, por symlink e na raiz do modo root; o shell já é negado pela guarda de shell (pasta da cópia fixada) |
| `promover-so-pessoal` | 3 | T106 | ativa | depois de trocar a cópia, o promover só roda o sync nos alvos que o registro diz que a frota opera (pessoal, checkout principal); alvo de empresa ou de cliente com deriva fica byte a byte igual, mesmo com a confirmação da pessoa |
| `pessoas-hash` | 3 | T73 (T54, D35) | ativa | em alvo de fronteira empresa/cliente, nenhuma pessoa em claro no disco (ledger, fio, vista do nó, sistema.yaml): h:8hex de sal+id, sal e nomes fora do git; sem sal, nada escreve |
| `gate-juiz` | 3 | Inc. 4 | declarada, adiada | gate do tipo juiz (LLM avalia a saída da fase) |
| `custo-por-ferramenta` | 2 | C4 (parcial) | declarada, adiada | custo medido por chamada de ferramenta (hook PostToolUse em toda ferramenta) |
| `trava-entre-maquinas` | 3 | T44 | declarada, adiada | trava do alvo valendo entre máquinas (hoje é arquivo O_EXCL local; ledger junta por merge=union) |
<!-- gerado:fim -->
