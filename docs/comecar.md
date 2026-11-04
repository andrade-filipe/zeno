---
tipo: tutorial
publico:
  - usuario
responde: "Como instalo o Zeno num repo descartável e passo um nó pelas 7 fases até o placar?"
fonte:
  - zeno/spec/cli.md
  - zeno/spec/fases.md
  - zeno/spec/instalacao.md
  - zeno/bin/zeno
  - avaliacao/placar/placar.mjs
  - zeno/core/verbos/promover.mjs
  - zeno/core/fluxo.mjs
  - zeno/core/habito.mjs
verificado-em: 4372d91
---

# O primeiro nó, em 15 minutos

> Esta página vem do monorepo de origem do Zeno. Onde ela diz `zeno/`, aqui é a raiz deste repositório; a `avaliacao/` e o `conhecimento/` não vêm nesta publicação.

**Resumo.** Você instala o Zeno num repo descartável e fecha um nó pequeno pela via expressa. Depois leva um nó médio
até o gate humano, aprova esse gate como pessoa e lê o placar. Nada aqui toca um repo seu de verdade.

**Você vai ter:** um repo de teste com o Zeno instalado, um nó fechado, um nó parado num gate e um placar.
**Precisa de:** Linux ou WSL2, Node 20 ou mais novo, git com `user.name` e `user.email` configurados e um clone deste
repo. O seu `user.name` vira o id da sua pessoa no Zeno. O macOS não é suportado, porque o `zeno sessao` e a prova do
`promover` rodam no bwrap.

Os comandos rodam no seu terminal. Um bloco `text saida` mostra só o trecho da saída que importa, e não a saída
inteira. Um bloco marcado **(pessoa)** é só seu. Um agente não roda esse bloco, e o Zeno
recusa se tentar.

## 1. Aponte para o clone

Diga ao shell onde está o clone do `zeno` e ponha o `zeno` no PATH desta sessão.

```sh
export CE=<caminho do clone do zeno>
```

```sh executavel
export PATH="$CE/bin:$PATH"
zeno versao
```
```text saida
zeno 0.1.0
```

