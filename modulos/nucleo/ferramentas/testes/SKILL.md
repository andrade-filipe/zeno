---
name: zeno-ferramenta-testes
description: Como rodar e relatar os testes de um alvo governado pelo Zeno — os checks do sistema.yaml, a evidência da Verificação e o que nunca fazer com um teste que falha.
---
# testes

## Onde estão
- Os comandos de teste do alvo são os `checks:` do `.agents/sistema.yaml` (ex.: `testes: "node --test"`). Os
  `checks_padrao:` rodam em todo nó; um nó pode pedir mais com `--check <nome>`.
- O `zeno avancar` roda os checks do nó no gate de check e recusa se algum falhar. Rodar o mesmo comando antes poupa a
  recusa e o atrito no placar.

## O dia a dia
- Rode o comando do check como está no `sistema.yaml`, da raiz do alvo.
- Teste novo para o que a tarefa muda, perto dos que já existem, no mesmo estilo. Fixture em diretório temporário.
- Relate as contagens: quantos testes, quantos passam, falham e pulam. É isso que vai na `- evidencia:`.
- Em nó M ou G, a `- pronto-confere:` liga cada item do `pronto` ao teste que o prova.

## Como conferir
- `zeno ferramentas` mostra se o comando de cada check está no PATH.

## O que nunca fazer
- Apagar, pular (`skip`, `only`), afrouxar asserção ou mudar o check do `sistema.yaml` para o teste passar. Teste que
  falha é dado: corrija o código ou escale com `zeno msg <id> escalada`.
- Rodar teste contra dado real, de empresa ou de cliente.
- Dizer "testes ok" sem as contagens.
