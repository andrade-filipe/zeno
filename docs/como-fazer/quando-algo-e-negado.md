---
tipo: como-fazer
publico:
  - usuario
  - agente
responde: "O que faço quando o zeno ou um hook nega uma ação, e o que quer dizer cada código de saída?"
fonte:
  - zeno/spec/cli.md
  - zeno/spec/seguranca.md
  - zeno/modulos/nucleo/agents-md.md
  - zeno/core/config.mjs
  - zeno/core/shell.mjs
  - zeno/core/fluxo.mjs
  - zeno/core/verbos/instalar.mjs
  - zeno/core/verbos/validar.mjs
  - zeno/core/verbos/promover.mjs
  - zeno/core/verbos/guarda.mjs
  - zeno/core/habito.mjs
verificado-em: 0954cee
---

# Quando o Zeno nega algo

> Esta página vem do monorepo de origem do Zeno. Onde ela diz `zeno/`, aqui é a raiz deste repositório; a `avaliacao/` e o `conhecimento/` não vêm nesta publicação.

**Resumo.** Uma recusa diz **o que** foi recusado e **qual regra**, e não ensina o contorno. Para o agente, a regra é
uma só: **não contorne**. Pare, avise a pessoa e escale no fio do nó (`zeno msg <id> escalada`). A pessoa lê o código de
saída e decide.

## O código de saída

