// frota.mjs — a deriva da frota depois do promover (T106). Cada promover que muda o que o sync gera deixa deriva em
// todos os alvos, e o gate de commit de cada um falha fechado até um sync. Depois de trocar a cópia, o promover confere
// cada alvo do registro (sync --check, só leitura) com o código da cópia NOVA: é ela que os hooks e o gate passam a
// rodar, não o processo que está promovendo (que pode ser a cópia de antes). Lista os alvos com deriva, a de segurança
// primeiro; pede uma confirmação e roda o sync só nos que o registro diz que a frota opera (pessoal, checkout principal).
// Empresa e cliente ficam na lista, com o comando para rodar à mão. O sync nunca faz commit. Um alvo com problema vira
// uma linha da lista: nada aqui derruba a promoção, que já foi feita.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { vistaDosAlvos } from "./alvos.mjs";

const NOME = { seguranca: "segurança", forma: "forma" };
const quieto = (ctx, cwd) => ({ ...ctx, cwd, mostrar: () => {} });

// Roda um verbo com o código da cópia nova, no alvo, e devolve o --json dele.
async function noAlvo(runNovo, ctx, cwd, args) {
  try {
    const r = await runNovo([...args, "--json"], quieto(ctx, cwd));
    let j = null; try { j = JSON.parse(r.stdout); } catch {}
    return { codigo: r.codigo, j };
  } catch (e) { return { codigo: 9, j: null, erro: String(e.message || e) }; }
}

// O resultado do check de um alvo: { deriva: [{arquivo, tipo}], erro }.
async function conferir(runNovo, ctx, a) {
  const r = await noAlvo(runNovo, ctx, a.caminho, ["sync", "--check"]);
  if (r.codigo === 0) return { deriva: [], erro: null };
  const erros = r.j?.erros || [];
  if (r.codigo === 1 && erros.length && erros.every((e) => e.regra === "deriva")) return { deriva: erros.map((e) => ({ arquivo: e.arquivo, tipo: e.tipo || "seguranca" })), erro: null };
  return { deriva: [], erro: r.erro || erros.map((e) => `${e.regra}: ${e.msg}`).join("; ") || `sync --check saiu ${r.codigo}` };
}

// O commit por pathspec que a pessoa roda depois do sync (o sync não commita; a config local do clone não vai para o git).
export const comandoCommit = (a, deriva) => {
  const arqs = deriva.map((d) => d.arquivo).filter((f) => !f.startsWith(".git/") && f !== ".claude/settings.local.json");
  if (!arqs.length) return null;
  const ps = arqs.map((f) => `'${f}'`).join(" ");
  return `git -C '${a.caminho}' add -- ${ps} && git -C '${a.caminho}' commit -m "chore(zeno): sync depois do promover" -- ${ps}`;
};

const temSeguranca = (x) => x.deriva.some((d) => d.tipo === "seguranca");
const ordem = (a, b) => Number(temSeguranca(b)) - Number(temSeguranca(a)) || a.caminho.localeCompare(b.caminho);

// Mostra cada linha na hora (antes da pergunta, e o resultado logo depois); devolve o resumo de uma linha e os dados.
export async function derivaDaFrota(ctx, copia) {
  const linhas = { push: (...ls) => { for (const l of ls) ctx.mostrar?.(l); } }, v = vistaDosAlvos(ctx);
  const fim = (resumo, dados) => ({ resumo, dados }); // o resumo sai como a mensagem final do promover
  if (!v.registro) return fim("frota: sem a pasta da casa, não sei onde mora o registro de alvos; confira cada alvo com zeno sync --check", null);
  if (v.erro) return fim(`frota: não conferi os alvos (${v.erro})`, { erro: v.erro });
  if (!v.alvos.length) return fim("frota: o registro de alvos está vazio; rode zeno alvos --descobrir <pasta> e confira cada alvo com zeno sync --check", { alvos: [] });
  let runNovo;
  try { ({ run: runNovo } = await import(pathToFileURL(join(copia, "core", "run.mjs")).href)); }
  catch (e) { return fim(`frota: não consegui carregar a cópia nova (${e.message}); confira cada alvo com zeno sync --check`, { erro: e.message }); }

  const res = [];
  for (const a of v.alvos) {
    const x = { caminho: a.caminho, nome: a.nome, fronteira: a.efetiva, opera: a.opera, deriva: [], erro: null, pulado: null, sync: null };
    if (a.sumiu) x.pulado = "o .agents/sistema.yaml sumiu";
    else if (a.worktree) x.pulado = "worktree ligado (recebe pelo merge)";
    else Object.assign(x, await conferir(runNovo, ctx, a));
    res.push(x);
  }
  const comDeriva = res.filter((x) => x.deriva.length).sort(ordem);
  // T106: o sync automático só toca alvo que a frota opera (pessoal no registro); empresa e cliente nunca, nem com confirmação
  const sincronizaveis = comDeriva.filter((x) => /*G:promover-so-pessoal*/ !x.opera ? false : true);
  const amao = comDeriva.filter((x) => !sincronizaveis.includes(x));
  linhas.push(`frota: ${res.length} alvo(s) no registro; ${comDeriva.length} com deriva depois desta cópia`);
  const linha = (x) => `  ${(temSeguranca(x) ? "SEGURANÇA" : "forma").padEnd(9)} ${x.fronteira.padEnd(7)} ${x.nome}  ${x.caminho}  (${x.deriva.map((d) => d.arquivo).join(", ")})`;
  if (sincronizaveis.length) linhas.push("pessoais (o sync roda se você confirmar):", ...sincronizaveis.map(linha));
  if (amao.length) linhas.push("empresa, cliente ou fora do registro da frota (só à mão, num terminal seu):", ...amao.flatMap((x) => [linha(x), `      cd '${x.caminho}' && zeno sync`]));
  for (const x of res.filter((y) => y.erro)) linhas.push(`  não conferi ${x.caminho}: ${x.erro}`);
  for (const x of res.filter((y) => y.pulado)) linhas.push(`  pulado ${x.caminho}: ${x.pulado}`);
  if (!comDeriva.length) return { resumo: "frota: nenhum alvo com deriva", dados: { alvos: res } };

  if (sincronizaveis.length) {
    const resp = String(await ctx.perguntar(`rodar o zeno sync nos ${sincronizaveis.length} alvo(s) pessoal(is) acima? O sync não faz commit. (s/N) `) || "").trim();
    if (/^s(im)?$/i.test(resp)) {
      for (const x of sincronizaveis) {
        const s = await noAlvo(runNovo, ctx, x.caminho, ["sync"]);
        const depois = s.codigo === 0 ? await conferir(runNovo, ctx, x) : null;
        x.sync = s.codigo === 0 && depois && !depois.deriva.length && !depois.erro ? "ok" : `falhou (${s.j?.erros?.map((e) => e.msg).join("; ") || depois?.erro || `saída ${s.codigo}`})`;
        linhas.push(`  sync ${x.sync === "ok" ? "ok" : x.sync}: ${x.caminho}`);
        const c = x.sync === "ok" && comandoCommit(x, x.deriva);
        if (c) linhas.push(`      commit dos gerados: ${c}`);
      }
    } else linhas.push("  sync não rodou (sem confirmação): nenhum alvo mudou; o gate de commit deles falha até um zeno sync");
  }
  const ok = res.filter((x) => x.sync === "ok").length;
  return { resumo: `frota: ${comDeriva.length} alvo(s) com deriva; sync feito em ${ok}; ${amao.length} só à mão`, dados: { alvos: res } };
}
