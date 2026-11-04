---
tipo: como-fazer
publico:
  - usuario
responde: "Como instalo o Zeno num repo meu, novo ou que já tem harness (modo adoção)?"
fonte:
  - zeno/spec/instalacao.md
  - zeno/spec/cli.md
  - zeno/bin/zeno
  - zeno/core/verbos/promover.mjs
  - zeno/core/verbos/instalar.mjs
  - zeno/core/frota.mjs
verificado-em: 6ae3549
---

# Instalar o Zeno num repo

**Resumo.** Ponha o `zeno` no PATH. Num repo sem harness, rode `zeno install <dir>`. Num repo que já tem `CLAUDE.md`
ou `.claude/`, rode `zeno install <dir> --adocao`, que não sobrescreve nada do que existe. Depois confira com
`zeno status` e `zeno sync --check`.

**Quando:** você quer governar o trabalho de agentes num repo seu.
**Antes:** faça o [tutorial](../comecar.md) uma vez, num repo descartável. O Zeno roda no Linux e no WSL2. O macOS não
é suportado, porque o `zeno sessao` e a prova do `promover` precisam do bwrap.

## 1. Ponha o `zeno` no PATH de vez

O shim `zeno/bin/zeno` roda o `cli.mjs` do clone. Ligue o shim num diretório que já está no seu PATH:

```sh
ln -s <caminho do clone>/zeno/bin/zeno ~/.local/bin/zeno
```

Os hooks gerados chamam `zeno` pelo PATH. Por isso o `sync` recusa gerar os hooks quando o `zeno` não está no PATH:
sem ele, todo comando do agente seria negado.

