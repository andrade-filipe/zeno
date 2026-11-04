// alvos.mjs (verbo) — zeno alvos [--json] · --descobrir <pasta>… · --esquecer <caminho>… (H9, H21; spec/cli.md).
// Lê e mantém a lista de alvos da máquina. Pôr ou tirar da lista não afrouxa nada (as guardas moram no alvo); as regras
// por pasta são da pessoa e este verbo só as lê.
import { vistaDosAlvos, descobrir, registrarVarios, esquecer, caminhosDoRegistro } from "../alvos.mjs";
import { Recusa } from "../util.mjs";

export async function alvos(ctx, pos, o) {
  if (o.descobrir && o.esquecer) throw new Recusa(2, "uso", "zeno alvos: --descobrir ou --esquecer, não os dois");
  if (!caminhosDoRegistro(ctx)) throw new Recusa(1, "registro", "sem a pasta da casa (home): não sei onde mora o registro");
  if (o.descobrir) {
    if (!pos.length) throw new Recusa(2, "uso", "zeno alvos --descobrir <pasta> … (ex.: ~/repos ~/labs)");
    const d = descobrir(ctx, pos), r = registrarVarios(ctx, d.achados);
    if (r.erro) throw new Recusa(1, "registro", r.erro);
    const linhas = [`${d.achados.length} alvo(s) achado(s), ${r.novos.length} novo(s) na lista`, ...r.novos.map((c) => `  + ${c}`),
      ...d.pulados.map((p) => `  pulado (${p.motivo}): ${p.caminho}`)];
    return { codigo: 0, msg: linhas.join("\n"), dados: { achados: d.achados, novos: r.novos, pulados: d.pulados } };
  }
  if (o.esquecer) {
    if (!pos.length) throw new Recusa(2, "uso", "zeno alvos --esquecer <caminho> …");
    const r = esquecer(ctx, pos);
    if (r.erro) throw new Recusa(1, "registro", r.erro);
    const avisos = r.tirados.length ? [] : [{ regra: "registro", msg: `nenhum destes estava na lista: ${pos.join(", ")}` }];
    return { codigo: 0, msg: r.tirados.length ? r.tirados.map((c) => `  - ${c}`).join("\n") : "nada a tirar", avisos, dados: { tirados: r.tirados } };
  }
  const v = vistaDosAlvos(ctx);
  const linha = (a) => `${a.opera ? "opera" : "  —  "}  ${a.efetiva.padEnd(7)} ${a.sumiu ? "SUMIU " : a.worktree ? "WORKTREE " : ""}${a.nome}  ${a.caminho}${a.divergencia ? `  (declara ${a.declarada ?? "nada"})` : ""}`;
  const msg = v.alvos.length
    ? [`${v.alvos.length} alvo(s) no registro (${v.registro.alvos}); "opera" = a frota pode agir sem pedir`, ...v.alvos.map(linha)].join("\n")
    : `o registro está vazio (${v.registro.alvos}): o install registra cada alvo novo; os de antes entram com zeno alvos --descobrir <pasta>`;
  return {
    codigo: 0, msg, avisos: v.avisos,
    dados: { registro: v.registro.alvos, regras: v.registro.regras, erro: v.erro, alvos: v.alvos },
  };
}