O `zeno` é um shim: ele roda o `cli.mjs` do clone onde ele mora, até o primeiro `zeno promover`, que o troca por um
que roda a cópia fixada ([Instalar](como-fazer/instalar-num-repo.md#5-ligue-a-chave-a-cópia-fixada-e-os-checks)). O
código fica fora do alvo, e o repo onde você instala só recebe dados.

## 2. Crie um repo descartável e instale o Zeno

```sh executavel
cd "$(mktemp -d)"
git init -q -b main meu-repo
cd meu-repo
zeno install .
pwd
```
```text saida
instalado em
```

Anote o caminho que o `pwd` mostra. O passo 5 pede um terminal novo, e lá você volta para este diretório.

O `install` cria a pasta `.agents/` (a configuração, o grafo de trabalho e o ledger) e os blocos do `AGENTS.md`. Ele
também gera o `CLAUDE.md` e o `.claude/`, que são a porta do Claude Code. A saída do `install` diz o id da pessoa dona do alvo
(`pessoa <id>`), tirado do seu `git config user.name`.

```sh executavel
zeno status
```

O `install` e o `status` avisam que a sua pessoa está sem `chave_pub`. Esse aviso é esperado: a chave só entra no
passo 5. O commit fica para o fim do passo 3, junto com o primeiro nó.

## 3. Feche um nó pequeno pela via expressa

Um nó pequeno (`P`) na faixa `autonoma` passa as 7 fases com dois comandos. É o caminho de todo trabalho miúdo. Abrir
o nó é o primeiro ato num alvo, antes da primeira edição (T113).

```sh executavel
zeno novo "Escrever o README" --expressa --porque "o repo não diz o que é"
echo "# Meu repo" > README.md
zeno avancar escrever-o-readme --ate fim \
  --pronto "o README diz o que o repo é" --feito "README.md" \
  --evidencia "README.md existe" --ref README.md --desfazer "apagar o README.md"
```
```text saida
escrever-o-readme: Intenção → Especificação
escrever-o-readme: Aprendizado → fechado
```

Cada linha `A → B` é uma fase que passou pelo gate `check`. O gate `check` confere que a chave da fase existe e não
está vazia. As fases são Intenção, Especificação, Execução, Verificação, Entrega, Observação e Aprendizado.

Agora commite a instalação, o README e o nó juntos:

```sh executavel
git add -A
git commit -q -m "zeno instalado e o primeiro nó"
git log --oneline | head -n 1
```
```text saida
zeno instalado e o primeiro nó
```

O gate de commit do alvo (`zeno validar --staged`) cobra o nó. Um commit que muda arquivos fora de `.agents/`, sem
evento novo de nó no ledger e sem nó em Execução, para quando quem commita é agente: a mensagem traz o
`zeno registrar … --retro` pronto para preencher. Quando quem commita é você, ele só avisa. Este commit passa, porque
o ledger dele traz os eventos do nó.

## 4. Leve um nó médio até o gate humano

Um nó `M` cai na faixa `aprovacao`. A Especificação e a Entrega dele esperam uma pessoa. O gate humano só abre com o
**cartão de decisão**, que tem 6 campos em linguagem simples.

```sh executavel
zeno novo "Pôr uma licença" --tamanho M
zeno avancar por-uma-licenca --ate fim \
  --porque "o repo não tem licença" --para "quem quiser usar o código" --fora "mudar o código" \
  --pronto "existe um LICENSE com a MIT" --restricoes "só a MIT" --riscos "nenhum conhecido" \
  --cartao-muda "entra um arquivo LICENSE com a licença MIT" \
  --cartao-porque "sem licença ninguém sabe se pode usar o código" \
  --cartao-risco "baixo: é um arquivo novo, nada muda no código" \
  --cartao-desfazer "reverter o commit que criou o LICENSE" \
  --cartao-reprovar "o repo segue sem licença" \
  --cartao-conferir "(1) o texto é o da MIT (2) o ano e o nome estão certos" \
  || echo "saída $?"
```
```text saida
gate humano de Especificação aberto
saída 3
```

A saída 3 quer dizer "precisa de pessoa". Um agente que recebe a saída 3 avisa a pessoa e segue com outra coisa.
Aprovação no chat não conta.

```sh executavel
zeno status por-uma-licenca
```
```text saida
gate aberto: Especificação
```

No seu terminal, o mesmo gate aparece em `zeno pendentes`, que lista o que espera por você. Um agente que roda o
`pendentes` vê a caixa dele, e não a sua.

## 5. Aprove o gate (pessoa)

O passo 5 é seu, num terminal seu, fora do Claude Code. Se você seguiu até aqui dentro de uma sessão de agente, abra
um terminal novo, refaça o `export CE=…` e o `export PATH=…` do passo 1 e entre no diretório que o `pwd` mostrou no
passo 2.

A decisão humana é **assinada** com uma chave Ed25519 cifrada por passphrase. Primeiro gere a chave. A chave privada
fica fora do repo, na sua pasta de configuração ([onde](../spec/cli.md#verbos-de-apoio)). O comando imprime uma
linha `chave_pub:`.

A chave **não** é descartável como o repo deste tutorial. Ela fica no seu HOME e é a mesma para todos os alvos. Por isso
escolha uma passphrase de verdade, e guarde a linha `chave_pub:`. Se você já tem uma chave, o `chave nova` recusa com 1
e não sobrescreve. Nesse caso, pule o comando e rode `zeno chave pub`, que pede a passphrase e imprime a linha
`chave_pub:` da chave que você já tem (T96).

```sh pessoa
zeno chave nova
```

Copie a linha `chave_pub: …` inteira, como o comando imprimiu, e ponha no lugar de `chave_pub: null` da sua pessoa em
`.agents/sistema.yaml`. Esse arquivo é configuração de pessoa: edite à mão. Não precisa commitar antes. Depois abra a
caixa:

```sh pessoa
zeno caixa --aprovar
```

A caixa abre com uma linha por gate e mostra aberto o cartão de quem pede olho. Um gate de risco baixo, como o
deste tutorial, vem fechado: `v 1` mostra o cartão dele. Depois ela pergunta quais gates aprovar (`todos` ou `1,3`). Ela pede a passphrase uma vez e
grava um evento assinado por gate. Errou a passphrase? Ela pede de novo, até 3 vezes, sem perder a escolha (T100). O `artefato_sha256` amarra a assinatura ao texto que você leu: se o texto mudar
depois, o próximo `zeno avancar` reabre o gate (se o nó não está pausado nem com outro gate aberto), e até lá o
`zeno validar` acusa `aprovado-mudou`.

Aprovado o gate, o nó segue, e cada fase pede as chaves dela. Para sair da Execução, o `avancar` pede `--feito`. Para
sair da Verificação, pede `--evidencia` e, num nó médio ou grande, `--pronto-confere`. A Entrega pede `--ref`,
`--desfazer` e um cartão novo, e para de novo num gate humano. Sem uma chave, o `avancar` sai com 1 e diz qual falta
([fases](../spec/fases.md)).

Fora de um terminal (TTY), ou dentro do Claude Code, a caixa recusa com a saída 3. É de propósito: ambiente não prova
pessoa. A assinatura prova a chave e a passphrase, e não a pessoa: um agente desviado no mesmo usuário alcança, em
tese, o terminal onde você digita a passphrase. O `zeno sessao` (T82) isola o agente, mas no mesmo usuário. Por isso a
marca `sandbox` que cada evento leva no ledger (T105) é declaração, e não prova. Só a marca `fora` é certa: sem o
marcador, o ato foi de fora da sessão ([resíduos](../spec/seguranca.md#resíduos-declarados)).

## 6. Leia o placar

O placar lê o ledger e mostra três métricas: o imposto do Sistema, o lead time e a espera em gate humano.

Esta publicação não traz o placar: ele mora na `avaliacao/` do monorepo de origem.

Com menos de 5 casos num estrato, o placar escreve **n insuficiente** e não tira conclusão. Cada métrica tem uma ficha que diz o
que ela não mede. Veja Ler o placar.

## Pronto

Você instalou o Zeno, fechou um nó pela via expressa, abriu um gate humano com cartão e leu o placar. O repo de teste
mora num diretório temporário, e nada dele foi commitado além da instalação e do primeiro nó. Num repo de verdade, o `AGENTS.md`, o
`.agents/` e o ledger vão para o git, e o time vê o grafo. Pode apagar o repo de teste quando quiser.

Próximos passos:
- [Instalar num repo de verdade](como-fazer/instalar-num-repo.md), inclusive num repo que já tem harness (modo adoção).
- [Os conceitos](conceitos.md): por que o nó tem 7 fases, o que é faixa, o que as 4 camadas garantem.
- [Quando o Zeno nega algo](como-fazer/quando-algo-e-negado.md): os códigos de saída e o que fazer com cada um.
