<!-- doc
tipo: conceito
publico:
  - usuario
  - contribuidor
responde: "O que é o zeno/, como rodo e onde está o contrato?"
fonte:
  - zeno/AGENTS.md
  - zeno/spec/README.md
  - zeno/cli.mjs
  - zeno/spec/decisoes-tecnicas.md
  - zeno/core/portao.mjs
  - zeno/SECURITY.md
verificado-em: 0954cee
-->
# zeno/ — o que executa

**Resumo.** O Zeno é o sistema de processos que governa o trabalho feito com agentes num repo, o **alvo**. Todo
trabalho é um nó que passa por 7 fases. A CLI `zeno` é a única porta de escrita do estado, e o estado vive num ledger
append-only. Node ESM, sem dependências. O alvo recebe só dados, e o código fica aqui. Roda no Linux e no WSL2. O
macOS não é suportado, porque o `zeno sessao` e a prova do `promover` precisam do bwrap.

## In English

Zeno is a process system that governs the work AI agents do in a repository. Every piece of work is a node that moves
through 7 phases, from intent to learning. Risk bands decide which gates a person must sign. The `zeno` CLI is the only
way to change state, and every change goes to an append-only ledger. Human decisions are signed with a key and a
passphrase. Hooks and git hooks fail closed, so a broken or missing `zeno` denies the action instead of allowing it.
Zeno is plain Node.js ESM with no dependencies. It runs on Linux and WSL2. macOS is not supported, because the agent
sandbox (`zeno sessao`) and the promotion proof need bubblewrap. The documentation is written in Portuguese. License:
Apache-2.0 ([LICENSE](LICENSE)). Contributions use the DCO ([CONTRIBUTING.md](CONTRIBUTING.md)), and security reports
follow [SECURITY.md](SECURITY.md).

## Usar

- Primeira vez: [o tutorial](docs/comecar.md), num repo descartável.
- Instalar num repo seu: [Instalar num repo](docs/como-fazer/instalar-num-repo.md).
- O que cada peça é: [os conceitos](docs/conceitos.md).
- A ajuda da CLI: `node ./cli.mjs ajuda`, ou `zeno ajuda` com o shim `bin/zeno` no PATH.
- Os alvos da máquina, as ferramentas e o grafo no Obsidian: Registrar os alvos,
  Ver as ferramentas e Ver o grafo no Obsidian.

## O contrato

A spec em [`spec/`](spec/README.md) é a fonte da verdade: o nó, as fases, a CLI, o controle, o ledger, as mensagens, a
instalação, a segurança e as portas. Também a tela, que diz como o Zeno escreve para a pessoa, e o roteiro da T82. O
[domínio](spec/dominio.md) diz para onde o desenho vai (fluxo, etapa, garantia e receita): quase tudo nele é plano, e
cada seção separa o que é hoje do que é plano. As decisões técnicas estão em [`spec/decisoes-tecnicas.md`](spec/decisoes-tecnicas.md).
A doc em `docs/` explica e aponta, e não repete a spec.

## Desenvolver

- Testes: `node --test test/*.test.mjs test/probes/*.test.mjs`.
- Censo das guardas: `node test/censo.mjs`. O registro é o [`guardas.json`](guardas.json).
- O código que guarda roda da cópia fixada depois do primeiro `zeno promover`, um ato de pessoa. Antes dele, roda do
  clone. Com `/opt/zeno` do root (T95, bloco C do roteiro), a cópia fixada é a de lá, e o `promover` instala pelo
  `bin/zeno-instalar-root`.
- Isolar a CLI de um agente: `zeno sessao <agente>` (T82, camada A); os passos com root estão no
  [roteiro da T82](spec/roteiro-t82.md).
- Publicar uma versão: `zeno promover --publicar <clone público>` (T118), um ato de pessoa. Ele monta um snapshot do
  commit (o `zeno/` e as páginas públicas do `docs/`), e não da pasta no disco, com os caminhos do monorepo trocados
  pelos do repo público (T119), e roda 7 checks que falham fechado: os nomes da lista da máquina, a casa real, o
  gitleaks, a lista do que entra, o histórico do clone, a cópia do root e o layout (nenhum caminho do monorepo
  sobrando). Com os 7 verdes, faz o commit e a tag no clone. O push é da pessoa.
- As regras do agente nesta raiz estão no [`AGENTS.md`](AGENTS.md).
