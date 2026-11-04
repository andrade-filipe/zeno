# Rastreabilidade: as decisões do desenho → spec

| D | Decisão (resumo) | Onde a spec atende | Inc. |
|---|---|---|---|
| D1 | o Sistema é pessoal; o SDLC da empresa é só inspiração | nada da empresa na spec; `fronteira` no `sistema.yaml` ([instalacao](instalacao.md)) | 1 |
| D2 | monorepo pessoal; alvos ficam fora | `zeno/` é raiz; o grafo vive no alvo ([no](no.md#layout-em-disco-dentro-de-um-alvo)) | 1 |
| D3 | isolamento: código próprio por raiz; só leitura por formato | motor copiado ([no](no.md#frontmatter)); check de import no pre-commit ([seguranca](seguranca.md#4-pre-commit-e-pre-merge-commit-zenogithooks)); ledger e `guardas.json` como contratos de formato | 1 |
| D4 | ferramenta instalável; grafo em cada alvo | `install`/`sync` ([cli](cli.md), [instalacao](instalacao.md)); refs `<alvo>:<id>` | 1 |
| D5 | 7 fases, qualquer trabalho com agentes | [fases](fases.md) | 1 |
| D6 | nó recursivo; profundidade emerge; contrato de delegação fixo; agentes rasos | `pai` + filhos derivados ([no](no.md)); `pedido` com os 6 campos + `delegacao_padrao` ([mensagens](mensagens.md), [fases](fases.md)). A hierarquia de agentes não é modelada (só `ia:<agente>` como ator) | 1 |
| D7 | Markdown + frontmatter no git, motor copiado; ferramentas do time são adaptadores | [no](no.md). Adaptadores Monday/GitLab → mapa de pontos ("2ª pessoa num grafo") | 1 / depois |
| D8 | definição de pronto por fase; artefato proporcional; spec diz o quê; Observação com janela | cartões e `janela` ([fases](fases.md)) | 1 |
| D9 | fluxo constante, domínio plugável (skills, templates, prova) | manifesto do módulo: `skills` por fase, `templates`, `requisitos_de_prova` ([instalacao](instalacao.md#módulo-d9d11)); módulos de domínio | 1 (formato) / 3 |
| D10 | um core, várias portas; CLI única porta de escrita | estado lido do ledger (projeção) + `validar`; decisão humana assinada ([no](no.md#duas-classes-de-campo), [controle](controle.md#decisão-humana-assinada)); [cli](cli.md). **Parcial:** o Obsidian não indexa `.agents/`; a tela do Inc. 1 é `zeno status`, a visão no Obsidian vai com o vault como alvo. UI web → mapa | 1 / 3 |
| D11 | módulo com manifesto; composição no `sistema.yaml`; versão fixada; meta: evolução autônoma | [instalacao](instalacao.md); `sync` recusa versão divergente; `modulo.atualizar` na faixa `aprovacao`. Evolução autônoma | 1 / 4 |
| D12 | canônico × gerado com cabeçalho e deriva; skills como cópia; adoção | [instalacao](instalacao.md); `sync --check` no pre-commit. `.mcp.json`: quando houver MCP do Zeno. CI: não há CI no monorepo; o pre-commit + bench da `avaliacao/` fazem o papel | 1 |
| D13 | 3 faixas, 3 tipos de gate, promoção em sombra com k, rebaixamento, "nunca" nunca promove | [controle](controle.md): faixas, check e humano; formato `_sombra`/`k` e `modo` no ledger. Juiz, promoção e rebaixamento | 1 / 4 |
| D14 | síncrono no MVP; orçamento gate herdado, teto diário, disjuntor; ledger; orçamento = escopo do OK | [controle](controle.md#orçamento-d14), [ledger](ledger.md). Assíncrono e reserva antes do efeito | 1 / 4 |
| D15 | 4 camadas; insumo não confiável rebaixa; "não contorne"; sandbox; fronteira mecânica | [seguranca](seguranca.md) com resíduos declarados; procedência por classe de origem **e** marca mecânica de contaminação ([controle](controle.md#procedência-d15)); cláusula no `pedido`; ids opacos e pessoas em hash no ledger. Sandbox do runner → 4; o sandbox do agente (`zeno sessao`) já existe; check de termos na captura → 3 | 1 / 3 / 4 |
| D16 | mapa de pontos de atenção na `avaliacao/` | fora do `zeno/`; a spec só alimenta (ver "Para o mapa" abaixo) | 1 (`avaliacao/`) |
| D17 | três poderes; avaliação dona da prova; módulo declara requisitos | ledger e `guardas.json` como entrada da `avaliacao/`; `requisitos_de_prova` no módulo; `proposta` com faixa mínima `aprovacao` | 1 |
| D18 | lição só de atrito observado; vira proposta no grafo do Zeno e captura ao hub; empresa não exporta | tipo `licao` com `origem` em evento de atrito ([no](no.md#tipos-de-nó)); Aprendizado exige `atrito` ([fases](fases.md)). Captura ao hub | 1 / 3 |
| D19 | imposto medido, teto 15%; via expressa; registro retroativo; linha de base | **Parcial:** insumos medidos no [ledger](ledger.md#o-que-a-avaliacao-consegue-calcular-insumos-não-fórmulas) (hook `SessionEnd` lê o transcript; [seguranca](seguranca.md#medição-mecânica)); o imposto v1 é um **piso** (tempo humano fora da CLI não é medido). [Via expressa](fases.md#via-expressa-d19); `registrar --retro`. Teto e fórmula → `avaliacao/`; linha de base → 2 (o passo 1, a linha de base pelo git, já existe na `avaliacao/`) | 1 / 2 |
| D20 | Sistema registra, avaliação interpreta; ficha; n e estrato | ledger sem fórmula; `estrato` em toda linha | 1 |
| D21 | pacote de contexto em 6 camadas montado pela CLI; regras invioláveis fora; sessão por fase é teto | `zeno contexto` ([cli](cli.md#zeno-contexto-id---fase-fase---sem-agents)); camadas 1–2 de segurança fora do contexto; Verificação de G em sessão nova | 1 |
| D22 | papéis dono/executor/revisor; caixa; aprovação por papel; adaptadores; MVP Filipe + agentes | [no](no.md), [controle](controle.md#faixas-d13), `caixa`/`pendentes`; `pessoas` no `sistema.yaml` | 1 |
| D23 | comunicação no grafo; 7 tipos com campos; autossuficiente; lint na CLI | [mensagens](mensagens.md) | 1 |
| D24 | estudo é módulo opcional; no core só `fundamento` | campo `fundamento` ([no](no.md)). Módulo `estudo` → mapa ("quando o Filipe quiser") | 1 / depois |
| D25 | 1º alvo real: um repo de empresa | `fronteira: empresa` e ids opacos já no formato | 2 |
| D26 | nome Zeno, comando `zeno` | [cli](cli.md) | 1 |
| D27 | migração do hub para `conhecimento/` | feita no Inc. 0; a lição do `GIT_DIR` entra no pre-commit ([instalacao](instalacao.md#hooks-de-git-do-zeno)) | 0 |
| D28 | Node ESM sem dependências; shim no PATH; alvo só dados; distribuição → mapa | [cli](cli.md); check `sem-dependencia`; [instalacao](instalacao.md#sentido-único-d12) | 1 |
| D29 | dois momentos para o PO | não se aplica ao `zeno/` | A / 2 |
| D30 | método de arrumar a casa | não se aplica; usa `install --adocao` e `fronteira` | 3 |
| D31 | sequência de incrementos | esta spec é o Inc. 1 | — |
| D32 | decisões do início do Inc. 0 | não se aplica | 0 |
| D33 | antifragilidade; censo determinístico de guardas | `guardas.json` com probe + mutação + `caminhos` ([seguranca](seguranca.md#registro-de-guardas-d33)) | 1 |
| D34 | 1º alvo real: o 1º alvo de cliente, em modo adoção | adoção sem mexer no harness do repo: T74 (regras no `settings.local.json`), T77 (os 4 atritos da instalação), T81 (sem skill no `.claude/`); T83 (bloco do `AGENTS.md` só onde o Zeno está instalado) em Execução ([instalacao](instalacao.md)) | 2 |
| D35 | arquivos do Zeno commitados no alvo; fronteira `cliente` | T73 (pessoas em hash, sal fora do git), T74 (as travas por máquina, fora do git) ([instalacao](instalacao.md), [seguranca](seguranca.md)) | 2 |
| D36 | seguro sozinho; ação humana só quando vale, com cartão | T75 (cartão de decisão), T76 (via expressa de código), T78 (uma passphrase por rodada), T79 (promover só com Entrega aprovada; decisão técnica no expresso), T85 (Observação só ao executor) ([controle](controle.md), [cli](cli.md)) | 2 |
| D37 | o agente é uma entidade própria | T80 (cache rejeitado; a C1 não está fechada nesta máquina, [seguranca](seguranca.md#resíduos-declarados)); T82 (isolar o agente) com a Especificação em reaprovação | 2 |
| D38 | material de cliente achado no hub | não se aplica ao `zeno/` (é do `conhecimento/`); a fronteira `cliente` do D35 segue valendo aqui | — |
| D39 | o Zeno é agnóstico à ferramenta de LLM | inventário núcleo × porta do Claude Code ([portas](portas.md)); contrato mínimo de uma porta (T83) | 2 |
| D40 | a saída do Zeno é legível (contexto ilegível vira carimbo) | [tela](tela.md): resumo antes do detalhe, rótulos, largura, cor; lint do cartão; `pendentes --json` com a vista do gate (T88) | 2 |

## Para o mapa de pontos de atenção (a sessão da `avaliacao/` decide se entra)
- Gate humano exige o terminal do Filipe (TTY, fora do Claude Code, passphrase): o `!` do Claude Code não serve.
- Tokens medidos dependem do formato do transcript do Claude Code (não é contrato público): probe `transcript-formato`. `fonte: declarado` é autorrelato e fica em estrato próprio.
- O imposto v1 é um piso: o tempo humano de ler e escrever artefato fora da CLI não é medido. Sinal: imposto medido muito abaixo da percepção do Filipe.
- Assinatura com passphrase a cada gate humano: custo para o Filipe a medir (espera em gate). Sinal: espera dominada por gates de nós P/M.
- O hook da camada 2 lê só a string do comando (resíduo declarado em [seguranca](seguranca.md)).
- `<alvo>:<id>` entre grafos sem verificação de existência. Sinal: o primeiro vínculo real vault ↔ alvo.
- O lint "autossuficiente" é raso. Sinal: mensagens que voltam com `pergunta` pedindo contexto.
