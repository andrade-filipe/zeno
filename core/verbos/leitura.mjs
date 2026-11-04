// leitura.mjs — caixa, pendentes, status, contexto.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { abrir, ev, gravar } from "../sessao.mjs";
import { faixaEfetiva, pessoasDoPapel, filhos, consumo, tetoDiario } from "../projecao.mjs";
import { lerNo, caminhoFio, idsNoDisco, shaArtefato } from "../no.mjs";
import { lerFio, pendentesDe } from "../mensagens.mjs";
import { P } from "../config.mjs";
import { adotado, fiacaoVersionada } from "../protegidos.mjs";
import { FASES, TITULO_FASE, duracao, semAcento, lista, Recusa } from "../util.mjs";
import { largura, quebrar, cortar, tabela } from "../tela.mjs";
import { vistaGate } from "../vista.mjs";
import { detectar, blocoDoContexto, conferir } from "../ferramentas.mjs";

// T107: as fases em que o agente opera as ferramentas de terminal do alvo (o bloco entra na camada skills).
const FASES_DE_FERRAMENTA = ["execucao", "verificacao", "entrega"];

export async function caixa(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  const dest = o.de || S.ator;
  const itens = [];
  for (const id of S.proj.nos.keys()) for (const m of pendentesDe(lerFio(caminhoFio(S.raiz, id), S.tr.deId), dest, S.cfg)) itens.push({ no: id, ...m });
  const larg = largura(ctx);
  const msg = itens.length ? itens.map((m) => cortar(`${m.no} · ${m.id} · ${m.tipo} · de ${m.de} · ${Object.values(m.campos)[0] ?? ""}`, larg)).join("\n") : `caixa de ${dest} vazia`;
  return { codigo: 0, msg, dados: { de: dest, mensagens: itens.map(({ no, id, tipo, de, ts }) => ({ no, id, tipo, de, ts })) } };
}

// T87: seção aprovada que mudou e cujo gate ainda não foi reaberto (o avancar reabre; antes, só o validar acusava)
export function aprovadoMudou(S) {
  const out = [];
  for (const st of S.proj.nos.values()) {
    if (["fechado", "cancelado"].includes(st.estado)) continue;
    let n; try { n = lerNo(S.raiz, st.id); } catch { continue; }
    if (!n) continue;
    for (const [f, sha] of Object.entries(st.aprovados)) if (shaArtefato(n.corpo, f) !== sha && !(st.estado === "em-gate" && st.gate_aberto?.fase === f)) out.push({ no: st.id, fase: f });
  }
  return out;
}

export async function pendentes(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  const quem = o.de || S.ator, nos = [...S.proj.nos.values()], agora = ctx.agora();
  const gates = nos.filter((st) => st.estado === "em-gate" && pessoasDoPapel(st, st.gate_aberto.papeis).includes(quem))
    // D39/D40: o --json leva a vista inteira do gate (cartão por campo, tipo, nível, MUDOU, sha) para outra porta renderizar
    .map((st) => {
      const mudou = !!st.gate_aberto.sha && shaArtefato(lerNo(S.raiz, st.id).corpo, st.gate_aberto.fase) !== st.gate_aberto.sha;
      const { no, fase, ...v } = vistaGate(S, st, { mudou });
      return { no, fase, espera_ms: agora - Date.parse(st.gate_aberto.ts), ...v };
    });
  const pausados = nos.filter((st) => st.estado === "pausado" && st.dono === quem).map((st) => st.id);
  // T84 (D36): a Observação é check, preenchida pelo executor; quem não executa (a pessoa, num nó de agente) não a recebe
  const observar = nos.filter((st) => st.fase === "observacao" && st.estado === "ativo" && (st.executor || st.criador) === quem && st.entrega_ts && agora - Date.parse(st.entrega_ts) >= (duracao(st.janela) ?? 0)).map((st) => st.id);
  let caixaN = 0;
  for (const st of nos) caixaN += pendentesDe(lerFio(caminhoFio(S.raiz, st.id), S.tr.deId), quem, S.cfg).length;
  const teto = tetoDiario(S.proj, S.cfg, new Date(agora).toISOString().slice(0, 10));
  const reabrir = aprovadoMudou(S);
  const h = (ms) => `${(ms / 3600000).toFixed(1)} h`;
  const linhas = [
    ...gates.map((g) => `gate  ${g.no} · ${TITULO_FASE[g.fase]} · esperando há ${h(g.espera_ms)}`),
    ...reabrir.map((r) => `mudou ${r.no}: a seção aprovada de ${TITULO_FASE[r.fase]} mudou; rode zeno avancar ${r.no} para reabrir o gate`),
    ...pausados.map((id) => `pausa ${id} (disjuntor)`),
    ...observar.map((id) => `obs.  ${id}: janela de Observação vencida`),
    ...(teto ? [`teto  diário estourado (${teto.dimensao})`] : []),
    `caixa ${caixaN} mensagem(ns)`,
  ];
  const larg = largura(ctx);
  return { codigo: 0, msg: linhas.flatMap((l) => quebrar(l, larg, 6)).join("\n"), dados: { de: quem, gates, reabrir, pausados, observar, teto_diario: teto, caixa: caixaN } };
}

