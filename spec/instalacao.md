# Instalação

## Sentido único (D12)
**Canônico** (editado por gente e pela CLI): `AGENTS.md` e `.agents/`.
**Gerado** (só pelo `zeno sync`): `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/zeno-*/`. (`.mcp.json` não existe no
Inc. 1: o Zeno não tem MCP ainda.) Nunca do gerado para o canônico.

O alvo leva **só dados** (D28): nenhum `.mjs` do Zeno vai para o alvo. Hooks gerados chamam `zeno` do PATH.

## `.agents/sistema.yaml`

```yaml
zeno: 1
alvo: zeno                   # nome curto do alvo: entra no ledger e nas refs "<alvo>:<id>"; padrão = a pasta do alvo,
                             #  e num worktree ligado a do checkout principal (git-common-dir), ou --alvo-nome (T77)
fronteira: pessoal           # pessoal | empresa | cliente  (empresa/cliente: ids opacos, nada sai — D15/D18;
                             #  pessoas em hash no disco, sal e nomes em ~/.config/zeno/sal/<alvo>.sal — T73)
modulos:
  nucleo: 0.1.0              # versão FIXADA (D11); atualizar = ação modulo.atualizar (faixa aprovacao)
pessoas:
  filipe:
    git: filipeandrade.work@gmail.com
    chave_pub: "MCowBQYDK2VwAyEA…"   # Ed25519 (zeno chave nova); sem ela, nenhum gate humano pode ser decidido;
                                     # o install a grava null e só dá a dica (T112): zeno chave pub se a chave
                                     # já existe na casa (confere o arquivo, sem abrir), zeno chave nova se não
agentes: [ia:claude]          # ou o registro com perfil (T82): "ia:claude": { comando, hosts, portas, env, le, credenciais, escreve, config_dir }
sessao_obrigatoria: false    # T82: true = o hook nega toda ferramenta fora do zeno sessao (roteiro da T82, passo 6)
mcp: []                      # T99: os servidores MCP que o agente usa aqui (ex.: [claude_ai_Claude_Docs]); ausente = nenhum;
                             # um perfil em agentes: estende ("ia:claude": { mcp: [...] }); o sync gera o hook e o deny
githooks_encadeado: .githooks # T111: a pasta dos hooks do repo que já rodam o gate de commit; ausente = o aviso de encadear
padrao:
  dono: filipe
  revisor: filipe
delegacao_padrao:            # o contrato de delegação dos nós P (fases.md)
  ferramentas: "as permitidas no .claude/settings.json do alvo"
  fronteira: "só este alvo"
  parada: "o próximo gate, ou o orçamento"
  checagem: "reler o pronto antes de começar"
checks:                      # comandos nomeados que um gate check pode rodar (só daqui: nó nenhum traz comando)
  testes: "node --test"
checks_padrao: [testes]      # usados na Verificação de nó que não nomeia checks
# ferramentas: [git, gh]     # opcional (T107): sobrescreve a detecção das ferramentas de terminal (zeno ferramentas)
limites:
  P_linhas: 80               # contramétrica do tamanho declarado (fases.md, Entrega de P)
orcamento:
  teto_diario:
    usd: 0                   # 0 = teto zero: qualquer gasto em dólar dispara
    tokens: null             # null ou ausente = sem teto; o Filipe define
local: []                    # modo adoção: caminhos do harness que já existia, nunca sobrescritos
gerar:
  claude: true               # gerar o adaptador do Claude Code
```

## Módulo (D9/D11)
Um módulo é uma pasta `zeno/modulos/<nome>/` com `modulo.yaml`:

```yaml
nome: nucleo
versao: 0.1.0
obrigatorio: true
agents_md: agents-md.md      # fragmento que vira o bloco gerado no AGENTS.md
skills:                      # skill → fases em que ela entra no pacote de contexto
  zeno: [intencao, especificacao, execucao, verificacao, entrega, observacao, aprendizado]
cartoes: cartoes/            # um <fase>.md por fase
faixas: faixas.yaml          # linhas da tabela de faixas que o módulo traz
lint: lint.yaml              # termos do lint "autossuficiente"
requisitos_de_prova:         # o módulo DECLARA; a prova é da avaliacao/ (D17)
  - guardas: ../../guardas.json
templates: {}                # templates de artefato por fase (vazio no nucleo)
```

