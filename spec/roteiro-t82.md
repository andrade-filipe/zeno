# Roteiro da T82 (o que é seu: login, root e duas decisões)

O agente fez a parte que não pede você: o `zeno sessao`, o registro `agentes:`, o ator pelo marcador, o hook
`sem-sessao` e as guardas no censo ([T82](decisoes-tecnicas.md)). O resto está em três blocos independentes. Rode cada
um **no seu terminal, fora de qualquer sessão de agente**. Se um passo não bater com o "esperado", pare ali e me diga qual.

| Bloco | O que faz | `sudo` | Tempo | Quando |
|---|---|---|---|---|
| **A** | o agente abre isolado, com login próprio | não | ≈10 min | já |
| **B** | o sandbox do Claude Code em toda sessão | 1 | o roteiro do hub (T0 a T16) + uma sessão de trabalho real | quando quiser |
| **C** | a cópia que guarda passa a ser do root | 6 linhas | ≈5 min | depois que o nó `o-promover-com-a-copia-de-dono-root` (T95) for promovido |

Uma semana depois do A, sem atrito: a trava (`sessao_obrigatoria`, fim da página).

---

## Bloco A: o agente abre isolado (sem `sudo`, ≈10 min)

**Cartão**
- **Muda:** o `claude` abre por `zeno sessao ia:claude`, sem a sua casa, sem o Windows, com a rede só pelo proxy e com
  login próprio dentro do sandbox (na sua conta, decisão A1).
- **Porquê:** a T80 achou que um agente desviado alcança a sua chave e a passphrase (a C1).
- **Risco:** baixo. Uma ferramenta pode precisar de um host fora da lista na 1ª semana; o `sessao.fechada` mostra qual.
- **Desfazer:** abra o `claude` como antes. Nada fica ligado até a trava do fim da página.
- **Decidido:** a conta do agente (A1, logo abaixo): a opção (3), em 2026-11-03.
- **Rodado pelo Filipe em 2026-11-03:** a sessão fechou às 12:04:53Z com código 0, 34 conexões permitidas e 1 negada,
  `http-intake.logs.us5.datadoghq.com:443`, que é a telemetria do Claude Code. **Essa negação é esperada e de propósito:**
  menos dado sai da máquina, e o claude funciona sem ela. Não a ponha na allowlist.

### A1. Decisão: a conta do agente e os conectores do claude.ai

**Decidida pelo Filipe em 2026-11-03: a (3), a conta dele como está, aceitando o resíduo.** O resíduo fica declarado em
`seguranca.md` como C1 (ii). Reabre se o agente rodar sem supervisão (Inc. 4) ou se mudar a conta. A tabela abaixo
mostra as opções que foram pesadas.

**Reaberta em 2026-11-03.** As sessões da noite já rodam sem ninguém olhando, e o Filipe pediu conexões e MCP em
escopos cada vez mais específicos. A proposta está no nó `conectores-e-mcps-so-por-allowlist-do-al`. Até ela ser
promovida, o paliativo antes de deixar trabalho para a noite tem **dois lugares**, porque as ferramentas chegam por dois
caminhos:
- **no claude.ai** (os conectores da conta): desligar Gmail, Drive, Calendar e Canva;
- **no Claude Code desta máquina** (servidores MCP locais, que o switch do claude.ai não alcança): desligar `vercel`,
  `aws-mcp` e `monday` (pelo `/mcp`, ou tirando-os da config local). Sem isso, uma sessão da noite ainda faz deploy na
  Vercel ou roda script na conta AWS.

**Depois do `promover` da T99 e de um `zeno sync` em cada alvo**, o hook do Zeno nega todo MCP fora da lista `mcp:` do
`sistema.yaml` (padrão: nenhum), e o settings gerado leva o deny dos de escrita. Nas raias com o Zeno, o paliativo deixa
de ser preciso. Ele segue valendo para uma sessão aberta fora de um alvo (o `conhecimento/`, a `avaliacao/`). Para
liberar um servidor num alvo: `mcp: [<servidor>]` no `sistema.yaml`, ou o `mcp:` no perfil do agente, e depois `zeno sync`.

Os conectores do claude.ai (Gmail, Drive, Calendar, Vercel, AWS, Canva, monday…) chegam ao agente **pela conta em que ele
faz login**. Nenhum sandbox local os contém: o pedido sai pela API, não pela sua máquina.

| Opção | O que sobra | Custo |
|---|---|---|
| **(1) Outra conta para o agente**, sem conectores | nada dos conectores; o agente vê só o repo | outra assinatura do Claude, por mês |
| **(2) A sua conta, com os conectores desligados** | nada dos conectores enquanto ficarem desligados | você também os perde no claude.ai e no app, até religar |
| **(3) A sua conta como está** (aceitar o resíduo) | o agente lê e escreve no seu Gmail, Drive e nuvem, se for desviado | zero; fica declarado em `seguranca.md` como C1 (ii) |