export async function status(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  const nos = S.proj.nos, cfg = S.cfg, id = pos[0];
  const titulo = (x) => lerNo(S.raiz, x)?.titulo ?? x;
  if (id) {
    const st = nos.get(id);
    if (!st) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
    const c = consumo(nos, id), fe = faixaEfetiva(st, nos, cfg);
    const gates = st.eventos.filter((e) => e.ev === "gate.decidido").map((e) => `${e.ts.slice(0, 16)} ${TITULO_FASE[e.dados.fase]} ${e.dados.tipo} ${e.dados.decisao}${e.dados.tipo === "humano" ? ` (${e.ator}, espera ${(e.dados.espera_ms / 3600000).toFixed(1)} h)` : ""}`);
    const abertas = pendentesDe(lerFio(caminhoFio(S.raiz, id), S.tr.deId), st.dono, cfg).length;
    const linhas = [
      `${id} — ${titulo(id)}`,
      `fase ${st.fase} · estado ${st.estado} · faixa ${st.faixa} (efetiva ${fe}) · ${st.tamanho} · ${st.tipo} · procedência ${st.procedencia}`,
      `dono ${st.dono} · executor ${st.executor} · revisor ${st.revisor}${st.pai ? ` · pai ${st.pai}` : ""}`,
      `filhos: ${filhos(nos, id).map((f) => `${f.id}(${f.fase})`).join(", ") || "—"}${st.depende_de.length ? ` · depende de ${st.depende_de.join(", ")}` : ""}`,
      `consumo: tokens ${c.tokens}, usd ${c.usd}, tentativas ${st.tentativas} · teto ${st.orcamento ? JSON.stringify(st.orcamento) : "herdado"}`,
      ...(st.gate_aberto ? [`gate aberto: ${TITULO_FASE[st.gate_aberto.fase]} para ${st.gate_aberto.papeis.join("/")} desde ${st.gate_aberto.ts.slice(0, 16)}`] : []),
      `gates: ${gates.length ? "\n  " + gates.join("\n  ") : "—"}`,
      `mensagens abertas para o dono: ${abertas}`,
    ];
    const larg = largura(ctx);
    const recuado = (l) => { const pre = l.match(/^ */)[0]; const ls = quebrar(l, larg, pre.length + 2, pre.length); return [pre + ls[0], ...ls.slice(1)]; };
    return { codigo: 0, msg: linhas.flatMap((l) => l.split("\n")).flatMap(recuado).join("\n"), dados: { ...st, eventos: st.eventos.length, faixa_efetiva: fe, consumo: c } };
  }
  const avisos = [];
  if (!Object.values(cfg.pessoas).some((p) => p?.chave_pub)) avisos.push("nenhuma pessoa tem chave_pub: nenhum gate humano pode ser decidido (zeno chave nova)");
  for (const r of aprovadoMudou(S)) avisos.push(`${r.no}: a seção aprovada de ${TITULO_FASE[r.fase]} mudou; rode zeno avancar ${r.no} para reabrir o gate`);
  if (S.proj.alvo.contaminadas.size) avisos.push(`marca de contaminação ativa (${S.proj.alvo.contaminadas.size} sessão(ões)): nós novos nascem não confiáveis`);
  // T77: na adoção (T74) as camadas 1–2 moram no settings.local.json gerado (no gerados.lock), não no settings.json do repo
  const gerado = (rel) => existsSync(join(S.raiz, rel)) && existsSync(P(S.raiz).gerados) && readFileSync(P(S.raiz).gerados, "utf8").includes(`  ${rel}  `);
  // T113: na fiação versionada, elas moram no settings.json gerado (também no lock)
  const fiacao = fiacaoVersionada(cfg) ? ".claude/settings.json" : ".claude/settings.local.json";
  if (adotado(cfg) ? !gerado(fiacao) : !existsSync(join(S.raiz, ".claude", "settings.json")) || cfg.local.includes(".claude/settings.json"))
    avisos.push(adotado(cfg) ? `camadas 1–2 ausentes neste alvo adotado (sem ${fiacao} gerado: zeno sync)` : "camadas 1–2 ausentes neste alvo (sem .claude/settings.json gerado)");
  const linhas = [];
  const desce = (st, nivel) => {
    linhas.push([`${"  ".repeat(nivel)}${st.id}`, st.fase, st.estado, faixaEfetiva(st, nos, cfg), st.tamanho, titulo(st.id)]);
    for (const f of filhos(nos, st.id)) desce(f, nivel + 1);
  };
  for (const st of nos.values()) if (!st.pai || !nos.has(st.pai)) desce(st, 0);
  // D40: a árvore em colunas alinhadas; os avisos antes, com recuo nas continuações
  const larg = largura(ctx);
  // o id já é o título em slug: se a coluna do título não tem 20 colunas, ela sai em vez de virar "Inc. 1 —…"
  const fixo = [0, 1, 2, 3, 4].reduce((a, j) => a + Math.max(...linhas.map((l) => l[j].length), 5) + 2, 0);
  const comTitulo = larg - fixo >= 20;
  const corpo = linhas.length ? tabela(["nó", "fase", "estado", "faixa", "T", ...(comTitulo ? ["título"] : [])], linhas.map((l) => (comTitulo ? l : l.slice(0, 5))), larg, 0) : [];
  return { codigo: 0, msg: [...avisos.flatMap((a) => quebrar(`! ${a}`, larg, 2, 0)), ...corpo].join("\n") || "grafo vazio", dados: { avisos, nos: [...nos.values()].map((s) => ({ id: s.id, fase: s.fase, estado: s.estado, pai: s.pai })) } };
}

