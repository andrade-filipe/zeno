---
name: zeno-ferramenta-git
description: Como operar o git num alvo governado pelo Zeno — commits pequenos, branch por trabalho, o que a guarda nega e o que é passo da Entrega.
---
# git

## O dia a dia
- Ver o estado: `git status`, `git diff`, `git diff --staged`, `git log --oneline -10`.
- Uma branch por trabalho quando o repo é compartilhado: `git switch -c <tipo>/<slug>`. Em paralelo com outra sessão,
  use um worktree próprio: `git worktree add ../<repo>-<slug> -b <tipo>/<slug> main`.
- Adicionar só o que a tarefa mudou: `git add <arquivo> …`. Arquivo novo precisa de `git add` antes do commit.
- Commit em Conventional Commits: `feat(escopo): …`, `fix(…)`, `docs(…)`, `chore(…)`, `test(…)`. Uma ideia por commit.
- Integrar a main na sua branch: `git merge main`. Conflito: resolva no seu worktree e rode os checks de novo.
- Publicar a branch: `git push -u origin <branch>`. "Repository not found": pare e avise.

## Como conferir
- `zeno ferramentas` diz se o git está no PATH. O git não tem "login": a credencial é do helper (`credential.helper`).
- O hash que vai na `- ref:` da Entrega é o do commit: `git rev-parse HEAD`.

## O que é de pessoa
- O merge na branch principal de um repo compartilhado e a publicação (tag, release) passam pelo gate de Entrega.
- Desfazer trabalho de outra pessoa ou de outra sessão.

## O que nunca fazer (a guarda nega; não contorne)
- Reescrever histórico: `commit --amend`, `rebase`, `reset --hard`, `push --force`, `filter-branch`.
- Pular os hooks: `--no-verify`.
- `git stash` num checkout que outra sessão usa: o stash é do repo inteiro.
- Rodar git no checkout principal quando a orquestração pede worktree.

## Credencial
- Nunca leia `~/.git-credentials`, a saída de `git credential fill` nem o arquivo do helper. Nunca ponha token na URL do
  remoto. Se o push pedir senha, pare: é a pessoa quem configura o acesso.