Recomendo a **(1)** se a assinatura couber: é a única que fecha sem tirar nada de você. Se não couber, a **(2)** só para
os conectores que escrevem (Gmail, Drive, Vercel, AWS) já corta a pior parte. A (3) é o estado de hoje.

### A2. O perfil no `sistema.yaml` (o canônico é seu; o agente não o edita)
Troque a linha `agentes: [ia:claude]` por:
```yaml
agentes:
  "ia:claude":
    comando: [claude]
    hosts: [api.anthropic.com, .anthropic.com, .claude.ai, .claude.com, github.com, .githubusercontent.com]
    portas: [443]
    env: [COLORTERM]
```

### A3. Conferir o plano e abrir
```sh
cd ~/repos/filipe-andrade/context-engineering/zeno
zeno sessao ia:claude --plano | head -c 300; echo     # esperado: bwrap --unshare-user … --unshare-net …
zeno sessao ia:claude                                 # o claude pede login: a sua conta (A1, opção 3)
```
Não há navegador lá dentro: escolha a opção de colar o código do login.

**Dentro, confira** (esperado):
- `ls ~/.config` → não existe;
- `ls /mnt` → vazio;
- `cat /run/zeno-agente` → `ia:claude`;
- redimensione a janela → a tela acompanha (se não acompanhar, me diga).

Saia e rode `zeno status`. Esperado: um `sessao.fechada` com as contagens de rede.

**Opcional, depois:** um token fine-grained do gh só para este repo, num `GH_CONFIG_DIR` próprio
(`~/.local/share/zeno-agentes/claude/gh`). No perfil, ele entra como `credenciais:` e `env: [GH_CONFIG_DIR]`.

---

## Bloco B: o sandbox do Claude Code em toda sessão (1 `sudo`)

**Cartão**
- **Muda:** o Bash de **toda** sessão `claude` desta máquina roda no sandbox do Claude Code, também a aberta fora do
  `zeno sessao`. Vale para todos os projetos, inclusive os de trabalho.
- **Porquê:** é a sua decisão de 2026-10-27; ela cobre o que o bloco A não cobre (um `claude` aberto por outro caminho).
- **Risco:** médio. A rede curta pode derrubar AWS, o GitLab da empresa ou registros de pacote, e é por isso que o T13 e
  o T14 vêm antes.
- **Desfazer:** `sudo mv /etc/claude-code/managed-settings.json /etc/claude-code/managed-settings.json.off`.

**Como:** é o roteiro do hub, como está escrito lá (`conhecimento/hub/proposta-sandbox.md`, testes T0 a T16, com o
`global/sandbox-roteiro.sh`). Só instale o `/etc/claude-code/managed-settings.json` (o único `sudo`) depois de o T13 e o
T14 passarem numa sessão de trabalho real.

---

## Bloco C: a cópia que guarda passa a ser do root (6 linhas com `sudo`, ≈5 min)

**Só depois de o nó `o-promover-com-a-copia-de-dono-root` (T95) ter a Entrega aprovada e ser promovido** do jeito de
hoje: a cópia da casa precisa ter o instalador. O passo 1 usa o `zeno chave pub` (T96, nó
`imprimir-a-chave-pub-de-uma-chave-existe`), então a cópia promovida precisa tê-lo também.

**Cartão**
- **Muda:** o hook, o pre-commit, o `zeno sessao` e o `zeno` do PATH passam a rodar de `/opt/zeno`, que só o root
  escreve. Cada `promover` instala lá pelo instalador root, que confere a sua assinatura.
- **Porquê:** com a cópia no seu usuário, um agente fora do sandbox troca o código que o guarda.
- **Risco:** baixo. Cada `promover` pede a senha do sudo uma vez. O 1º instalador vem da sua casa: leia o texto.
- **Desfazer:** `sudo mv /opt/zeno /opt/zeno.off && sudo mv /usr/local/bin/zeno /usr/local/bin/zeno.off`, e volte o
  shim do `~/.local/share/zeno/_lixo/` para `~/.local/bin/zeno`. Sem `/opt/zeno`, o `promover` volta ao jeito de hoje.

**A defesa real é a sua leitura.** O sha256 abaixo (e o do cartão do nó) vem do próprio agente: ele só prova que o
arquivo na sua casa é o mesmo que o agente mostrou, não que o texto é bom. Por isso o `less` do instalador, antes do
1º `sudo`, é o passo que conta. Ele tem 57 linhas, e o cartão do nó aponta as que importam.