O `nucleo` do Inc. 1 traz: os 7 cartões, a skill `zeno` (como usar a CLI e o loop), as linhas de faixa de
[controle.md](controle.md), o lint e o fragmento do `AGENTS.md` (o loop em 10 linhas + "toda escrita de estado pela CLI").

## O que o `sync` gera

| Gerado | Conteúdo | Cabeçalho |
|---|---|---|
| `CLAUDE.md` | `@AGENTS.md` | `<!-- GERADO pelo zeno sync; não edite. Fonte: AGENTS.md -->` |
| `.claude/skills/zeno-<skill>/SKILL.md` | cópia da skill do módulo (cópia, sem symlink: WSL/Windows) | comentário no topo do corpo |
| `.claude/settings.json` | `permissions.deny` com `Edit(/<rel>)`, sem caminho do checkout (camada 1, T69) e os hooks `PreToolUse` (Bash e Edit/Write), `PostToolUse`, `SessionEnd` e `Stop` (camada 2, a deixa do hábito, T113) de [seguranca.md](seguranca.md) | JSON não tem comentário: o cabeçalho é a entrada no `gerados.lock` |
| bloco no `AGENTS.md` | o fragmento de cada módulo entre `<!-- zeno:inicio <modulo> -->` e `<!-- zeno:fim <modulo> -->` | os próprios marcadores |

- Tudo fora dos marcadores do `AGENTS.md` é **manual** e o `sync` preserva byte a byte.
- `.agents/gerados.lock`: uma linha por gerado, `<sha256>  <caminho>  <fonte>`. É a prova do que o `sync` escreveu.
- **Deriva** (`zeno sync --check`, no pre-commit): o `sync` gera em memória e compara com o disco; qualquer diferença num
  gerado (ou num bloco gerado) é deriva ⇒ saída 1 com a lista. Corrigir = mudar o canônico e rodar `zeno sync`.
- O `sync` recusa sobrescrever um arquivo que existe, não está no `gerados.lock` e não está em `local` (saída 1): nada
  escrito à mão some.

## Modo adoção (`zeno install --adocao`)
Para alvo que já tem harness (`CLAUDE.md`, `.claude/`, `AGENTS.md`):
1. Cada caminho de harness que já existe entra em `sistema.yaml → local` e **nunca** é sobrescrito: `CLAUDE.md`,
   `.claude/settings*.json`, `.mcp.json`, cada item de `.claude/` (cada skill de `.claude/skills/`), `bench/`, `scripts/`
   e os `.md` da raiz (T77). O `AGENTS.md` fica fora, com o porquê num comentário do `sistema.yaml`: é do repo, e o Zeno
   mantém só o bloco dele (item 2).
