**docker / podman** · `build -t <nome> .`, `run --rm <nome>`, `ps`, `logs <id>`, `compose up -d`, `compose down`.
Container do trabalho sobe e desce na tarefa; nada de `--privileged` nem de montar `$HOME` ou o socket do docker.
Apagar volume, imagem ou rede que não são da tarefa (`system prune`, `volume rm`): pede pessoa.
Serviço de pé: `zeno ferramentas`. O login do registry não dá para conferir sem ler segredo.
Nunca: `login -p <senha>`, ler `~/.docker/config.json`, imprimir variável de credencial.