**A outra conferência que conta: as duas linhas do passo 1.** A sua chave pública passa por `~/pessoa.pub`, um arquivo
comum na sua pasta, antes do `sudo install`. Entre os dois comandos, qualquer processo do seu usuário (um agente fora do
sandbox, por exemplo) pode trocá-lo pela chave de outro. A partir daí, o root aceitaria cópias do Zeno assinadas por esse
outro. O que prova que não houve troca é você comparar, caractere por caractere, a `chave_pub` que o `zeno chave pub`
imprime (ela sai da sua chave privada, aberta pela sua passphrase) com a linha que o `openssl … | base64` mostra no fim
do passo 1, lida de `/opt/zeno/pessoa.pub`, que já é do root. Se forem diferentes, pare antes do `zeno promover`.

**Sugestão para o sudoers** (opcional, com `sudo visudo`): `Defaults timestamp_timeout=0` faz o sudo pedir a senha
toda vez, de modo que um processo seu não aproveite uma senha recém-digitada para chamar o instalador. Vale para todo
sudo da máquina. A forma só para o instalador, `Defaults!/opt/zeno/*/bin/zeno-instalar-root timestamp_timeout=0`,
depende da versão do sudo; confira com `sudo -l` antes de contar com ela.

**Tamanho:** cada `promover` deixa em `/opt/zeno` a cópia nova e, em `_recebidos/`, o tar e a assinatura que
chegaram. Nada é apagado, então cresce cerca de 2× o tamanho da cópia por `promover`: hoje ≈1,4 MB (a cópia tem ≈680 KB).

```sh
cd ~/repos/filipe-andrade/context-engineering/zeno
C=$(readlink -f ~/.local/share/zeno/atual); I="$C/bin/zeno-instalar-root"
sha256sum "$I"        # esperado: o sha256 do cartão da Entrega do nó (905e4c70fbe3…); se não bater, pare
less "$I"             # é o texto que vai rodar como root (57 linhas)

# 1. a raiz do root e a sua chave pública, tirada da sua chave privada pela passphrase (T96)
zeno chave pub --em ~/pessoa.pub        # imprime a linha chave_pub; um "aviso" aqui é para parar
sudo install -d -o root -g root -m 755 /opt/zeno
sudo install -o root -g root -m 644 ~/pessoa.pub /opt/zeno/pessoa.pub
openssl pkey -pubin -in /opt/zeno/pessoa.pub -outform DER | base64 -w0; echo   # COMPARE com a chave_pub acima
# diferente, mesmo num caractere? pare aqui: sudo mv /opt/zeno/pessoa.pub /opt/zeno/pessoa.pub.off, e não rode o promover

# 2. o 1º instalador, numa cópia "zero" que só tem ele
sudo install -D -o root -g root -m 755 "$I" /opt/zeno/000000000000/bin/zeno-instalar-root
sudo ln -sn /opt/zeno/000000000000 /opt/zeno/atual

# 3. o zeno do PATH roda a cópia do root
printf '#!/bin/sh\nexec node /opt/zeno/atual/cli.mjs "$@"\n' | sudo tee /usr/local/bin/zeno >/dev/null
sudo chmod 755 /usr/local/bin/zeno

# 4. o 1º promover no modo root: prova, assinatura, e o sudo do instalador (a senha do sudo e a passphrase)
zeno promover
```

**Confira** (esperado):
- `ls -l /opt/zeno` → `atual -> /opt/zeno/<commit>`, tudo do root, e o `000000000000` e o `_recebidos/` ainda lá;
- `command -v zeno` → `/usr/local/bin/zeno`, porque o `~/.local/bin/zeno` foi para o `_lixo/`;
- `zeno status` → um `zeno.promovido` com `root: true`;
- o próximo `git commit` no zeno/ julga com `/opt/zeno/atual/cli.mjs`.

Se o passo 4 recusar, o `atual` segue no `000000000000` (sem `cli.mjs`), e os hooks voltam para a cópia da casa.
Mande a mensagem do instalador.

---

## Depois: a trava (uma semana depois do bloco A, sem atrito)
Acrescente `sessao_obrigatoria: true` ao `sistema.yaml` e rode `zeno sync`. A partir daí, o hook nega **toda**
ferramenta de uma sessão aberta fora do `zeno sessao`.
- **Desfazer:** `sessao_obrigatoria: false` + `zeno sync`.

## O que segue aberto mesmo com tudo feito
- **A C1:** código que o agente escreveu e que roda **fora** do sandbox (por você, pelo Zed, pelo git) ainda alcança a
  chave e a passphrase. Quem a fecha é o FIDO (um toque no lugar da passphrase), num nó à parte.
- **Os conectores**: a decisão A1 foi a (3), e o resíduo foi aceito em 2026-11-03.
- **Outros agentes** (o hermes, um `claude` aberto sem `zeno sessao`) ficam sem a camada A até a trava.
- **A prova do `promover`** roda inteira num sandbox a partir da T90, depois que ela for aprovada e promovida.
