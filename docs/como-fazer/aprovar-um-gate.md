---
tipo: como-fazer
publico:
  - usuario
responde: "Como aprovo, reprovo ou devolvo um gate humano, e o que a assinatura garante?"
fonte:
  - zeno/spec/cli.md
  - zeno/spec/controle.md
  - zeno/spec/fases.md
  - zeno/spec/tela.md
  - zeno/core/fluxo.mjs
  - zeno/spec/ledger.md
verificado-em: 4372d91
---

# Aprovar um gate

**Resumo.** No seu terminal, fora do Claude Code, rode `zeno caixa --aprovar`. Leia o cartão de cada gate, escolha
quais aprovar e digite a passphrase uma vez. Para reprovar, use `zeno gate <id> --reprovar --motivo "…"`. Todo comando
desta página é de **pessoa**: um agente recebe a saída 3.

**Quando:** um `zeno avancar` saiu com 3 e alguém avisou que há um gate esperando por você.
**Antes:** a sua chave existe (`zeno chave nova`) e a linha `chave_pub:` está na sua pessoa em `.agents/sistema.yaml`.

## 1. Veja o que espera por você

```sh pessoa
zeno pendentes
```

O `pendentes` lista os gates humanos que você decide, os nós pausados de que você é dona ou dono, as Observações
vencidas, o teto diário estourado e o total da caixa. Só lê.

## 2. Aprove em lote

```sh pessoa
zeno caixa --aprovar
```

A caixa abre com o **resumo**: uma linha por gate, com o número, a fase, o tipo, o risco e o título
([tela](../../spec/tela.md)). O tipo sai do diff do `ref` (código, docs, segurança ou registro), e o risco é o
nível do cartão. Depois vem o **detalhe**: o cartão de decisão, com o que muda, por quê, o risco, como desfazer, o que
acontece se reprovar e o que conferir. O detalhe já vem aberto no gate que pede olho: risco alto, tipo segurança,
MUDOU ou cartão sem nível. Os outros ficam fechados. `v 2` abre o gate 2 e pergunta de novo, e
`zeno caixa --aprovar --detalhe` abre todos.

Responda `todos` ou os números (`1,3`). Vazio cancela. A caixa pede **uma** passphrase e grava um evento assinado por
gate. Se você errar a passphrase, ela pede de novo, até 3 vezes, sem perder a escolha (T100). Na terceira errada, sai
com 1 e não grava nada. A assinatura prova que quem aprovou tinha a chave e a passphrase. Enquanto a T82 tiver rotas abertas, ela prova
a chave, e não a pessoa (veja [O que a assinatura garante](#o-que-a-assinatura-garante)).

Um gate marcado **MUDOU** teve o texto alterado depois de aberto. Ele fica fora do `todos` e só entra pelo número, para
você reler antes. Depois de um `todos`, a caixa pergunta por ele antes da passphrase (T101): o número o aprova no mesmo
lote e com a mesma passphrase, `v N` o mostra, e enter o pula.

Toda rodada deixa rastro (T114). Depois da tela, a caixa grava um `caixa.mostrada` no ledger, inclusive quando você
cancela, erra a escolha ou a passphrase é recusada. O evento só traz ids e números: o que foi listado, o que estava
MUDOU, o que você abriu, a resposta e o tempo de leitura. Ele não é assinado e nunca conta como ato humano: quem prova a
aprovação continua sendo o evento assinado do gate.

Fora de um terminal (TTY), dentro do Claude Code, ou para quem não é pessoa, a caixa recusa com a saída 3. Isso vale
também para o `!` dentro de uma sessão do Claude Code. Abra um terminal seu.

## 3. Reprove, com motivo

```sh pessoa
zeno gate <id> --reprovar --motivo "o cartão não diz como desfazer a migração"
```

O nó volta a `ativo` na mesma fase, com a tentativa +1. O motivo vai para o fio, numa `decisao` no molde do gate, e o
ledger guarda só o hash dele.

## 4. Outros atos de pessoa no gate

| Quero | Comando |
|---|---|
| aprovar um gate só, vendo o cartão no formato da caixa | `zeno gate <id> --aprovar [--motivo "…"]` |
| o mesmo, vendo também as seções até a fase | `zeno gate <id> --aprovar --completo` |
| subir o orçamento ou rearmar o disjuntor | `zeno gate <id> --orcamento tokens=+50000` |
| soltar do disjuntor sem subir o teto | `zeno gate <id> --despausar --motivo "…"` (T98) |
| liberar o teto diário do alvo só hoje (dia UTC) | `zeno gate --teto usd=+5` (sem id; o `sistema.yaml` não muda, T93) |
| limpar a marca de contaminação do alvo | `zeno gate --descontaminar` (sem id: a marca é do alvo) |
| tirar a linha `chave_pub:` da chave que já existe | `zeno chave pub` (pede a passphrase, T96) |
| baixar uma faixa ou afrouxar outro controle | `zeno ajustar <id> faixa=autonoma --motivo "…"` |

Subir o tamanho do nó não é afrouxar, e o agente pode. Mas desde a T115 a faixa sobe junto até o piso do tamanho novo:
um P `autonoma` ajustado para `tamanho=M` vai a `aprovacao`, e o próximo gate de Especificação ou Entrega é seu. Só
a pessoa que declara a faixa no mesmo ajuste fica com a dela.

Devolver um gate para revisão **não** é de pessoa. O agente ou você rodam `zeno revisar <id> --motivo "…"`, que tira o
gate da caixa sem aprovar. O próximo `zeno avancar` abre o gate de novo, com o texto atual. Como na reprovação, o motivo
não fica em claro no ledger: o `gate.retirado` guarda só o hash (`motivo_sha256`), e o texto vai para o fio do nó, num
`aviso` ao revisor (T110). Os dois eventos de antes da T110 ficam com o motivo em claro.

## O que a assinatura garante

- **Quem.** A decisão é sua, porque só a sua chave assina, e a chave pede a passphrase. TTY, `CLAUDECODE` e e-mail do
  git são só filtros, porque o agente controla todos eles.
- **O quê.** O `artefato_sha256` amarra a assinatura ao texto do nó que você viu. Se a seção da fase mudar, o próximo `zeno avancar` reabre o gate, sem pedir cartão novo
  ([o validar acusa](quando-algo-e-negado.md#quando-o-validar-ou-o-pre-commit-acusa)).
- **Quanto esperou.** O evento guarda o `espera_ms`. O placar usa esse número para achar o gate que vira carimbo.

O limite está declarado. Dentro do `zeno sessao` (T82, camada A), o agente roda num sandbox e não alcança a sua casa
nem os seus terminais. Mas segue aberta uma rota: código que o agente escreveu e que roda **fora** do sandbox, por você,
pelo git ou por outro programa, alcança a chave e a passphrase. Quem fecha essa rota é o passo 2 do roteiro da T82, num
nó à parte ([resíduos](../../spec/seguranca.md#resíduos-declarados)). Aprove só o que você leu.