Esse link vale só até o primeiro `zeno promover` ([passo 5](#5-ligue-a-chave-a-cópia-fixada-e-os-checks)). O
`promover` troca o link por um arquivo que roda a cópia fixada. Depois disso, não ligue o link do clone de novo: os
hooks voltariam a rodar o código que o agente edita. O `promover` só troca o `~/.local/bin/zeno`: confira que o
`command -v zeno` dá esse caminho (ou `/usr/local/bin/zeno`, com a cópia do root), e não um link do clone em outro
diretório do PATH.

**A mensagem do `sync` sem o `zeno` no PATH.** A partir da cópia promovida com o conserto (7c5ed43), ela distingue
os dois casos. Sem cópia fixada, manda o `ln -s` do clone acima; com cópia fixada, manda pôr no PATH o shim do
`promover` e avisa para não ligar o do clone. Uma cópia promovida antes desse conserto ainda manda o `ln -s` nos dois
casos: depois do primeiro `promover`, siga [Quando o Zeno nega algo](quando-algo-e-negado.md#quando-um-hook-nega).

## 2. Escolha a fronteira

A fronteira diz o que pode sair do alvo:

| Fronteira | Quando | O que muda |
|---|---|---|
| `pessoal` | um repo seu | nada sai além do normal |
| `empresa` | um repo do trabalho | ids opacos, pessoas em hash, e o placar fica no próprio alvo ou fora do git |
| `cliente` | um repo de cliente | o mesmo que `empresa`, a mais restrita |

Dado de alvo `empresa` ou `cliente` nunca entra no monorepo pessoal (D35). Passe sempre `--fronteira`. Sem ela, o
`install` grava `pessoal` e avisa (`aviso fronteira`). O registro de alvos da máquina, ao contrário, trata como
`cliente` o alvo que não declara nada, e uma regra por pasta mais restrita vence a fronteira gravada
(Registrar os alvos).

O `install` também põe o alvo na lista da máquina (`registro de alvos: … entrou na lista`). Num worktree ligado, ele
não registra: o alvo entra pelo checkout principal.

## 3a. Repo sem harness

```sh executavel
cd "$(mktemp -d)"   # um diretório descartável
git init -q -b main meu-repo
zeno install meu-repo --fronteira pessoal
```
```text saida
instalado em
gerados: AGENTS.md, .agents/githooks/pre-commit
.claude/settings.json
.git/config core.hooksPath
```

O `install` cria `.agents/` e o `AGENTS.md` com o bloco do Zeno. Depois roda o `sync`, que gera o gate de commit em
`.agents/githooks/`, o `CLAUDE.md` (`@AGENTS.md`), o `.claude/settings.json` (deny e hooks) e uma skill. Num clone
livre, como este, o `sync` também liga o `core.hooksPath` do clone ([passo 5](#5-ligue-a-chave-a-cópia-fixada-e-os-checks)). O canônico é o `AGENTS.md` com o `.agents/`, e o
gerado só muda pelo `zeno sync`.

**Cuidado com o time.** Esse `.claude/settings.json` vai para o git, e os hooks dele falham fechado. Quem abrir uma
sessão de Claude Code no repo sem o `zeno` no PATH tem **todo** comando do agente negado. Combine com o time antes de
commitar, ou use a adoção (3b), que deixa as travas fora do git.

## 3b. Repo que já tem harness (adoção)

```sh executavel
cd "$(mktemp -d)"   # um diretório descartável
git init -q -b main repo-com-harness
cd repo-com-harness
printf '# Regras do repo\n' > AGENTS.md
printf '@AGENTS.md\n' > CLAUDE.md
mkdir .claude
printf '{"permissions":{"allow":[]}}\n' > .claude/settings.json
git add -A
git commit -q -m "o harness que já existia"
zeno install . --adocao
```
```text saida
(adoção;
.claude/settings.local.json
```

Na adoção:
- cada arquivo de harness que já existe vai para `local:` no `.agents/sistema.yaml` e nunca é sobrescrito;
- o `AGENTS.md` do repo fica intacto. O bloco do Zeno chega ao agente pelo hook `SessionStart`, no mesmo arquivo das
  travas;
- num repo com `.claude/settings.json` próprio, como este, as travas (deny e hooks) vão num
  `.claude/settings.local.json` gerado, por máquina e fora do git. O `sync` e o `sync --check` lembram disso com o
  `aviso fiacao` ("fiação por máquina"), que não é deriva. Para calar o aviso, a pessoa põe `fiacao: local` no
  `sistema.yaml`;
- o `sync` põe a linha do `settings.local.json` no `.git/info/exclude` do clone, sem tocar o `.gitignore`. Se uma regra
  do repo já ignora o arquivo, ele não escreve nada (T112). Num worktree ligado não existe exclude próprio: a linha vai
  no exclude do checkout principal e vale para todos os worktrees. A saída diz o caminho e como tirar a linha.

Consequência: quem abre sessão numa máquina sem o `settings.local.json` não é governado pelo Zeno. É coerente, porque
também não recebe as regras de um Zeno que não tem. Detalhe em [instalacao](../../spec/instalacao.md#modo-adoção-zeno-install---adocao).

**A adoção é um fato gravado (T94).** O `install --adocao` escreve `adocao: true` no `.agents/sistema.yaml`, e é esse
campo que faz o alvo contar como adotado ([`protegidos.mjs`](../../core/protegidos.mjs)). Vale também para um repo
que tem só `CLAUDE.md`, ou `CLAUDE.md` e `AGENTS.md`, sem `.claude/settings.json`. Nesse repo, o `CLAUDE.md` não é
gerado, e o bloco chega pelo `SessionStart`. Um alvo adotado antes da T94, sem o campo, segue reconhecido pelo
`settings.json` em `local`.

**Sem `.claude/settings.json` próprio, a fiação depende da fronteira (T113):**
- **`pessoal`:** o `sync` gera um `.claude/settings.json` versionado, com o deny, os hooks e o `SessionStart`. Um clone
  novo já nasce com as travas. O preço: num clone sem o `zeno` no PATH (outra máquina, a nuvem, um colega), os hooks
  negam comando e edição. A saída é `fiacao: local` no `sistema.yaml`, que devolve a fiação ao `settings.local.json`;
- **`empresa` e `cliente`:** a fiação fica sempre no `settings.local.json`, fora do git.

Um `settings.local.json` gerado antes, que sobrou, vai para `.agents/_lixo/`.

## 4. Confira

No diretório do alvo:

```sh executavel
zeno status
zeno sync --check
```
```text saida
sem deriva
```

O `status` mostra no topo o que falta neste alvo: as camadas 1 e 2 ausentes, a chave pública ausente ou uma marca de
contaminação ativa. O `sync --check` sai com 1 se um gerado tiver deriva e lista os arquivos com o tipo de cada um, a
de segurança primeiro (T106): `deriva de segurança em: .claude/settings.json; deriva de forma em: CLAUDE.md`.

## 5. Ligue a chave, a cópia fixada e os checks

- **A chave (pessoa).** O `install` grava a sua `chave_pub: null` e diz o comando certo (T112). Sem a chave, nenhum gate
  humano pode ser decidido. A chave é uma por pessoa, e vale para todos os alvos:
  - **sem chave na casa**, a dica é `zeno chave nova`. Ele cria a chave e imprime a linha `chave_pub:`, que você cola na
    sua pessoa em `.agents/sistema.yaml`;
  - **com chave na casa** (do tutorial, por exemplo), a dica é `zeno chave pub` (T96). O `install` só confere que o
    arquivo existe, sem abri-lo. O `chave nova` recusaria com 1, sem sobrescrever. O `chave pub` pede a passphrase,
    imprime a linha `chave_pub:` e avisa se ela não bate com a do `sistema.yaml`.

  O `install` não grava a chave por você. No `chave pub`, o `--pem` imprime a pública em PEM, e o `--em <arquivo>` a
  grava num arquivo novo. Como todo verbo de pessoa, ele exige um terminal: não passe a saída por pipe, use o `--em`.

  ```sh pessoa
  zeno chave pub
  ```
- **A cópia fixada (pessoa).** Até a primeira promoção, o shim e os hooks rodam o código do clone, que um agente pode
  editar. Num terminal seu, no diretório do alvo, rode `zeno promover`. Ele exige o código do clone commitado e roda os
  testes e o censo do Zeno (1 a 2 minutos) num bwrap sem rede (T90), e por isso pede o `bubblewrap` instalado. Depois copia o código para fora do clone, troca o shim `~/.local/bin/zeno` e
  grava um evento assinado no ledger do alvo ([cli](../../spec/cli.md#verbos-de-apoio)).

  ```sh pessoa
  zeno promover --de <caminho do clone>/zeno
  ```

  **A cópia do root (T95).** Na casa, a cópia fixada é do seu usuário, e um agente fora do sandbox consegue trocá-la.
  Depois do bloco C do [roteiro da T82](../../spec/roteiro-t82.md), que é seu e usa `sudo`, a cópia que guarda
  passa a ser `/opt/zeno`, do root. A partir daí o `promover` empacota a cópia provada, você a assina com a mesma
  passphrase, e um instalador root (`zeno-instalar-root`, em `sh`) confere a assinatura e o sha256 antes de instalar.
  O `sudo` pede a sua senha a cada promoção. O shim `~/.local/bin/zeno` vai para o `_lixo/`, e o `zeno` do PATH passa a
  ser o `/usr/local/bin/zeno`, que roda `/opt/zeno/atual`. Sem `/opt/zeno` do root, nada disso muda.

  **Para voltar a uma versão anterior.** Não há verbo do `zeno` que desfaça um `promover`. Cada promoção deixa uma cópia
  por commit, com os 12 primeiros caracteres do commit no nome, e o `atual` é um link para uma delas. O evento
  `zeno.promovido` guarda o commit `anterior`. Como voltar:
  - **na casa:** as cópias ficam em `~/.local/share/zeno/`, e o shim anterior vai para o `_lixo/` dessa pasta. Ponha o
    código antigo no clone com um commit novo (por exemplo, `git revert`) e rode o `promover` de novo. Ele sempre promove
    o HEAD do clone, com o código commitado;
  - **no root:** as cópias ficam em `/opt/zeno/`, e o instalador volta o `atual` para uma cópia que ele já instalou e
    conferiu: `sudo /opt/zeno/atual/bin/zeno-instalar-root --voltar <commit de 12>`. Essa volta não pede assinatura e não
    grava evento no ledger.

  Se a gravação do evento assinado falhar, o próprio `promover` volta o `atual` (e, na casa, o shim) ao que eram (T86).

  **O passo da frota (T106).** Depois de trocar a cópia, o `promover` confere cada alvo do registro da máquina com o
  `sync --check` da cópia nova e imprime `frota: N alvo(s) no registro; M com deriva`. Os alvos com deriva vêm em dois
  blocos: os pessoais, que a frota opera, e os de empresa, de cliente ou fora da frota. A deriva tem dois tipos, e a de
  segurança vem primeiro:
  - **segurança:** `.claude/settings*.json`, `.mcp.json`, `.agents/githooks/` e `.git/`, que são as travas;
  - **forma:** o resto, como o `CLAUDE.md` e as skills.

  Se há alvo pessoal com deriva, o `promover` pergunta uma vez se roda o `zeno sync` neles (`s/N`). Com `s`, ele
  sincroniza, confere de novo e imprime o `git add` e o `commit` por pathspec dos gerados: o `sync` não commita. Um alvo
  de empresa ou de cliente nunca é sincronizado pela frota (guarda `promover-so-pessoal`); ele sai com a linha
  `cd '<alvo>' && zeno sync` para você rodar. Os alvos sumidos e os worktrees ligados são pulados. Nada da frota muda a
  saída do `promover`, porque a promoção já foi feita. A frota só vê o que está no registro: rode o
  `zeno alvos --descobrir` uma vez ([passo 6](#6-registre-os-alvos-que-já-existiam)).
- **Os githooks (T97).** O `sync` gera o gate de commit do alvo em `.agents/githooks/` (`pre-commit` e
  `pre-merge-commit`, que rodam `zeno validar --staged` e `zeno sync --check`). Eles são gerados, versionados e
  protegidos, e falham fechado sem o `zeno`. Ligar é config local de cada clone:
  - **num clone livre**, sem `core.hooksPath` e sem hook ativo em `.git/hooks`, o `sync` liga o `core.hooksPath` sozinho;
  - **num clone com hooks próprios** (husky, lefthook, um `core.hooksPath` global), o `sync` não toca em nada e avisa a
    linha para encadear: `sh .agents/githooks/pre-commit`;
  - **num repo cujos hooks já rodam o gate** (T111), a pessoa declara a pasta deles no `sistema.yaml`, relativa ao alvo:
    `githooks_encadeado: .githooks`. O `sync` confere que o `pre-commit` e o `pre-merge-commit` dessa pasta existem e
    chamam `validar --staged` e `sync --check`. Se sim, ele diz "gate de commit coberto por …", e o `sync --check` cala.
    Se não, o aviso nomeia o arquivo ou o comando que falta. Desde a T116, o hook que chama o gerado de mesmo nome
    também cobre, porque o gerado já roda as duas checagens: `exec sh .agents/githooks/pre-commit` (ou `sh`, `bash`,
    com ou sem pasta antes). Um caminho citado só num comentário não conta. A chave não muda o `core.hooksPath` nem os
    gerados. O resíduo: a conferência lê o texto do hook, e não prova que o roteador do repo o chama.

  O `sync --check` acusa o clone livre que ainda não foi ligado e o `core.hooksPath` que saiu depois de ligado. Para
  desligar a geração, ponha `gerar: { githooks: false }` no `sistema.yaml`. O resíduo: um processo do seu usuário
  desliga o gate do clone com um `git config`.
- **Os servidores MCP (T99).** O agente só usa os servidores da lista `mcp:` do `sistema.yaml`, por exemplo
  `mcp: [claude_ai_Claude_Docs]`. Sem a lista, o padrão é nenhum. Um perfil em `agentes:` estende com o próprio `mcp:`.
  O `sync` gera o hook que nega o resto e o deny dos MCP de escrita conhecidos, menos os listados. Mudou a lista? Rode
  `zeno sync` de novo. Depois do `promover` que traz a T99, rode o `zeno sync` em cada alvo: até lá, o `sync --check`
  acusa deriva no `.claude/settings.json`. **O MCP do hub também conta.** Um alvo que consulta o hub pelo MCP dele
  (Consultar o hub) precisa do servidor na lista. O nome é o `<servidor>` das ferramentas
  `mcp__<servidor>__buscar_nos`, como o cliente o configurou. Sem ele na lista, o hook nega a consulta
  (`mcp-fora-da-lista`).
- **Os checks.** Em `sistema.yaml → checks`, nomeie os comandos que um gate `check` pode rodar, por exemplo
  `testes: "npm test"`. Em seguida ponha o nome em `checks_padrao`. Só os comandos daqui rodam: um nó não traz comando.
- **As ferramentas de terminal (T107).** Rode `zeno ferramentas` para ver quais o alvo usa e se estão prontas
  (Ver as ferramentas).
- **O commit.** Commite o `AGENTS.md` e o `.agents/`. O time vê o grafo e o ledger. Um commit de agente sem nó para
  (T113): o agente abre o nó antes, ou registra o trabalho com `zeno registrar … --retro`
  ([Quando o Zeno nega algo](quando-algo-e-negado.md#quando-o-validar-ou-o-pre-commit-acusa)).

## 6. Registre os alvos que já existiam

O registro de alvos da máquina (T104) nasceu depois de muitos alvos. O `install` registra só os alvos novos. Os
antigos entram uma vez, com `--descobrir` sobre a pasta onde moram os seus repos:

```sh
zeno alvos --descobrir <pasta dos seus repos>
zeno alvos
```

O `--descobrir` não sobe acima da pasta, não segue link, pula pasta oculta, `node_modules`, `_lixo` e worktree ligado, e
para em 6 níveis. O `zeno alvos` lista cada alvo com a fronteira efetiva e `opera` quando a frota pode agir nele. As
regras por pasta e o resto estão em Registrar os alvos.

## Se der errado

**Se der errado:** o `install` recusa com a saída 1 se o alvo já tem Zeno. O `sync` recusa com 1; os casos mais comuns são dois:
- **o hook não roda:** o `zeno` não está no PATH, ou o teste de fumaça do hook falhou;
- **um arquivo manual:** existe um arquivo que o Zeno geraria, mas ele não é gerado (não está no `gerados.lock`) nem está
  em `local`. Mova-o para `_lixo/` ou declare-o em `local`, e rode o `sync` de novo.

Um gerado que só derivou (você o editou à mão) não trava o `sync`: ele é regravado a partir do canônico. Os códigos e
as regras estão em [Quando o Zeno nega algo](quando-algo-e-negado.md#quando-o-validar-ou-o-pre-commit-acusa).
