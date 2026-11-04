---
name: zeno-ferramenta-containers
description: Como operar docker ou podman num alvo governado pelo Zeno — build, run, compose, o que pede pessoa e como não expor credencial de registry.
---
# docker / podman

Os comandos abaixo valem para os dois (o podman aceita a mesma sintaxe). Use o que `zeno ferramentas` mostrar presente.

## O dia a dia
- Imagem: `docker build -t <nome>:<tag> .`, `docker images`.
- Rodar: `docker run --rm <nome>` (o `--rm` não deixa lixo), `docker ps`, `docker logs <id>`, `docker exec <id> <cmd>`.
- Compose: `docker compose up -d`, `docker compose ps`, `docker compose logs <serviço>`, `docker compose down`.
- O container da tarefa sobe e desce na tarefa. Porta exposta só em `127.0.0.1`.

## Como conferir
- `zeno ferramentas` mostra se o binário está no PATH e se o serviço está de pé (o código de saída de `info`).
- O login no registry não dá para conferir sem abrir o arquivo de credencial: o comando responde "não dá para saber".
  Se um `pull`/`push` pedir login, pare e avise a pessoa.

## O que é de pessoa
- `docker login`, apagar o que não é da tarefa (`system prune`, `volume rm`, `image rm` de imagem alheia), publicar
  imagem num registry (`push`): passo da Entrega, com gate.

## O que nunca fazer
- `docker login -p <senha>` ou `--password` na linha de comando; ler `~/.docker/config.json`; imprimir variável de
  credencial (`env` dentro do container inclusive).
- `--privileged`, `--network host` sem a tarefa pedir, montar `$HOME`, `~/.ssh` ou `/var/run/docker.sock`.

## Licença
- O Docker Desktop pode pedir licença paga em empresa grande; as alternativas são o Docker Engine no WSL e o Podman.
  Isto é só informação: o Zeno não confere licença.