export async function contexto(ctx, pos, o, reg) {
  const id = pos[0];
  // T83: a porta do Claude Code entrega o bloco do Zeno no SessionStart (adoção): só lê, não escreve evento
  if (o.bloco) {
    const S = reg(abrir(ctx, o, { escrever: false })), mod = S.cfg.nucleo;
    const frag = readFileSync(join(mod.dir, mod.agents_md), "utf8").trim();
    // o formato documentado do SessionStart: o texto vai em hookSpecificOutput.additionalContext (stdout cru também entra,
    // mas o JSON não depende de o texto parecer JSON nem de a ferramenta tratar stdout como contexto)
    const texto = `${frag}\n(Este bloco chega pela porta do Claude Code: o ${fiacaoVersionada(S.cfg) ? ".claude/settings.json" : ".claude/settings.local.json"} deste checkout tem as travas do Zeno. T83)`;
    return { codigo: 0, cru: JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: texto } }) + "\n" };
  }
  if (!id) throw new Recusa(2, "uso", "zeno contexto <id> [--fase f] [--sem-agents] | zeno contexto --bloco");
  const S = reg(abrir(ctx, o));
  const st = S.proj.nos.get(id);
  if (!st) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
  const fase = o.fase || (FASES.includes(st.fase) ? st.fase : "aprendizado");
  const n = lerNo(S.raiz, id), mod = S.cfg.nucleo;
  const ler = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  const camadas = {};
  camadas.agents = o["sem-agents"] ? "(AGENTS.md já carregado na sessão)\n" : ler(join(S.raiz, "AGENTS.md"));
  const pai = st.pai && lerNo(S.raiz, st.pai);
  const pedido = lerFio(caminhoFio(S.raiz, id), S.tr.deId).filter((m) => m.tipo === "pedido").at(-1);
  camadas.no = `${readFileSync(join(P(S.raiz).trabalho, `${id}.md`), "utf8")}\n` +
    (pai ? `\n### Especificação do pai (${st.pai})\n${(pai.secoes.out.especificacao || "").trim()}\n` : "") +
    (pedido ? `\n### Pedido (${pedido.id})\n${Object.entries(pedido.campos).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n` : "");
  camadas.cartao = ler(join(mod.dir, "cartoes", `${fase}.md`));
  camadas.skills = Object.entries(mod.skills || {}).filter(([, fs]) => lista(fs).includes(fase)).map(([sk]) => ler(join(mod.dir, "skills", sk, "SKILL.md"))).join("\n");
  // T107: um bloco só com os cartões das ferramentas do alvo (uma das até 3 vagas de skill por fase); a skill inteira
  // fica no caminho que o bloco cita, lida sob demanda
  if (FASES_DE_FERRAMENTA.includes(fase)) {
    const bloco = blocoDoContexto(mod, detectar(ctx, S.raiz, S.cfg));
    if (bloco) camadas.skills = [camadas.skills, bloco].filter(Boolean).join("\n");
  }
  camadas.refs = lista(n.fm.refs).map((r) => {
    const [arq, faixa] = String(r).split("#");
    const p = join(S.raiz, arq);
    if (!existsSync(p)) return `### ${r}\n(não encontrado)\n`;
    let txt = readFileSync(p, "utf8");
    const m = faixa?.match(/^L(\d+)-L(\d+)$/);
    if (m) txt = txt.split("\n").slice(Number(m[1]) - 1, Number(m[2])).join("\n");
    return `### ${r}\n${txt}\n`;
  }).join("\n");
  const palavras = semAcento(n.titulo).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const licoes = [...S.proj.nos.values()].filter((x) => x.tipo === "licao" && x.id !== id).map((x) => {
    const l = lerNo(S.raiz, x.id), t = semAcento(l.titulo + " " + l.corpo).toLowerCase();
    return { id: x.id, titulo: l.titulo, corpo: l.corpo, pontos: palavras.filter((w) => t.includes(w)).length };
  }).filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 3);
  camadas.licoes = licoes.map((l) => `### lição ${l.id}: ${l.titulo}\n${l.corpo.trim()}\n`).join("\n");
  const bytes = Object.fromEntries(Object.entries(camadas).map(([k, v]) => [k, Buffer.byteLength(v)]));
  ev(S, "contexto.montado", id, { fase, bytes: Object.values(bytes).reduce((a, b) => a + b, 0), camadas: bytes });
  const eventos = gravar(S);
  const nomes = { agents: "1. AGENTS.md", no: "2. O nó, o pai e o pedido", cartao: `3. Cartão da fase: ${TITULO_FASE[fase]}`, skills: "4. Skills da fase", refs: "5. Referências", licoes: "6. Lições" };
  const md = Object.entries(camadas).map(([k, v]) => `# ${nomes[k]}\n\n${v.trim() || "(vazio)"}\n`).join("\n");
  return { codigo: 0, msg: md, dados: { fase, camadas, bytes }, eventos };
}

// T107: zeno ferramentas [--json]. Só lê: não pega a trava, não grava evento. Saída 0 sempre (o que falta é dado).
export async function ferramentas(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  const nomes = detectar(ctx, S.raiz, S.cfg);
  const lista_ = conferir(ctx, S.raiz, S.cfg, nomes);
  const fonte = S.cfg.ferramentas.length ? "declaradas no sistema.yaml" : "detectadas no repo";
  const linhas = lista_.map((f) => [f.nome, f.presente ? "presente" : "ausente", `login ${f.login}`, f.servico ? `serviço ${f.servico}` : "", f.avisos.join("; ")].filter(Boolean).join(" · "));
  const faltam = lista_.filter((f) => !f.presente).map((f) => f.nome);
  const msg = nomes.length
    ? [`ferramentas ${fonte}:`, ...linhas.map((l) => "  " + l), faltam.length ? `faltam: ${faltam.join(", ")}` : "nada faltando"].join("\n")
    : "nenhuma ferramenta detectada neste alvo (a chave ferramentas: do sistema.yaml declara à mão)";
  return { codigo: 0, msg, dados: { fonte: S.cfg.ferramentas.length ? "sistema.yaml" : "deteccao", ferramentas: lista_ } };
}
