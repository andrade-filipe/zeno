---
tipo: referencia
publico:
  - usuario
  - agente
  - contribuidor
responde: "O que quer dizer cada termo do repo, escrito sempre do mesmo jeito?"
fonte:
  - zeno/spec/README.md
  - AGENTS.md
  - avaliacao/AGENTS.md
  - avaliacao/placar/metricas.mjs
  - zeno/core/verbos/escrita.mjs
  - zeno/spec/dominio.md
  - zeno/spec/instalacao.md
  - avaliacao/placar/sensores.mjs
verificado-em: 4372d91
---

# O glossário

> Esta página vem do monorepo de origem do Zeno. Onde ela diz `zeno/`, aqui é a raiz deste repositório; a `avaliacao/` e o `conhecimento/` não vêm nesta publicação.

**Resumo.** Um termo, um sentido, uma grafia. A doc usa estes termos sempre do mesmo jeito. Os termos do Zeno são
**gerados** da tabela da spec ([`zeno/spec/README.md`](../spec/README.md#glossário)). Os termos do repo, do hub, da
avaliação e da doc são escritos aqui.

## Termos do repo

| Termo | Significado aqui |
|---|---|
| **raiz** | uma das quatro pastas de topo com código, `AGENTS.md` e regras próprios: `conhecimento/`, `zeno/`, `avaliacao/` e `docs/`. Entre raízes só cruza leitura, por formato (D3). |
| **os três poderes** | o que se sabe (`conhecimento/`), o que executa (`zeno/`) e o que julga (`avaliacao/`). |
| **sessão** | o `zeno sessao <agente>` (T82, camada A): abre a CLI do agente num sandbox (bwrap), com a rede só por um proxy com allowlist e sem a casa da pessoa. O ledger registra `sessao.aberta` e `sessao.fechada`. |
| **porta** | o adaptador de uma ferramenta de LLM: o que só vale dentro dela (no Claude Code, o deny e os hooks). O resto é o **núcleo**, que vale para qualquer ferramenta (D39). |
| **cartão de decisão** | os 6 campos em linguagem simples que um gate humano exige para abrir (o que muda, por quê, risco, como desfazer, se reprovar, o que conferir). O risco começa pelo nível: `alto:`, `baixo:` ou `nenhum:` (D40). |
| **cópia fixada** | a cópia do código do Zeno que roda as guardas. Só muda com `zeno promover`, que é de pessoa e assinado. Fica na casa da pessoa, ou em `/opt/zeno`, do root, depois do bloco C da T82 (T95). |
| **teto diário** | o limite de gasto do alvo inteiro por dia UTC. Estourado, ele trava o alvo com a saída 4 até a virada do dia, ou até uma pessoa liberar o dia com `zeno gate --teto dim=+N` (T93). |
| **censo** | a prova de que cada guarda dispara: a sonda passa no código real e cai numa cópia com a guarda trocada por `false&&`. |
| **fronteira** | a classe de um alvo: `pessoal`, `empresa` ou `cliente`. Dado de alvo `empresa` ou `cliente` nunca entra neste monorepo (D35). |
| **fronteira efetiva** | a mais restrita entre a fronteira declarada no `sistema.yaml` e as regras por pasta da pessoa; sem nenhuma das duas, `cliente`. Serve à frota e às telas, e não muda o comportamento dentro do alvo (T104). |
| **registro de alvos** | a lista dos alvos da máquina (`alvos.json`, só a CLI escreve) e as regras por pasta (`regras.yaml`, só a pessoa escreve), em `~/.local/share/zeno/`, fora de qualquer git. Lido pelo `zeno alvos` (T104). |
| **frota** | o passo do `zeno promover` que confere os alvos do registro com o `sync --check` da cópia nova e, com uma confirmação, sincroniza só os de fronteira efetiva `pessoal` (T106). |
| **marca de sandbox** | o campo `sandbox` de todo evento do ledger: `fora` sem o marcador do `zeno sessao`, `sessao` com ele. `fora` é certeza; `sessao` é declaração, porque o marcador é forjável no mesmo usuário (T105). |
| **hábito** | a regra de que o 1º ato do agente num alvo é abrir o nó. O hook `Stop` e o gate de commit pedem o `registrar --retro` quando há trabalho sem nó, e o commit de agente sem nó para (T113). |
| **D e T** | D… são as decisões de desenho, no vault do Filipe. T… são as decisões técnicas, em `zeno/spec/decisoes-tecnicas.md`. A doc cita cada uma pelo número, sem escrever a contagem. |

## Termos do hub

| Termo | Significado aqui |
|---|---|
| **hub** | o `conhecimento/`: a base de nós de context engineering, em inglês. |
| **nó do hub** | uma nota com tipo dado pela pasta: `question`, `source`, `evidence`, `claim`, `concept`, `synthesis`, `card`, `experiment`, `decision`, `publication` ou `front`. Não confundir com o **nó** do Zeno. |
| **certeza** | o grau de um `claim`: `high`, `moderate`, `low` ou `very-low`. Uma ideia própria do Filipe ainda sem evidência é `hypothesis`. |
| **anel** | o grau de um `card`: `hold`, `assess`, `trial` ou `adopt`. |
| **frente** | o recorte do hub que vale para um projeto cliente. O MCP filtra pela frente. |
| **lei** | uma das L1–L13 do hub, guardada como card de lei com anel, como a L3 (a regra fica na camada mais dura) e a L7 (contexto mínimo suficiente). |

## Termos da avaliação

| Termo | Significado aqui |
|---|---|
| **placar** | a vista gerada das métricas do ledger: o imposto, o lead time e a espera em gate humano. |
| **ficha** | a página de uma métrica: o que mede e o que não mede, a fórmula, os vieses, a contramétrica e a decisão (D20). |
| **estrato** | um recorte dos casos do placar, por um atributo do nó: a linha `todos` e uma linha por valor de `tamanho`, `faixa`, `expressa` e `retro`, cada atributo sozinho, sem cruzar. Cada estrato tem o próprio n, e o que conta como caso muda por métrica: nó fechado, lote de aprovação ou nó com gasto medido. |
| **n insuficiente** | o placar mostra o número, mas não conclui nada com menos de 5 casos num estrato. |
| **linha de base** | o "antes" de um alvo, tirado do histórico do git: lead time, retrabalho e tamanho de lote. |
| **sensor** | um número da semana de um alvo comparado com um teto: o % de retro, os seus atos e o imposto. Fora do teto, ele pede um nó de Intenção com a origem `sensor:<nome>`, no máximo um por sensor e 5 por semana (T117). |
| **linha da noite** | a linha do dia que o `placar.mjs --noite` imprime: "hoje: N nós, M retro, K atos seus". |
| **bench** | o conjunto de checagens determinísticas de uma raiz, que roda sem rede e sem LLM. |

## Termos da doc

| Termo | Significado aqui |
|---|---|
| **portão** | uma checagem de máquina da doc, com caso, marcador e mutação (padrão). |
| **fonte** | o arquivo do repo de que um doc depende, declarado nos metadados. |
| **verificado-em** | o commit em que o texto do doc foi conferido contra a fonte. |
| **a-conferir** | o estado de um doc cuja fonte mudou depois do `verificado-em`. É derivado pelo portão `doc-frescor`. |
| **pergunta-sonda** | uma pergunta prática com âncora, código e fatos-chave, que testa se a doc responde. |

## Termos do domínio

O domínio do Zeno é a direção do desenho ([dominio](../spec/dominio.md)). Quase todos estes termos nomeiam um
**plano**, com o horizonte entre parênteses, e não algo que o código já faz ([conceitos](conceitos.md#o-domínio-fluxo-etapa-e-garantia)).

| Termo | Significado aqui |
|---|---|
| **garantia** | o que uma fase passa a ser no desenho: algo que todo trabalho cumpre pelo caminho mais barato (derivada pela máquina, herdada do ancestral, escrita pelo agente ou assinada pela pessoa). Hoje a fase é um passo com artefato e gate (plano, médio prazo). |
| **fluxo** | a definição de um jeito de trabalhar: um grafo versionado de etapas, que a CLI lê e impõe. O trabalho (os nós) é a instância. Hoje não há definição de fluxo: os nós contam como o fluxo implícito, versão 0 (plano, médio prazo). Não confundir com o `core/fluxo.mjs`, que é a saída de fase. |
| **etapa** | um ponto do fluxo, com o ponteiro de conhecimento, a faixa, os checks e a estratégia padrão. Cada etapa executada vira um nó com as 7 garantias (plano, médio prazo). |
| **receita** | um fluxo promovido por uma pessoa, que a CLI passa a impor. Nasce do uso: grafo emergente, proposta, promoção (plano: à mão no médio prazo, detectada sozinha no longo). |
| **contrato de porta** | os 5 níveis de uma porta de ferramenta de agente: operar, contexto, guardar, medir e isolar, cada um sobre os anteriores. Hoje existe a porta do Claude Code e o contrato mínimo dela (os níveis e o verificador são plano, médio prazo). |
| **contrato de fonte de conhecimento** | o que toda base de conhecimento segue para dar contexto a uma etapa: buscar, ler e aconselhar por domínio, nunca rodar modelo, filtrar a saída e ficar separada por fronteira (plano, médio prazo). |
| **confiança graduada** | a escada da força da assinatura: a marca de sandbox (já existe, T105), o sandbox obrigatório, a cópia das guardas do root e a chave física (o resto é plano, do curto ao longo prazo). |

## Termos do Zeno

<!-- gerado:inicio fonte=zeno/spec/README.md gerador=glossario-zeno -->
| Termo | Significado aqui |
|---|---|
| **alvo** | uma pasta ou repo onde o Zeno está instalado (`.agents/sistema.yaml` existe). O próprio `zeno/` é alvo de si mesmo. |
| **nó** | uma unidade de trabalho: `.agents/trabalho/<id>.md`. Tem pai, filhos (derivados), arestas laterais e fase. |
| **fase** | uma das 7: `intencao`, `especificacao`, `execucao`, `verificacao`, `entrega`, `observacao`, `aprendizado`. |
| **cartão de fase** | a definição de pronto de uma fase: pergunta, artefato, gate típico (D8). Mora no módulo `nucleo`. |
| **artefato** | o que a fase produz. Fica na seção da fase no corpo do nó (ou num anexo linkado dali). |
| **gate** | a decisão na saída de uma fase. Tipos: `check` (determinístico), `humano`, `juiz` (Inc. 4). |
| **faixa** | o nível de risco: `autonoma`, `aprovacao`, `nunca`. Decide os gates e quem pode executar. |
| **faixa efetiva** | a faixa que vale: a mais restritiva entre a declarada, a das ações declaradas e a da procedência. Derivada, nunca escrita. |
| **procedência** | se o insumo do nó é `confiavel` ou `nao-confiavel` (web, issue, documento ingerido, retorno de MCP). Não confiável rebaixa a faixa. |
| **ator** | quem chama a CLI: uma pessoa (`filipe`) ou um agente (`ia:claude`). |
| **papel** | `dono` (responde pelo resultado), `executor` (faz), `revisor` (decide os gates humanos que a tabela lhe dá). |
| **assinatura** | Ed25519 da pessoa sobre um evento de decisão humana; a chave privada é cifrada por passphrase e fica fora do alcance do agente. |
| **contaminação** | marca mecânica (hook) de que a sessão trouxe conteúdo de web ou MCP; rebaixa a faixa dos nós criados no alvo enquanto a marca existir. |
| **orçamento** | o teto do nó: `tokens`, `usd`, `tentativas`; e `prazo` (só aviso). |
| **disjuntor** | a trava que pausa o nó (e os descendentes) quando um teto estoura. Só um humano rearma. |
| **ledger** | `.agents/ledger.jsonl`: um evento por linha, append-only, formato versionado. |
| **fio** | `.agents/trabalho/<id>.fio.md`: as mensagens do nó, append-only. |
| **via expressa** | o caminho de um nó pequeno (P, faixa autônoma): as 7 fases numa sessão, com artefatos de uma linha e só gates check. |
| **módulo** | um pacote com manifesto (`zeno/modulos/<nome>/modulo.yaml`). O `nucleo` é obrigatório. |
| **canônico / gerado** | canônico = `AGENTS.md` + `.agents/` (editados por gente e pela CLI); gerado = `CLAUDE.md`, `.claude/` (só pelo `zeno sync`). |
| **adoção** | instalar num alvo que já tem harness: o que existe vira `local` e não é sobrescrito. |
| **imposto** | a fração do esforço de um nó gasta com o próprio Zeno (D19). O Zeno registra os insumos; a fórmula é da `avaliacao/`. |
<!-- gerado:fim -->

Três linhas acima vêm da spec e dizem menos que o código. Em **procedência** e em **contaminação**, "rebaixa a faixa"
quer dizer que a faixa efetiva fica mais restrita: sobe para `aprovacao` no mínimo. Na **contaminação**, os nós que já
existiam não mudam: só nasce `nao-confiavel` o nó criado enquanto a marca existe
([faixas e gates](conceitos.md#faixas-e-gates)). Em **disjuntor**, "só um humano rearma" quer dizer um
evento assinado de pessoa: `zeno gate <id> --orcamento dim=+N` ou `zeno gate <id> --despausar --motivo "…"` (T98).
Baixar o orçamento não despausa.