2. `AGENTS.md` existente: o `install` só acrescenta os blocos gerados no fim; o resto vira o bloco manual. **T83 (D39):**
   quando o alvo é adotado (T94: com ou sem `settings.json` do repo) e o Zeno gera o `settings.local.json` (a porta do Claude Code), o bloco
   **não** entra no `AGENTS.md` commitado: ele chega ao agente pelo hook `SessionStart` (`zeno contexto --bloco`) do
   mesmo arquivo das travas. Assim a instrução existe exatamente onde o deny e os hooks existem; o time, a CI e o Claude na
   nuvem não leem regras de um Zeno que não têm. O bloco de uma adoção antiga sai do `AGENTS.md` no próximo `sync`, e o
   resto fica byte a byte. A saída do `SessionStart` entra no contexto como texto (teto documentado de 10.000
   caracteres). Uma sessão aberta numa subpasta, ou antes do `sync`, pode ficar sem o bloco **e** sem as travas, o que é
   coerente: não é governada. Outra ferramenta recebe o bloco pela porta dela, com o contrato mínimo de
   [portas](portas.md#o-contrato-mínimo-de-uma-porta-t83); sem porta, nem bloco nem travas.
3. `CLAUDE.md` existente e local: o `sync` não o gera. Se ele não importa `@AGENTS.md`, `sync` avisa (não falha) e mostra
   a linha a acrescentar à mão.
4. `.claude/settings.json` existente e local: o `sync` não o toca; as regras do Zeno (deny da camada 1 e os hooks da
   camada 2) vão num `.claude/settings.local.json` gerado, por máquina e fora do git (T74). O deny cobre só o que é do
   Zeno e os dois settings; o resto do harness segue as regras do repo. Se já existe um `settings.local.json` manual, o
   `sync` recusa sem tocar. Quem abre sessão sem esse arquivo (o time, outra máquina) não é governado pelo Zeno.
   O `settings.local.json` fica fora do git pela linha `/<prefixo>.claude/settings.local.json` que o `sync` põe no
   `info/exclude` do clone (no `git-common-dir`: local, não versionado, vale para os worktrees), sem tocar o
   `.gitignore` do repo; o `sync --check` acusa `.git/info/exclude` se a linha faltar (T77). O `zeno status` procura as
   camadas 1–2 nesse arquivo (no `gerados.lock`), não no `settings.json` do repo.
   **T112:** antes de escrever, o `sync` pergunta ao git (`check-ignore --no-index`) se o arquivo já é ignorado pelas
   regras do repo; o ignore global da pessoa não conta. Se um `.gitignore` já cobre, nada se escreve e o `sync --check`
   não acusa. Num worktree ligado (`git-dir` ≠ `git-common-dir`) não existe exclude por worktree: a linha vai no
   `info/exclude` do checkout principal, e a saída diz isso, com o caminho e como tirá-la (apagar a linha).
   **T94:** a adoção é um fato gravado. O `install --adocao` escreve `adocao: true` no `sistema.yaml`, e um repo
   adotado **sem** `.claude/settings.json` segue o mesmo caminho: as regras vão no `settings.local.json`, e o `sync` não
   gera nem `settings.json` nem `CLAUDE.md` versionados. Antes, esse repo caía no ramo do alvo novo e ganhava um
   `settings.json` commitado, com hooks que negam tudo a quem clona sem o `zeno` no PATH. Os alvos adotados antes da
   T94, sem o campo, seguem reconhecidos pelo `settings.json` no `local`.
   **T113 (fiação versionada):** no alvo `pessoal` adotado **sem** `settings.json` próprio, a fiação passa a ser o
   `.claude/settings.json` versionado e gerado, com o mesmo conteúdo do local (deny, hooks e `SessionStart`); um clone
   novo já nasce com as travas e a deixa. O `settings.local.json` gerado antes vira órfão e vai para `.agents/_lixo/`;
   o `CLAUDE.md` segue não gerado (o `AGENTS.md` é do repo, e o bloco vai pelo `SessionStart`). O preço é o da T94 ao
   contrário: num clone sem o `zeno` no PATH (nuvem, outra máquina, colega), os hooks negam comando e edição. A saída é
   `fiacao: local` no `sistema.yaml` (é da pessoa), que devolve a fiação ao `settings.local.json`. `empresa` e
   `cliente` ficam sempre no local. Com `settings.json` próprio, a fiação fica no local, e o `sync` e o `sync --check`
   avisam "fiação por máquina" (aviso, não deriva; `fiacao: local` cala).
5. Skills: na adoção o Zeno **não** gera skill em `.claude/skills/` (T81): o `.claude/` é do repo, e o harness dele pode
   governar as skills (ex.: exigir regra de ativação). O texto da skill chega ao agente pelo `zeno contexto` (lido do
   módulo), e o bloco do `AGENTS.md` manda usá-lo. Gerado que está no `gerados.lock` e saiu do plano (a `zeno-*` de uma
   adoção antiga) é órfão: o `sync --check` o acusa, e o `sync` o move para `.agents/_lixo/` (e tira a pasta, se ficou
   vazia). Fora da adoção, as skills do Zeno vão com prefixo `zeno-` e não colidem com as do alvo.
6. Migrar aos poucos: tirar um caminho de `local` (editando o `sistema.yaml`, que é canônico) faz o próximo `sync`
   assumir aquele arquivo. Se o arquivo no disco não bater com o gerado, o `sync` recusa até alguém mover a versão antiga
   para `_lixo/`.

## Registro de alvos da máquina (T104)
A máquina sabe quais alvos existem (H9, H21). O registro fica **fora de qualquer git**, porque cita caminhos de repos
da empresa, na pasta da cópia fixada da pessoa (`~/.local/share/zeno/`):
- **`alvos.json`:** a lista (`{ "zeno": 1, "alvos": [{ "caminho", "nome", "registrado" }] }`), escrita só pela CLI:
  - o `install` registra cada alvo novo;
  - `zeno alvos --descobrir <pasta>…` registra os que já existiam;
  - `zeno alvos --esquecer <caminho>…` tira um da lista.

  Pôr ou tirar da lista não afrouxa nada, porque as guardas moram no alvo. Por isso o agente pode fazê-lo. A troca é
  atômica (arquivo temporário e `rename`). Num worktree ligado, o install não registra: ele recebe pelo merge do
  checkout principal.
- **`regras.yaml`:** as regras por pasta, da pessoa:
  ```yaml
  zeno: 1
  regras:
    "~/repos/empresa/**": empresa
    "~/repos/cliente-a/**": cliente
  ```
  A chave é um glob entre aspas (`~` é a casa, `*` não passa de `/`, `**` passa); o valor é `pessoal`, `empresa` ou
  `cliente`. No modo root vale também o `regras.yaml` da raiz do root (só o root escreve). As regras dos dois arquivos
  valem juntas, e mais regra só aperta.

**A fronteira efetiva** de um alvo é a mais restrita (`pessoal < empresa < cliente`) entre a declarada no `sistema.yaml`
e todas as regras que casam. Sem nenhuma das duas, vale `cliente` (fail-closed, H21). Uma regra nunca afrouxa a
fronteira declarada. A efetiva serve só à frota e às telas: ela não muda o comportamento dentro do alvo. A composição em
3 níveis é do médio prazo; até lá, o core segue lendo o `sistema.yaml`, e o `config.mjs` ainda assume `pessoal` quando a
fronteira falta.

**Fail-closed da frota:** com a lista ou as regras ilegíveis (JSON quebrado, YAML fora do subconjunto, fronteira
desconhecida), nenhum alvo `opera`. O install segue e avisa, porque o registro não guarda nada.

**Quem escreve:** a lista, a CLI. As regras, a pessoa. As duas são negadas ao agente por ferramenta de arquivo (guarda
`registro-maquina`) e pelo shell (a guarda de shell fecha a pasta da cópia fixada). Dentro do `zeno sessao`, a pasta
fica fora do alcance: o install isolado avisa, e o `--descobrir`, rodado fora da sessão, completa a lista.

## O `zeno/` como alvo de si mesmo
- `zeno/.agents/` guarda o grafo do próprio Zeno (dogfood do Inc. 1).
- `zeno/AGENTS.md` já existe e é manual: a instalação no `zeno/` é **em adoção**.
- Observação (probe do mapa "AGENTS.md de subpasta"): numa sessão aberta em `zeno/` (2026-11-02), o `zeno/AGENTS.md`
  **não** entrou no contexto inicial; entraram só o `CLAUDE.md` e o `AGENTS.md` da raiz. Causa provável, pela doc
  verificada na grelha: o Claude Code só lê `AGENTS.md` nativamente onde não há `CLAUDE.md` no diretório ou acima. O
  `zeno/CLAUDE.md` gerado (`@AGENTS.md`) resolve nos dois casos. Gerar `zeno/CLAUDE.md` e `zeno/.claude/settings.json`
  mexe no harness da sessão: só com o OK explícito do Filipe (Etapa 2).
- Ordem do dogfood: `install --adocao --sem-sync` no `zeno/` assim que `novo` existir (só `.agents/`); o `sync` vem depois,
  com o OK do Filipe e o shim no PATH.
- O Obsidian não indexa pasta com ponto (`.agents/`). Ver o grafo no Obsidian pede uma visão gerada ou um vínculo do vault
  (Inc. 3, quando o vault virar alvo); no Inc. 1 a tela é `zeno status`.

## Hooks de git de um alvo (T97)
O `sync` gera `.agents/githooks/pre-commit` e `pre-merge-commit`: `zeno validar --staged && zeno sync --check`, pela
cópia do root (`/opt/zeno`), pela da casa ou pelo `zeno` do PATH, nessa ordem. Sem nenhum deles, o hook **falha
fechado**. Os dois arquivos são gerados, versionados, executáveis, ficam no `gerados.lock` e nos protegidos (o agente não
os edita por ferramenta). `gerar: { githooks: false }` no `sistema.yaml` desliga a geração.

Ligar é config local do clone, fora do git:
- **Clone livre** (sem `core.hooksPath` em nenhum escopo e sem hook ativo em `.git/hooks`): o `sync` põe
  `core.hooksPath=<prefixo>.agents/githooks` e a marca `zeno.githooks` na config local.
- **Clone com hooks próprios** (husky, lefthook, um `core.hooksPath` global, um roteador como o do monorepo): o `sync` não
  toca em nada e avisa a linha para encadear (`sh <prefixo>.agents/githooks/pre-commit`).
- **Gate já encadeado (T111):** quando os hooks do repo já rodam o gate, a pessoa declara a pasta deles no `sistema.yaml`
  (`githooks_encadeado: .githooks`, relativa ao alvo). O `sync` confere que `<pasta>/pre-commit` e
  `<pasta>/pre-merge-commit` existem e chamam `validar --staged` e `sync --check`. Se sim, o `sync` diz "gate de commit
  coberto por …" e o `sync --check` cala; se não, o aviso nomeia o arquivo ou o comando que falta. A chave não muda o
  `core.hooksPath` nem os gerados. Só a pessoa a escreve, porque o `sistema.yaml` é protegido. O resíduo: a conferência
  lê o texto do hook e não prova que o roteador o chama. **T116:** cobre também o hook que chama o gerado de mesmo nome
  (`exec sh .agents/githooks/pre-commit`, ou `sh`, `bash` ou `exec` com esse caminho, com ou sem prefixo de pasta),
  porque o gerado já roda as duas checagens. Só conta linha de comando: o caminho num comentário não cobre.
- O `sync --check` acusa `.git/config core.hooksPath` em dois casos: o clone está livre e ainda não foi ligado, ou o Zeno
  ligou e o `core.hooksPath` saiu dali. Se ele foi posto em outro lugar por alguém, o `sync` não o troca. O aviso diz como
  voltar (`git config core.hooksPath …`) ou aceitar a saída (`git config --unset zeno.githooks`).
- O resíduo: um processo do uid da pessoa desliga tudo com um `git config` (o hooksPath e a marca). É local por clone e
  não trava quem clona sem o Zeno, porque esse clone não tem a config.

## Hooks de git do `zeno/`
`zeno/.githooks/pre-commit` e `pre-merge-commit` (o roteador da raiz chama com cwd = `zeno/` quando o commit toca
`zeno/` ou o topo): `validar --staged` e `sync --check` no alvo `zeno/`, pela cópia fixada quando ela existe (a do root,
depois a da casa; sem nenhuma, pelo `./cli.mjs`, T68), e `node ./cli.mjs validar --codigo .`, mais as checagens do
código ([seguranca.md](seguranca.md)). Com `githooks_encadeado: .githooks` no `zeno/.agents/sistema.yaml`, o `sync` do
`zeno/` reconhece esses dois hooks como o gate de commit (T111). Enquanto o `zeno/` não tiver `.agents/` instalado, os dois pulam (não há alvo).
Git só com `--relative`/`--show-prefix`; com `GIT_DIR` exportado (commit em worktree) o roteador já exporta `GIT_WORK_TREE`.
