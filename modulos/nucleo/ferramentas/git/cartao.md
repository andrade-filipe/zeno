**git** · `git status`, `git diff`, `git add <arq>`, `git commit -m "<tipo>(escopo): …"`, `git log --oneline`, `git push`.
Commit pequeno, em Conventional Commits, só com os arquivos da tarefa (nada de `git add -A` às cegas).
Nunca: reescrever histórico (`--amend`, `rebase`, `reset --hard`, `push --force`) nem pular hook (`--no-verify`).
Merge na branch principal de um repo compartilhado é passo da Entrega, não da Execução.
Nunca leia nem imprima credencial: ela é do helper do git.
