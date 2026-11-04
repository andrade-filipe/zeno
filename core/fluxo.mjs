// fluxo.mjs — sair de uma fase: artefato, regras extras, gate (check ou humano), disjuntor (spec/fases.md, spec/controle.md).
import { lerNo, chaves, shaArtefato, escreverChave, secoes, caminhoFio } from "./no.mjs";
import { lerFio } from "./mensagens.mjs";
import { gateDaFase, pessoasDoPapel, faixaEfetiva, filhos, passouDaEntrega, estouro, pausadoNaCadeia, tetoDiario } from "./projecao.mjs";
import { ev, msgFio, gravarCorpo, gravar, lerLedger } from "./sessao.mjs";
import { travar, destravar } from "./config.mjs";
import * as L from "./ledger.mjs";
import { nivelDoRisco, itensDoConferir } from "./vista.mjs";
import { FASES, TITULO_FASE, ehAgente, duracao, sha256, lista, semAcento, Recusa } from "./util.mjs";

export const OBR = { intencao: ["porque"], especificacao: ["pronto"], execucao: ["feito"], verificacao: ["evidencia"], entrega: ["ref", "desfazer"], observacao: ["observado"], aprendizado: ["atrito"] };
const OBR_MG = { intencao: ["para", "fora"], especificacao: ["restricoes", "riscos"], verificacao: ["pronto-confere"] };
export const FASE_DA_CHAVE = { porque: "intencao", para: "intencao", fora: "intencao", pronto: "especificacao", restricoes: "especificacao", riscos: "especificacao",
  feito: "execucao", evidencia: "verificacao", "pronto-confere": "verificacao", sessao: "verificacao", ref: "entrega", desfazer: "entrega", observado: "observacao", atrito: "aprendizado" };
export const proxima = (f) => FASES[FASES.indexOf(f) + 1] ?? "fechado";

// T75 (D36): cartão de decisão — 6 campos em linguagem simples, na seção da fase do gate humano. Texto do nó, não do ledger.
export const CARTAO = { "cartao-muda": "O que muda", "cartao-porque": "Por quê", "cartao-risco": "Risco", "cartao-desfazer": "Como desfazer",
  "cartao-reprovar": "Se reprovar", "cartao-conferir": "Vale conferir" };
const CARTAO_MIN = 8, CARTAO_MAX = 160, CARTAO_ITEM_MAX = 100;
const normal = (s) => semAcento(s).toLowerCase().replace(/[.!]+$/, "").trim();
const itensConferir = (v) => (String(v).match(/\(\d\)/g) || []).length || String(v).split(";").filter((x) => x.trim()).length;

// A fase em que o cartão mora: a do próximo gate humano a partir da fase atual (ou a atual, se não houver).
function faseDoCartao(S, st) {
  const i = FASES.indexOf(st.fase);
  if (i >= 0) for (const f of FASES.slice(i)) if (gateDaFase(st, S.proj.nos, S.cfg, f).tipo === "humano") return f;
  return st.fase;
}

// Lint do cartão: campo que falta, vazio, genérico ("ok", "ver acima": lint.yaml) ou curto demais; conferir com 1 a 3 itens.
export function faltaCartao(S, secao) {
  const ks = chaves(secao), out = [];
  const vazios = new Set(lista(S.cfg.nucleo?.lintObj?.vazios).map(normal));
  for (const [k, rot] of Object.entries(CARTAO)) {
    const v = ks[k];
    if (!v) out.push({ chave: k, msg: `falta ${k} (${rot})` });
    else if (vazios.has(normal(v)) || v.replace(/\s/g, "").length < CARTAO_MIN) out.push({ chave: k, msg: `${k} não se explica sozinho ("${v}")` });
    else if (k === "cartao-conferir" && itensConferir(v) > 3) out.push({ chave: k, msg: `${k} pede de 1 a 3 coisas a conferir (achei ${itensConferir(v)}; separe com ";" ou "(1) … (2) …")` });
    // D40: frase curta é parte do cartão — teto por campo e por item do conferir; o risco começa pelo nível
    else if (k === "cartao-conferir" && itensDoConferir(v).some((x) => x.length > CARTAO_ITEM_MAX)) out.push({ chave: k, msg: `${k}: cada item cabe em ${CARTAO_ITEM_MAX} caracteres (o maior tem ${Math.max(...itensDoConferir(v).map((x) => x.length))})` });
    else if (k !== "cartao-conferir" && v.length > CARTAO_MAX) out.push({ chave: k, msg: `${k} cabe em ${CARTAO_MAX} caracteres (tem ${v.length}): uma frase curta; o detalhe fica nas seções` });
    else if (k === "cartao-risco" && !nivelDoRisco(v).nivel) out.push({ chave: k, msg: `${k} começa pelo nível: "alto: …", "baixo: …" ou "nenhum: …"` });
  }
  return out;
}

