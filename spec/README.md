# Zeno — spec técnica do Inc. 1 (o esqueleto)

Versão da spec: **1** (2026-11-02), revista por uma crítica adversarial (achados e destino em [decisoes-tecnicas.md](decisoes-tecnicas.md)). Fonte da verdade do desenho: vault `1 Projects/Zeno/decisoes.md` (as decisões do desenho) e `plano.md`.
Esta spec diz **o que** o core faz e **qual formato** ele promete. Ela não reabre decisão: onde as D's não fecham um detalhe,
a escolha está em [decisoes-tecnicas.md](decisoes-tecnicas.md), uma linha cada.

## Arquivos

| Arquivo | Cobre |
|---|---|
| [dominio.md](dominio.md) | o que o Zeno é: fluxo, etapa, garantia, receita, contratos e confiança; o que é hoje e o que é plano |
| [no.md](no.md) | o nó: frontmatter, layout em disco no alvo, arestas, validação |
| [fases.md](fases.md) | os 7 cartões de fase e a via expressa |
| [cli.md](cli.md) | o contrato da CLI `zeno`: verbos, entradas, saídas, JSON, códigos de saída, o que cada um escreve |
| [controle.md](controle.md) | faixas, gates, procedência, orçamento (herança, teto, disjuntor) |
| [ledger.md](ledger.md) | o ledger append-only, **contrato v1** que a `avaliacao/` lê |
| [mensagens.md](mensagens.md) | os 7 tipos de mensagem, campos obrigatórios e o lint |
| [instalacao.md](instalacao.md) | `sistema.yaml`, módulo `nucleo`, adaptador `.claude/` gerado, `sync --check`, modo adoção |
| [seguranca.md](seguranca.md) | as 4 camadas (D15) aplicadas ao próprio `zeno/`, e o registro de guardas (D33) |
| [rastreabilidade.md](rastreabilidade.md) | as decisões do desenho → onde a spec atende, ou para qual incremento vai |
| [portas.md](portas.md) | o que é núcleo agnóstico e o que é porta do Claude Code; o contrato mínimo de uma porta (D39) |
| [roteiro-t82.md](roteiro-t82.md) | os passos com root ou login para isolar o agente (T82), do Filipe, com cartão |
| [tela.md](tela.md) | como o Zeno escreve para a pessoa: resumo antes do detalhe, rótulos, largura, cor, o tipo de uma mudança (D40) |
| [decisoes-tecnicas.md](decisoes-tecnicas.md) | as decisões de detalhe tomadas aqui, com o porquê |

## O Zeno em 8 linhas
1. Todo trabalho é um **nó** (um arquivo Markdown com frontmatter) num grafo que mora **no alvo**, em `.agents/trabalho/`.
2. Todo nó roda as **7 fases** em ordem; nenhuma é pulada, mas o artefato é proporcional ao tamanho.
3. A **CLI `zeno` é a única porta de escrita do estado**. A CLI lê o estado do **ledger** (projeção); o frontmatter é uma vista, e o `validar` acusa edição à mão.
4. Cada saída de fase passa por um **gate** (check ou humano no Inc. 1; juiz no Inc. 4). A **faixa** do nó decide qual. Decisão humana é **assinada** (Ed25519 com passphrase): ambiente não prova pessoa.
5. Todo nó tem **orçamento**, herdado do pai, com teto diário por alvo e **disjuntor**.
6. Todo fato vai para o **ledger** (JSONL, append-only, versionado). O Zeno registra; a `avaliacao/` interpreta.
7. A conversa sobre o nó vive no **fio** do nó: mensagens de 7 tipos, com campos obrigatórios e lint.
8. O alvo leva **só dados** (`AGENTS.md`, `.agents/`, os gerados). O código mora em `zeno/` e entra no PATH por um shim.

## Glossário

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

## Fora do Inc. 1 (com destino)
Juiz LLM, promoção em modo sombra, rebaixamento automático, runner assíncrono e o sandbox do runner → **Inc. 4**; o sandbox do agente (`zeno sessao`) já existe.
Linha de base pelo git (o passo 1 já existe na `avaliacao/`) e instalação no 1º alvo real → **Inc. 2**. Módulos de domínio e captura para o hub → **Inc. 3**.
Placar, fichas, bench e mapa de pontos → sessão da **`avaliacao/`** do Inc. 1, lendo o [ledger](ledger.md) e o [registro de guardas](seguranca.md#registro-de-guardas-d33).