A lista completa e o envelope `--json` estão em [cli](../../spec/cli.md#convenções-comuns). O que fazer com cada
código:

| Código | Quer dizer | O agente | A pessoa |
|---|---|---|---|
| 0 | ok | segue | — |
| 1 | recusa por regra: chave que falta, lint, gate `check` reprovado, faixa, ator, papel, assinatura, passphrase errada na terceira tentativa (T100) | lê a regra; se for chave que falta, completa; se for outra regra, escala | confere se a regra está certa |
| 2 | uso errado: verbo, argumento ou alvo não achado | corrige o comando (`zeno ajuda`) | — |
| 3 | precisa de pessoa: gate humano aberto, ou verbo de pessoa. A mensagem diz qual: "gate humano de <fase> aberto para <pessoa>" ou "… é de pessoa" | avisa a pessoa e segue com outra coisa | `zeno caixa --aprovar` ou `zeno gate <id>` |
| 4 | orçamento: disjuntor do nó, nó pausado ou teto diário | para; no disjuntor, a CLI já escreveu a escalada no fio para o dono | disjuntor: `zeno gate <id> --orcamento dim=+N`, ou `zeno gate <id> --despausar --motivo "…"` para soltar sem subir o teto (T98), ou corta o escopo (o `ajustar` recusa aumentar orçamento). Teto diário: `zeno gate --teto dim=+N` (sem id, assinado) libera só o dia UTC de hoje; ou espera a virada do dia, ou sobe de vez o `orcamento.teto_diario` no `.agents/sistema.yaml` |
| 5 | trava: a CLI esperou 5 s pelo `.agents/.zeno.lock` de outro processo vivo, ou (regra `concorrencia`) o nó mudou enquanto os checks rodavam | roda de novo | nada: a trava órfã se resolve sozinha ([abaixo](#a-trava-do-código-5)) |
| 6 | não implementado no Inc. 1 (por exemplo, só gate `juiz`) | escala | — |
| 9 | erro interno (bug) | escala com a saída | abre um nó no `zeno/` |

Aprovação no chat **não conta**. Só um evento assinado no ledger muda um gate.

**O teto diário começa em zero dólar.** O `install` escreve `orcamento.teto_diario.usd: 0` no `sistema.yaml`. Assim, o
primeiro gasto em dólar registrado no dia bloqueia o alvo com o código 4 até a virada do dia UTC. Para um gasto pago
pontual, a pessoa libera o dia com `zeno gate --teto usd=+X` (T93): o acréscimo vale só no dia UTC em que ela assinou, e
o `sistema.yaml` não muda. Um gasto que passa do teto liberado estoura de novo. Se o alvo vai registrar gasto pago todo
dia, a pessoa sobe o teto no `sistema.yaml`.

```sh pessoa
zeno gate --teto usd=+5
```

**Qual dos três deu o 4?** A mensagem diz:
- "disjuntor: <id> pausado (…)" ou "<id>: gate de <fase> reprovado: … — disjuntor disparou" é o disparo. O disjuntor
  confere o consumo quando um gasto é registrado e quando um gate `check` é reprovado;
- "<id> está pausado pelo disjuntor (…)" aponta o nó pausado, que pode ser um ancestral;
- "teto diário do alvo estourado (…)" é o teto diário, que não pausa nó nenhum. A mensagem diz como liberar o dia.

Só o disjuntor pausa um nó, e só um evento assinado de pessoa o tira da pausa (T98): `zeno gate <id> --orcamento
dim=+N`, que sobe o teto, ou `zeno gate <id> --despausar --motivo "…"`, que solta sem subir. Baixar o orçamento com o
`ajustar` segue livre, mas não despausa. Enquanto o nó está pausado, nem o `avancar` nem um `gate` o mudam, e o
`zeno validar` acusa `pausado`.

### A trava do código 5

A trava é o arquivo `.agents/.zeno.lock`, criado de forma exclusiva com o pid e a hora de quem a pegou. Ela vale só
nesta máquina. A CLI espera até 5 s por ela e só então sai com 5. Uma trava órfã é assumida sozinha, sem apagar nada,
e a chamada que a assumiu registra o evento `trava.assumida` quando grava no ledger. Órfã quer dizer: o pid morreu, a
trava passou de 60 s (mesmo com o dono ainda vivo) ou o arquivo não dá para ler. Por isso uma trava "presa" não pede
ação: rode de novo. Não apague o lock à mão: o `rm` é negado ao agente, e só o processo dono solta a trava, no fim da
chamada.

## Quando um hook nega

Na porta do Claude Code, um hook roda antes de cada comando de shell, de cada edição (`Edit`, `Write`, `MultiEdit`,
`NotebookEdit`) e, desde a T99, de cada ferramenta MCP (`mcp__…`): `zeno guarda pre-tool || exit 2`. Ele nega, por
exemplo:
- escrita por shell num arquivo protegido: o ledger, o fio, o `gerados.lock`, o `sistema.yaml`, o `faixas.yaml`, o
  `CLAUDE.md`, o `.claude/settings*.json`, a cópia fixada e o shim da pessoa. Ler passa;
- um verbo de pessoa (`gate`, `chave`, `promover`, `caixa --aprovar`) e o `guarda`, que é só do hook (no
  `zeno ajuda --json`, `quem: "hook"`, T92), também na forma `node …/cli.mjs`;
- definir, exportar ou apagar `ZENO_ATOR`, `CLAUDECODE` ou `CLAUDE_CODE_SESSION_ID`. A última diz de qual sessão a CLI
  mede o gasto (T103);
- reescrever o histórico: `--no-verify` (no `commit`, `push`, `merge`, `rebase`, `am` e `cherry-pick`),
  `git commit --amend` ou `-n`, `git rebase`, `filter-branch`, `filter-repo` e `git reset` com `--soft`, `--hard`,
  `--mixed`, `HEAD~` ou `HEAD^`;
- o comando que o tokenizador de shell não entende;
- um servidor MCP fora da lista `mcp:` do `sistema.yaml` e do `mcp:` do perfil do agente em `agentes:` (regra
  `mcp-fora-da-lista`, T99). Sem a lista, o padrão é nenhum servidor;
- com `sessao_obrigatoria: true` no `sistema.yaml`, **toda** ferramenta aberta fora do `zeno sessao` (T82).

O `rm` também é negado, pelo deny do `.claude/settings.json` (`Bash(rm:*)`). O que sai vai para `_lixo/`. O mesmo deny
leva `mcp__<servidor>` para os servidores MCP que escrevem fora da máquina e eram conhecidos em 2026-11-03. São eles
Gmail, Drive, Calendar, Canva, Claude Docs, Vercel, AWS, monday, Cloudflare e Chrome, menos os que o alvo ou um perfil
lista.

**Código que escreve e cita um arquivo protegido (T109).** A guarda de shell olha o código de um `node -e`, de um
`python -c` ou de um here-doc para intérprete. Ela nega quando o código tem uma API de escrita (`writeFile`,
`open(…, 'w')` e afins) **e** cita um caminho protegido em qualquer lugar. Por isso um código que escreve num arquivo comum um texto que só **menciona** um
protegido também é negado, como `arquivo-protegido`. É um falso positivo aceito: o caminho chega à API por variável, e
separá-lo do texto pediria um parser por linguagem ou afrouxaria a guarda. O porquê da negação diz isso. O conserto é
editar o texto com o `Edit` ou o `Write`, e nunca pelo shell.

**Para liberar um servidor MCP num alvo.** É decisão da pessoa, porque o `sistema.yaml` é protegido. Ponha
`mcp: [<servidor>]` no `sistema.yaml`, ou o `mcp:` no perfil do agente, e rode `zeno sync`. O hook e o deny dos MCP só
valem depois do `promover` da T99 e de um `zeno sync` em cada alvo. Até o `sync`, o `sync --check` acusa deriva no
`.claude/settings.json`. Fora de um alvo do Zeno (o `conhecimento/`, por exemplo), nada disso vale.
Num alvo adotado, como a `avaliacao/`, vale só na máquina que tem o `.claude/settings.local.json` gerado.

**E se o próprio zeno falhar no hook?** O hook falha **fechado**: com o zeno ausente ou quebrado, o `|| exit 2` nega a
ação. Isso vale para todo comando de shell, toda edição e, desde a T99, toda ferramenta MCP. Com
`sessao_obrigatoria: true`, vale para toda ferramenta. Um
hook que quebra trava o agente em vez de liberar tudo. Por isso o `sync` recusa gerar os hooks quando o `zeno` não está
no PATH ou quando o teste de fumaça do `zeno guarda pre-tool` falha. A sonda `hook-fail-closed` prova esse
comportamento ([referência](../referencia.md#as-guardas-do-zeno)).

Três coisas o hook quebrado **não** fecha:
- **a web:** o hook que marca a contaminação roda **depois** da ferramenta. Sem `sessao_obrigatoria`, a web roda, e a
  marca não é gravada. O MCP, desde a T99, é negado antes, pelo `pre-tool`;
- **o fim da sessão:** esse hook usa `|| true` e nunca bloqueia. Com o zeno quebrado, a marca daquela sessão não some
  sozinha;
- **o fim da conversa:** o hook `Stop` (T113) também usa `|| true`. Com o zeno quebrado, a deixa do hábito só não
  aparece.

**A deixa no fim da conversa (T113).** Quando o agente para de responder, o hook `Stop` lê o transcript. Ele age quando houve edição
de arquivo do alvo fora de `.agents/`, ou um `git commit`, e nenhum comando tocou nó (`zeno novo`, `avancar`,
`registrar`, `msg`, `ajustar`, `revisar` ou `contexto <id>`). Aí ele devolve o turno ao agente uma vez, com o
`zeno registrar "…" --retro` pronto, e grava uma `recusa` com a regra `sem-no`. O agente troca os `<…>` e roda o
registro. Na segunda parada, o hook não bloqueia mais: ele nunca impede a parada e nunca cria nó sozinho.

Como sair da trava:
- **O agente** não consegue rodar nem o `zeno msg`, porque todo comando de shell é negado. Ele diz na conversa o que foi
  negado e para.
- **A pessoa**, no terminal dela e fora do Claude Code, confere `zeno versao` e o PATH. O `command -v zeno` tem de dar
  `~/.local/bin/zeno`, que é o único shim que o `promover` troca. Se `~/.local/share/zeno/atual` existe, o `promover`
  já rodou, e o `head -2 ~/.local/bin/zeno` mostra a linha "GERADO pelo zeno promover". Com a cópia do root
  (`/opt/zeno`, T95), o `zeno` do PATH é o `/usr/local/bin/zeno`, e o shim da casa foi para o `_lixo/`: ali o conserto é
  do bloco C do [roteiro da T82](../../spec/roteiro-t82.md). Na casa, o conserto depende do `promover`:
  - **antes do primeiro `zeno promover`**, o shim é o link para o `bin/zeno` do clone. Se ele sumiu, ligue-o de
    novo ([Instalar](instalar-num-repo.md#1-ponha-o-zeno-no-path-de-vez)). A partir da cópia promovida com o conserto
    (7c5ed43), a mensagem do `sync` distingue os dois casos: sem cópia fixada, ela manda o `ln -s` do clone; com cópia
    fixada, manda pôr no PATH o shim do `promover`. Uma cópia promovida antes disso ainda dá o `ln -s` nos dois casos;
  - **depois do primeiro `zeno promover`**, o `~/.local/bin/zeno` é um arquivo gerado que roda a cópia fixada. **Não
    o troque pelo link do clone**: assim os hooks voltariam a rodar o código que o agente edita, e a cópia fixada
    deixaria de valer. Se o shim sumiu ou se a própria cópia fixada é o que quebrou, rode o `promover` pelo código do
    clone, no diretório de um alvo: `node <caminho do clone>/cli.mjs promover --de <caminho do clone>`. É uma
    promoção inteira: pede o código commitado, a passphrase e de 1 a 2 minutos de testes e censo no bwrap. Ela promove
    o HEAD do clone, que pode ser mais novo que a cópia em uso, e grava o shim de novo.
  - Um `zeno` que quebra é um bug, e o conserto vira um nó no `zeno/`. O código novo só passa a guardar depois do
    `zeno promover`.

## Quando o `validar` ou o pre-commit acusa

O `zeno validar` e o pre-commit que o chama dizem a regra. Num alvo, o pre-commit é o `.agents/githooks/pre-commit`
que o `sync` gera e liga num clone livre (T97,
[Instalar](instalar-num-repo.md#5-ligue-a-chave-a-cópia-fixada-e-os-checks)). Num clone com hooks próprios, o
`aviso githooks` pede para encadear o gerado. Um hook seu que o chama (`exec sh .agents/githooks/pre-commit`) e a chave
`githooks_encadeado` calam o aviso (T116). Os consertos das regras mais comuns:

| Regra | Quer dizer | Conserto |
|---|---|---|
| `projecao` | um campo de controle do frontmatter do nó (por exemplo `estado`) não bate com o ledger. O frontmatter é só uma vista, e editá-lo à mão não muda o estado | `zeno validar --reparar` regrava a vista de cada nó a partir do ledger. Os campos descritivos e o corpo ficam. Para mudar o estado de verdade, use o verbo: `zeno avancar`, ou `zeno ajustar <id> estado=cancelado`, que fora da faixa `autonoma` é de pessoa, com `--motivo` e assinado |
| `aprovado-mudou` | uma seção mudou depois de aprovada, e o gate dela ainda não foi reaberto | `zeno avancar <id>` reabre o gate daquela fase e sai com 3. Depois a mudança vira só aviso, e a pessoa aprova de novo na caixa. O gate reaberto não pede cartão. Com outro gate do nó já aberto, o `avancar` só devolve 3: decida aquele antes, ou retire-o com `zeno revisar <id> --motivo "…"`, que só vale com o nó em gate. A outra saída é desfazer a mudança na seção |
| `sem-no` | commit de agente com arquivo fora de `.agents/`, sem evento novo de nó no ledger do índice e sem nó em Execução (T113). Para a pessoa, e para o ator que o zeno não reconhece, é só aviso. Merge não conta | o agente roda o `zeno registrar "…" --retro …` que a mensagem traz, troca os `<…>`, põe o `.agents/ledger.jsonl` no commit e tenta de novo. Da próxima vez, abre o nó antes da primeira edição |
| `deriva` | um gerado (`CLAUDE.md`, `.claude/settings.json`) não bate com o canônico. A saída diz o tipo: **segurança** (`.claude/settings*.json`, `.mcp.json`, `.agents/githooks/`, `.git/`) vem antes de **forma** (o resto) (T106) | mude o canônico (`AGENTS.md`, `.agents/`) e rode `zeno sync`, que regrava o gerado. O `sync` não é verbo de pessoa: o agente pode rodá-lo. A edição à mão se perde. Um gerado que saiu do plano vai para `.agents/_lixo/`. Um arquivo que não é gerado nem está em `local` o `sync` não sobrescreve: mova-o para `_lixo/` ou declare-o em `local`. A deriva em `.git/config core.hooksPath` é o gate de commit do clone: o clone está livre e ainda não foi ligado (rode `zeno sync`), ou o Zeno o ligou e ele saiu (volte com `git config core.hooksPath …` ou aceite a saída com `git config --unset zeno.githooks`) |

## Escalar

Uma escalada tem três campos obrigatórios: o que travou, o que já foi tentado e do que precisa.

```sh executavel
cd "$(mktemp -d)"   # um diretório descartável
git init -q -b main alvo && cd alvo && zeno install . > /dev/null
zeno novo "Publicar a versão" --tamanho M > /dev/null
DONO=$(sed -n 's/^  dono: //p' .agents/sistema.yaml)   # o id da pessoa dona do alvo
zeno msg publicar-a-versao escalada --para "$DONO" \
  --travou "o hook negou o push para a main" \
  --tentado "rodei os testes, que passaram; o push foi negado pela guarda" \
  --precisa "uma pessoa decidir se o push vai agora"
```
```text saida
m-
```

A saída é o id da mensagem. A escalada aparece na caixa da pessoa (`zeno caixa`) e conta como atrito no Aprendizado
do nó.

**Não contorne.** Um script que faz o que o comando negado faria, uma troca de ferramenta ou uma variável que esconde o
caminho são contornos. A regra continua valendo onde o hook não pega, e a spec declara esses lugares
([resíduos](../../spec/seguranca.md#resíduos-declarados)).