// O cartão pronto para ler (caixa --aprovar, gate --aprovar): null se a seção não tem cartão.
export function cartaoDe(secao) {
  const ks = chaves(secao);
  if (!Object.keys(CARTAO).some((k) => ks[k])) return null;
  return Object.entries(CARTAO).map(([k, rot]) => `${rot}: ${ks[k] ?? "(falta)"}`);
}

function corpoAtual(S, id) {
  const w = S.nosEscritos.get(id);
  if (w) return w;
  const n = lerNo(S.raiz, id);
  return { fm: n.fm, corpo: n.corpo };
}

// Escreve chaves de artefato no corpo (só em fases que o nó ainda não passou).
export function escreverChaves(S, id, kv) {
  const st = S.proj.nos.get(id);
  let { fm, corpo } = corpoAtual(S, id);
  const porFase = {};
  let fc = null;
  for (const [k, v] of Object.entries(kv)) {
    if (v === undefined || v === null || v === true) continue;
    const f = k in CARTAO ? (fc ??= faseDoCartao(S, st)) : FASE_DA_CHAVE[k];
    if (FASES.indexOf(f) < FASES.indexOf(st.fase)) throw new Recusa(1, "fase-passada", `a chave ${k} é da fase ${f}, que o nó já passou`);
    corpo = escreverChave(corpo, f, k, v);
    (porFase[f] ||= []).push([k, v]);
  }
  for (const [f, kvs] of Object.entries(porFase)) ev(S, "artefato.escrito", id, { fase: f, chaves: kvs.map(([k]) => k), bytes: kvs.reduce((s, [k, v]) => s + Buffer.byteLength(`- ${k}: ${v}\n`), 0) });
  gravarCorpo(S, id, fm, corpo);
}

function faltando(S, st, fase) {
  let { fm, corpo } = corpoAtual(S, st.id);
  const { out } = lerNoCorpo(corpo);
  let ks = chaves(out[fase]);
  // preenchimento automático proporcional (fases.md): Observação sem janela, Aprendizado sem atrito
  if (fase === "observacao" && !ks.observado && duracao(st.janela) === 0) { corpo = escreverChave(corpo, fase, "observado", "sem janela"); gravarCorpo(S, st.id, fm, corpo); ks.observado = "sem janela"; }
  if (fase === "aprendizado" && !ks.atrito && st.atrito.length === 0) { corpo = escreverChave(corpo, fase, "atrito", "nenhum"); gravarCorpo(S, st.id, fm, corpo); ks.atrito = "nenhum"; (S.atritoPadrao ||= new Set()).add(st.id); }
  const req = [...OBR[fase], ...(st.tamanho !== "P" ? OBR_MG[fase] || [] : [])];
  const falta = req.filter((k) => !ks[k]);
  if (fase === "aprendizado" && ks.atrito && /^nenhum$/i.test(ks.atrito) && st.atrito.length) falta.push("atrito (houve atrito no ledger deste nó: descreva)");
  if (fase === "verificacao" && st.tamanho === "G" && ks.sessao !== "nova") falta.push("sessao: nova (Verificação de nó G em sessão nova)");
  return falta;
}
const lerNoCorpo = (corpo) => secoes(corpo);

function regrasExtras(S, st, fase) {
  const nos = S.proj.nos;
  if (fase === "especificacao") {
    for (const d of st.depende_de) { const n = nos.get(d); if (!n || !(passouDaEntrega(n) || n.estado === "cancelado")) throw new Recusa(1, "depende", `depende de ${d}, que ainda não passou da Entrega`); }
    if (st.tamanho !== "P" && ehAgente(st.executor) && st.criador !== st.executor) {
      if (!lerFio(caminhoFio(S.raiz, st.id), S.tr.deId).some((m) => m.tipo === "pedido") && !S.fios.some((f) => f.no === st.id && f.m.tipo === "pedido"))
        throw new Recusa(1, "delegacao", "nó delegado a agente precisa de um pedido no fio (zeno msg <id> pedido …)");
    }
  }
  if (fase === "execucao" && /*G:faixa-nunca*/ faixaEfetiva(st, nos, S.cfg) === "nunca" && ehAgente(S.ator))
    throw new Recusa(1, "faixa-nunca", "faixa nunca: só uma pessoa sai da Execução");
  if (fase === "verificacao") {
    const abertos = filhos(nos, st.id).filter((f) => !passouDaEntrega(f) && f.estado !== "cancelado");
    if (abertos.length) throw new Recusa(1, "filhos", `filhos que ainda não passaram da Entrega: ${abertos.map((f) => f.id).join(", ")}`);
  }
  if (fase === "observacao") {
    const j = duracao(st.janela) ?? 0;
    if (j > 0 && st.entrega_ts && S.ctx.agora() - Date.parse(st.entrega_ts) < j) throw new Recusa(1, "janela", `a janela de Observação (${st.janela}) ainda não passou`);
  }
}

