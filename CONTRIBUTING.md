# Como contribuir

Obrigado pelo interesse no Zeno. Este repositório é um snapshot publicado: o código é mantido num repositório privado
e cada versão chega aqui pelo portão de publicação (`zeno promover --publicar`). Por isso, um pull request não entra por
merge direto. Ele é importado no repositório de origem e volta na próxima versão, com a sua autoria preservada.

## Antes de abrir um pull request

- Abra uma issue para mudança grande, para combinar o desenho antes do código.
- Rode os testes e o censo das guardas: `node --test test/*.test.mjs test/probes/*.test.mjs` e `node test/censo.mjs`.
- O Zeno é Node ESM **sem dependências**. Um pull request que adiciona dependência não entra.
- Toda guarda nova vem com uma sonda em `test/probes/` e uma entrada no `guardas.json` (a sonda tem de falhar com a
  guarda mutada).
- Sem nome de empresa, de cliente ou caminho da sua máquina no código, nos testes ou nas mensagens de commit.

## Developer Certificate of Origin (DCO)

Toda contribuição segue o [Developer Certificate of Origin 1.1](https://developercertificate.org/). Ao assinar o
commit, você declara que escreveu a contribuição, ou que tem o direito de enviá-la sob a licença do projeto
(Apache-2.0). Assine cada commit com `git commit -s`, que acrescenta a linha:

```
Signed-off-by: Seu Nome <seu@email>
```

Commit sem `Signed-off-by` não é importado.

## Licença

Ao contribuir, você concorda que a sua contribuição é licenciada sob a Apache License, Version 2.0 (veja `LICENSE`).