// Checks rodam FORA da trava (T44); depois a trava volta e o estado do nó tem de ser o mesmo.
function rodarChecks(S, st, nomes) {
  const res = [];
  const antes = st.eventos.length;
  if (nomes.length && S.trava) { gravar(S); destravar(S.trava); S.trava = null; }
  for (const n of nomes) {
    const cmd = S.cfg.checks[n];
    if (!cmd) { res.push({ nome: n, exit: 127, ms: 0 }); continue; }
    const r = S.ctx.rodar(cmd, { cwd: S.raiz });
    res.push({ nome: n, exit: r.status, ms: r.ms });
  }
  if (nomes.length && !S.trava) {
    S.trava = travar(S.raiz, S.ctx.agora);
    lerLedger(S);
    S.reprojetar();
    const agora = S.proj.nos.get(st.id);
    if (agora.eventos.length !== antes) throw new Recusa(5, "concorrencia", "o nó mudou enquanto os checks rodavam; rode de novo");
  }
  return res;
}

function linhasDoCommit(S, ref) {
  if (!/^[0-9a-f]{7,40}$/.test(ref)) return null;
  const r = S.ctx.git(["show", "--numstat", "--format=", ref], { cwd: S.raiz });
  if (r.status !== 0) return null;
  // o que o Sistema escreve (.agents/) não conta: a contramétrica mede o trabalho, não a contabilidade dele (T65)
  return r.stdout.split("\n").reduce((s, l) => { const m = l.match(/^(\d+)\t(\d+)\t(.*)$/); return m && !/(^|\/)\.agents\//.test(m[3]) ? s + Number(m[1]) + Number(m[2]) : s; }, 0);
}

// T76 (D36): o que a via expressa de código pode tocar. A prova das guardas (guardas.json, test/probes/, test/censo.mjs,
// test/ajuda.mjs, test/fp-shell.mjs, test/fixtures/) fica de fora: mudá-la pede gate humano com cartão. T79: o
// spec/decisoes-tecnicas.md entra só por acréscimo; o resto do spec/ pede gate.
export const ehCodigoExpresso = (p) => p === "cli.mjs" || /^(core|bin|modulos)\//.test(p) || /^test\/[^/]+\.test\.mjs$/.test(p);
function foraDoCodigo(S, id, ref) {
  const r0 = String(ref || "").split(/\s/)[0];
  const volta = `(para seguir com gate: zeno ajustar ${id} faixa=aprovacao)`;
  if (!/^[0-9a-f]{7,40}$/.test(r0)) return `a via expressa de código pede ref = um commit (veio "${ref}") ${volta}`;
  const pre = S.ctx.git(["rev-parse", "--show-prefix"], { cwd: S.raiz });
  const r = S.ctx.git(["diff-tree", "--no-commit-id", "--numstat", "-r", "--root", r0], { cwd: S.raiz });
  if (pre.status !== 0 || r.status !== 0) return `não consegui ler os arquivos do commit ${r0} ${volta}`;
  const prefixo = pre.stdout.trim(), arqs = r.stdout.split("\n").filter(Boolean).map((l) => l.split("\t"));
  if (!arqs.length) return `o commit ${r0} não muda arquivo nenhum (merge?) ${volta}`;
  // T79: a decisão técnica do próprio conserto entra no mesmo commit, só por acréscimo (nenhuma linha removida)
  const dentro = ([, del, p]) => p.startsWith(prefixo) && (ehCodigoExpresso(p.slice(prefixo.length)) || (p.slice(prefixo.length) === "spec/decisoes-tecnicas.md" && del === "0"));
  const fora = arqs.filter((a) => !dentro(a)).map(([, , p]) => p);
  return fora.length ? `o commit ${r0} toca fora do código da via expressa: ${fora.slice(0, 3).join(", ")}${fora.length > 3 ? ` (+${fora.length - 3})` : ""} ${volta}` : null;
}

function disjuntor(S, id) {
  const e = estouro(S.proj.nos, id);
  if (!e) return null;
  const st = S.proj.nos.get(e.no_limite);
  if (st.estado === "pausado") return e;
  ev(S, "disjuntor.disparou", id, e);
  msgFio(S, e.no_limite, { id: "m-" + S.buf.at(-1).id, tipo: "escalada", ts: S.buf.at(-1).ts.slice(0, 16) + "Z", de: S.ator, para: [st.dono],
    campos: { travou: `orçamento de ${e.no_limite}: ${e.limite} ${e.consumo} de ${e.teto}`, tentado: `seguir com ${id}`, precisa: `uma pessoa decidir: zeno gate ${e.no_limite} --orcamento ${e.limite}=+N` } });
  return e;
}

export function checarOrcamento(S, id) {
  const p = pausadoNaCadeia(S.proj.nos, id);
  if (p) throw new Recusa(4, "orcamento", `${p.id} está pausado pelo disjuntor; só uma pessoa solta: zeno gate ${p.id} --orcamento dim=+N, ou --despausar --motivo …`);
  const dia = new Date(S.ctx.agora()).toISOString().slice(0, 10);
  const t = tetoDiario(S.proj, S.cfg, dia);
  if (t) throw new Recusa(4, "teto-diario", `teto diário do alvo estourado (${t.dimensao}: ${t.consumo} de ${t.teto}); volta na virada do dia UTC, ou uma pessoa libera o dia: zeno gate --teto ${t.dimensao}=+N`);
}

// Tenta sair da fase atual. Devolve { codigo, msg }: 0 avançou; 1 incompleto/reprovado; 3 gate humano; 4 disjuntor.
export function tentarSair(S, id) {
  checarOrcamento(S, id);
  let st = S.proj.nos.get(id);
  if (["fechado", "cancelado"].includes(st.estado)) throw new Recusa(1, "estado", `${id} está ${st.estado}`);
  if (st.estado === "em-gate") return { codigo: 3, msg: `${id}: gate humano aberto em ${st.gate_aberto.fase}, esperando ${st.gate_aberto.papeis.join("/")}` };
  const { corpo } = corpoAtual(S, id);
  // T15: seção aprovada que mudou reabre o gate daquela fase
  for (const [f, sha] of Object.entries(st.aprovados)) {
    if (/*G:aprovado-mudou*/ shaArtefato(corpo, f) !== sha) {
      const g = gateDaFase(st, S.proj.nos, S.cfg, f);
      ev(S, "gate.aberto", id, { fase: f, tipo: "humano", papeis: g.papeis.length ? g.papeis : ["revisor"], pessoas: pessoasDoPapel(st, g.papeis.length ? g.papeis : ["revisor"]), reabertura: true, artefato_sha256: shaArtefato(corpo, f) });
      return { codigo: 3, msg: `${id}: a seção aprovada em ${f} mudou; o gate de ${f} foi reaberto` };
    }
  }
  const fase = st.fase;
  const falta = faltando(S, st, fase);
  if (falta.length) { ev(S, "artefato.incompleto", id, { fase, faltando: falta }); return { codigo: 1, msg: `${id}: falta em ${TITULO_FASE[fase]}: ${falta.join(", ")}` }; }
  regrasExtras(S, st, fase);
  const g = gateDaFase(st, S.proj.nos, S.cfg, fase);
  if (g.tipo === "juiz") throw new Recusa(6, "juiz", "gate juiz é do Inc. 4");
  if (g.tipo === "humano") {
    // T75: gate humano só abre com o cartão de decisão completo (o ledger guarda só os nomes dos campos)
    const fc = /*G:cartao-gate*/ faltaCartao(S, lerNoCorpo(corpoAtual(S, id).corpo).out[fase]);
    if (fc.length) {
      ev(S, "artefato.incompleto", id, { fase, faltando: fc.map((x) => x.chave) });
      return { codigo: 1, msg: `${id}: o gate humano de ${TITULO_FASE[fase]} pede o cartão de decisão: ${fc.map((x) => x.msg).join("; ")} (zeno avancar ${id} --cartao-muda "…" …)` };
    }
    // T87: o sha da seção na abertura; a caixa marca o gate cujo texto mudou depois (e o tira do "todos")
    ev(S, "gate.aberto", id, { fase, tipo: "humano", papeis: g.papeis, pessoas: pessoasDoPapel(st, g.papeis), artefato_sha256: shaArtefato(corpoAtual(S, id).corpo, fase) });
    return { codigo: 3, msg: `${id}: gate humano de ${TITULO_FASE[fase]} aberto para ${pessoasDoPapel(st, g.papeis).join(", ")} (zeno caixa --aprovar)` };
  }
  // gate check
  const nomes = fase === "verificacao" ? (st.checks.length ? st.checks : S.cfg.checksPadrao) : [];
  const checks = rodarChecks(S, st, nomes);
  st = S.proj.nos.get(id);
  let motivo = checks.find((c) => c.exit !== 0) ? `check ${checks.find((c) => c.exit !== 0).nome} falhou` : null;
  if (!motivo && fase === "entrega" && st.tamanho === "P") {
    const ref = chaves(lerNoCorpo(corpoAtual(S, id).corpo).out.entrega).ref;
    const n = ref ? linhasDoCommit(S, ref.split(/\s/)[0]) : null;
    if (/*G:piso-faixa*/ n !== null && n > S.cfg.limites.P_linhas) motivo = `o commit ${ref} muda ${n} linhas; P vai até ${S.cfg.limites.P_linhas}`;
  }
  // T76: a via expressa de código só vale se o commit da ref fica no código do zeno, sem a prova das guardas
  if (!motivo && fase === "entrega" && st.codigo) motivo = /*G:expressa-codigo*/ foraDoCodigo(S, id, chaves(lerNoCorpo(corpoAtual(S, id).corpo).out.entrega).ref);
  const decisao = motivo ? "reprovado" : "aprovado";
  const gd = ev(S, "gate.decidido", id, { fase, tipo: "check", decisao, modo: "real", decisor: { tipo: "check", id: "zeno" }, espera_ms: 0, evidencia: { checks, motivo_sha256: motivo ? sha256(motivo) : null } });
  if (motivo) {
    const d = disjuntor(S, id);
    return { codigo: d ? 4 : 1, msg: `${id}: gate de ${TITULO_FASE[fase]} reprovado: ${motivo}${d ? " — disjuntor disparou" : ""}` };
  }
  // T70: o "atrito: nenhum" que a CLI preencheu sozinha fica marcado (não é o mesmo que uma pessoa dizer que não houve atrito)
  ev(S, "fase.avancou", id, { de: fase, para: proxima(fase), gate: gd.id, ...(fase === "aprendizado" && S.atritoPadrao?.has(id) ? { atrito_padrao: true } : {}) });
  return { codigo: 0, msg: `${id}: ${TITULO_FASE[fase]} → ${proxima(fase) === "fechado" ? "fechado" : TITULO_FASE[proxima(fase)]}` };
}

// Decisão humana assinada (a chave da pessoa já foi aberta nesta chamada).
export function decidirGate(S, id, aprovar, motivo) {
  const st = S.proj.nos.get(id);
  if (!st || st.estado !== "em-gate") throw new Recusa(1, "gate", `${id} não tem gate humano aberto`);
  const fase = st.gate_aberto.fase;
  if (!pessoasDoPapel(st, st.gate_aberto.papeis).includes(S.ator)) throw new Recusa(1, "papel", `${S.ator} não tem o papel ${st.gate_aberto.papeis.join("/")} em ${id}`);
  if (!aprovar && !motivo) throw new Recusa(2, "motivo", "reprovar pede --motivo");
  const { corpo } = corpoAtual(S, id);
  const gd = ev(S, "gate.decidido", id, { fase, tipo: "humano", decisao: aprovar ? "aprovado" : "reprovado", modo: "real", decisor: { tipo: "humano", id: S.ator },
    espera_ms: S.ctx.agora() - Date.parse(st.gate_aberto.ts), artefato_sha256: shaArtefato(corpo, fase), evidencia: { checks: [], motivo_sha256: motivo ? sha256(motivo) : null } }, { assinar: true });
  msgFio(S, id, { id: "m-" + gd.id, tipo: "decisao", ts: gd.ts.slice(0, 16) + "Z", de: S.ator, para: [st.executor],
    campos: { "o-que": `gate ${fase} ${aprovar ? "aprovado" : "reprovado"}`, porque: motivo || "sem motivo", alternativas: "aprovar, reprovar", "quem-decidiu": S.ator } });
  if (aprovar && fase === st.fase) ev(S, "fase.avancou", id, { de: fase, para: proxima(fase), gate: gd.id });
  return gd;
}
