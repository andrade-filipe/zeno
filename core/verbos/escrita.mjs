// escrita.mjs — verbos que mudam o estado: novo, avancar, gate, caixa --aprovar, ajustar, msg, registrar, chave.
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { prepararPromover, executarPromover } from "./promover.mjs";
import { randomBytes } from "node:crypto";
import { abrir, ev, gravar, gravarCorpo, msgFio, exigirPessoa, exigirChaveConfigurada, abrirChaveDaPessoa, comTentativas } from "../sessao.mjs";
import { tentarSair, decidirGate, escreverChaves, FASE_DA_CHAVE, CARTAO, cartaoDe, checarOrcamento, proxima } from "../fluxo.mjs";
import { faixaEfetiva, gateDaFase, pessoasDoPapel, ehAfrouxar, estouro, tetoDiario, ancestrais, consumo } from "../projecao.mjs";
import { corpoInicial, escreverChave, caminhoFio, caminhoNo, lerNo, chaves, shaArtefato } from "../no.mjs";
import { lerFio, lint, CLAUSULA, TIPOS_MSG } from "../mensagens.mjs";
import { gerarPar, gravarChave, abrirPrivada, pubDe, pemDe } from "../assinatura.mjs";
import { ehPessoa, P } from "../config.mjs";
import { FASES, TITULO_FASE, TIPOS, TAMANHOS, FAIXAS, faixaRank, maxFaixa, ehAgente, slug, duracao, num, lista, faseIdx, sha256, semanaIso, Recusa } from "../util.mjs";
import { vistaGate, pedeOlho, resumoCaixa, detalheGate } from "../vista.mjs";
import { largura, estilo, quebrar } from "../tela.mjs";

const NAO_CONFIAVEIS = ["web", "issue", "doc", "mcp", "sessao"];
export const JANELA_PADRAO = { P: "3d", M: "7d", G: "7d" };
const classe = (o) => String(o).split(":")[0];

function parseOrcamento(s) {
  if (!s) return null;
  const o = {};
  for (const par of String(s).split(",")) {
    const m = par.trim().match(/^(tokens|usd|tentativas|prazo)=(.+)$/);
    if (!m) throw new Recusa(2, "uso", `orçamento fora do formato dim=valor: ${par}`);
    o[m[1]] = m[1] === "prazo" ? m[2] : Number(m[2]);
    if (m[1] !== "prazo" && !(o[m[1]] >= 0)) throw new Recusa(2, "uso", `valor inválido em ${par}`);
  }
  return o;
}

function papelValido(cfg, x) { return ehPessoa(cfg, x) || cfg.agentes.includes(x) || ehAgente(x); }

// T117: o nó aberto por um sensor (origem sensor:<nome>, a revisão semanal que lê o placar da avaliacao/). O controle
// impõe a trava: no máximo SENSOR_SEMANA nós de sensor por semana ISO no alvo, e um por sensor por semana. O zeno/ não
// calcula teto nem faixa e não lê o export da avaliacao/: só conta os no.criado com `sensor` no próprio ledger.
export const SENSOR_SEMANA = 5;
const NOME_SENSOR = /^[a-z0-9][a-z0-9-]{0,31}$/;
function sensorDe(S, origem) {
  const ss = origem.filter((x) => classe(x) === "sensor").map((x) => String(x).slice(7));
  if (!ss.length) return null;
  if (ss.length > 1) throw new Recusa(2, "uso", "um nó tem no máximo uma origem sensor:<nome>");
  if (!NOME_SENSOR.test(ss[0])) throw new Recusa(2, "uso", `nome de sensor fora do formato (a-z, 0-9 e -): sensor:${ss[0]}`);
  const semana = semanaIso(S.ctx.agora());
  const daSemana = [...S.led.eventos, ...S.buf].filter((e) => e.ev === "no.criado" && e.dados?.sensor && semanaIso(Date.parse(e.ts)) === semana);
  if (/*G:trava-sensor*/ daSemana.some((e) => e.dados.sensor === ss[0])) throw new Recusa(1, "sensor", `o sensor ${ss[0]} já abriu um nó na semana ${semana}: um por sensor por semana`);
  if (/*G:trava-sensor*/ daSemana.length >= SENSOR_SEMANA) throw new Recusa(1, "sensor", `a semana ${semana} já tem ${daSemana.length} nós de sensor neste alvo (no máximo ${SENSOR_SEMANA})`);
  return ss[0];
}

// Cria um nó (novo e registrar --retro).
function criarNo(S, titulo, o) {
  const { cfg } = S, nos = S.proj.nos;
  const tamanho = o.tamanho, tipo = o.tipo || "tarefa";
  if (!TIPOS.includes(tipo)) throw new Recusa(2, "uso", `tipo desconhecido: ${tipo}`);
  const pai = o.pai ? nos.get(o.pai) : null;
  if (o.pai && !pai) throw new Recusa(1, "ref", `pai inexistente: ${o.pai}`);
  if (pai && ["fechado", "cancelado"].includes(pai.estado)) throw new Recusa(1, "ref", `pai ${o.pai} está ${pai.estado}`);
  if (pai) checarOrcamento(S, pai.id);
  const dia = new Date(S.ctx.agora()).toISOString().slice(0, 10), td = tetoDiario(S.proj, cfg, dia);
  if (td) throw new Recusa(4, "teto-diario", `teto diário estourado (${td.dimensao}); volta na virada do dia UTC, ou uma pessoa libera o dia: zeno gate --teto ${td.dimensao}=+N`);
  const piso = cfg.padrao[tamanho];
  const faixa = o.faixa || piso;
  if (!FAIXAS.includes(faixa)) throw new Recusa(2, "uso", `faixa desconhecida: ${faixa}`);
  if (/*G:piso-faixa*/ ehAgente(S.ator) && faixaRank(faixa) < faixaRank(piso)) throw new Recusa(1, "piso-faixa", `agente não declara faixa abaixo do piso de ${tamanho} (${piso})`);
  const dono = o.dono || cfg.padraoPapeis.dono, revisor = o.revisor || cfg.padraoPapeis.revisor || dono, executor = o.executor || S.ator;
  for (const [p, v] of [["dono", dono], ["revisor", revisor], ["executor", executor]]) if (!v || !papelValido(cfg, v)) throw new Recusa(1, "papel", `${p} desconhecido: ${v}`);
  const origem = [...lista(o.origem)];
  origem.push(ehAgente(S.ator) ? S.ator : `pessoa:${S.ator}`);
  if (/*G:contaminacao*/ S.proj.alvo.contaminadas.size) origem.push("sessao:contaminada");
  if (pai && pai.procedencia === "nao-confiavel") origem.push(`no:${pai.id}`);
  const classes = [...new Set(origem.map(classe))];
  const procedencia = origem.some((x) => NAO_CONFIAVEIS.includes(classe(x)) || (classe(x) === "no" && nos.get(x.slice(3))?.procedencia === "nao-confiavel")) ? "nao-confiavel" : "confiavel";
  const sensor = sensorDe(S, origem);
  const acoes = lista(o.acao);
  for (const a of acoes) if (!cfg.acoes[a]) throw new Recusa(1, "acao", `ação desconhecida na tabela de faixas: ${a}`);
  const depende_de = lista(o.depende);
  for (const d of depende_de) if (!nos.has(d)) throw new Recusa(1, "ref", `depende de nó inexistente: ${d}`);
  const checks = lista(o.check);
  for (const c of checks) if (!cfg.checks[c]) throw new Recusa(1, "check", `check desconhecido no sistema.yaml: ${c}`);
  // T102 (Filipe, 2026-11-03): sem --janela, a Observação dura pelo tamanho; a via expressa fecha de uma vez (0d)
  const janela = o.janela || (o.expressa ? "0d" : JANELA_PADRAO[o.tamanho] ?? "0d");
  if (duracao(janela) === null) throw new Recusa(2, "uso", `janela fora do formato <n>d|<n>h: ${janela}`);
  const orcamento = parseOrcamento(o.orcamento);
  if (orcamento && pai) {
    const comT = [pai, ...ancestrais(nos, pai.id)].find((n) => n.orcamento);
    if (comT) { const c = consumo(nos, comT.id); for (const dim of ["tokens", "usd"]) { const t = num(comT.orcamento[dim]); if (t !== null && orcamento[dim] !== undefined && orcamento[dim] > t - c[dim]) throw new Recusa(1, "orcamento", `${dim} ${orcamento[dim]} passa do saldo de ${comT.id} (${t - c[dim]})`); } }
  }
  // T76: --codigo é a via expressa de código do zeno (P, alvo que é o próprio código do zeno); o commit é conferido na Entrega
  if (o.codigo && !o.expressa) throw new Recusa(2, "uso", "--codigo é da via expressa: zeno novo \"…\" --expressa --codigo --porque \"…\"");
  if (o.codigo && !(existsSync(join(S.raiz, "cli.mjs")) && existsSync(join(S.raiz, "core", "run.mjs")))) throw new Recusa(1, "expressa", "--codigo só vale no alvo que é o código do zeno (cli.mjs e core/run.mjs na raiz)");
  const prev = { id: "?", tipo, tamanho, faixa, acoes, procedencia, pai: pai?.id ?? null, dono, executor, revisor, codigo: !!o.codigo };
  const fe = faixaEfetiva(prev, nos, cfg);
  if (o.expressa && fe !== "autonoma") throw new Recusa(1, "expressa", `via expressa pede faixa efetiva autônoma; esta é ${fe}`);
  if (/*G:faixa-nunca*/ fe === "nunca" && ehAgente(executor)) throw new Recusa(1, "faixa-nunca", "faixa nunca: o executor tem de ser uma pessoa");
  for (const [fase, papeis] of Object.entries(cfg.gates[fe] || {})) if (!fase.endsWith("_sombra") && lista(papeis).length && !pessoasDoPapel(prev, lista(papeis)).length) throw new Recusa(1, "papel", `o gate humano de ${fase} não tem pessoa (${lista(papeis).join("/")})`);
  let id;
  if (cfg.fronteira === "pessoal") {
    const b = slug(titulo) || "no";
    id = b;
    for (let k = 2; nos.has(id) || existsSync(caminhoNo(S.raiz, id)); k++) id = `${b}-${k}`;
  } else do id = "n-" + randomBytes(3).toString("hex"); while (nos.has(id) || existsSync(caminhoNo(S.raiz, id)));
  const dados = { pai: pai?.id ?? null, tipo, tamanho, faixa, acoes, procedencia, origem_classes: classes, depende_de, dono, executor, revisor, orcamento, janela, checks, expressa: !!o.expressa, ...(o.codigo ? { codigo: true } : {}), ...(sensor ? { sensor } : {}) };
  const e = ev(S, "no.criado", id, dados);
  const fm = { zeno: 1, id, titulo, criado: e.ts_fato || e.ts, origem, modulo: "nucleo", refs: o.refs ? lista(o.refs) : undefined, fundamento: o.fundamento };
  gravarCorpo(S, id, fm, corpoInicial(titulo));
  if (fe !== faixa) ev(S, "faixa.alterada", id, { de: faixa, para: fe, motivo: procedencia === "nao-confiavel" ? "procedencia" : acoes.length ? "acao" : "heranca" });
  return id;
}

const chavesDe = (o) => {
  const errado = Object.keys(o).find((k) => k.startsWith("cartao-") && !(k in CARTAO));
  if (errado) throw new Recusa(2, "uso", `campo de cartão desconhecido: --${errado} (os campos: ${Object.keys(CARTAO).map((k) => "--" + k).join(", ")})`);
  return Object.fromEntries([...Object.keys(FASE_DA_CHAVE), ...Object.keys(CARTAO)].filter((k) => typeof o[k] === "string").map((k) => [k, o[k]]));
};

export async function novo(ctx, pos, o, reg) {
  const titulo = pos[0];
  if (!titulo) throw new Recusa(2, "uso", 'zeno novo "<título>" --tamanho P|M|G');
  if (o.expressa) { o.tamanho ??= "P"; o.faixa ??= "autonoma"; if (!o.porque) throw new Recusa(2, "uso", "--expressa pede --porque"); if (o.tamanho !== "P") throw new Recusa(2, "uso", "--expressa é só para P"); }
  if (!TAMANHOS.includes(o.tamanho)) throw new Recusa(2, "uso", "--tamanho P|M|G é obrigatório");
  const S = reg(abrir(ctx, o));
  const id = criarNo(S, titulo, o);
  const kv = chavesDe(o);
  if (Object.keys(kv).length) escreverChaves(S, id, kv);
  const eventos = gravar(S);
  if (!existsSync(caminhoFio(S.raiz, id))) writeFileSync(caminhoFio(S.raiz, id), "");
  const st = S.proj.nos.get(id);
  return { codigo: 0, msg: id, dados: { id, faixa_efetiva: faixaEfetiva(st, S.proj.nos, S.cfg) }, eventos };
}

function andar(S, id, ate) {
  const msgs = [];
  let r;
  for (;;) {
    r = tentarSair(S, id);
    msgs.push(r.msg);
    const st = S.proj.nos.get(id);
    if (r.codigo !== 0 || !ate || st.fase === ate || faseIdx(st.fase) >= faseIdx(ate)) break;
  }
  return { codigo: r.codigo, msg: msgs.join("\n") };
}

export async function avancar(ctx, pos, o, reg) {
  const id = pos[0];
  if (!id) throw new Recusa(2, "uso", "zeno avancar <id> [--ate <fase|fim>]");
  const ate = o.ate ? (o.ate === "fim" ? "fechado" : o.ate) : null;
  if (ate && faseIdx(ate) < 0) throw new Recusa(2, "uso", `fase desconhecida: ${o.ate}`);
  const S = reg(abrir(ctx, o));
  if (!S.proj.nos.has(id)) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
  const kv = chavesDe(o);
  if (Object.keys(kv).length) escreverChaves(S, id, kv);
  const r = andar(S, id, ate);
  const eventos = gravar(S);
  return { ...r, dados: { id, fase: S.proj.nos.get(id).fase, estado: S.proj.nos.get(id).estado }, eventos };
}

export async function gate(ctx, pos, o, reg) {
  const id = pos[0];
  const S = reg(abrir(ctx, o));
  exigirPessoa(S, "decidir um gate");
  exigirChaveConfigurada(S);
  if (o.descontaminar) {
    await abrirChaveDaPessoa(S);
    ev(S, "contaminacao.limpa", null, { sessao_sha256: null, como: "pessoa" }, { assinar: true });
    return { codigo: 0, msg: "marca de contaminação limpa", eventos: gravar(S) };
  }
  if (o.teto !== undefined) {
    // T93: o OK de custo do dia (C13): soma ao teto diário do alvo só no dia UTC de hoje; a config do alvo não muda
    const dia = new Date(S.ctx.agora()).toISOString().slice(0, 10), acrescimo = {};
    for (const par of String(o.teto).split(",")) {
      const m = par.trim().match(/^(tokens|usd)=\+(\d+(\.\d+)?)$/);
      if (!m) throw new Recusa(2, "uso", `--teto dim=+N (tokens ou usd): ${par}`);
      if (S.cfg.teto[m[1]] === null) throw new Recusa(2, "uso", `o alvo não tem teto diário de ${m[1]}: nada a liberar`);
      acrescimo[m[1]] = (acrescimo[m[1]] || 0) + Number(m[2]);
    }
    await abrirChaveDaPessoa(S);
    ev(S, "orcamento.alterado", null, { dia, acrescimo }, { assinar: true });
    const x = { tokens: 0, usd: 0, ...S.proj.alvo.tetoExtra.get(dia) };
    const vale = Object.keys(acrescimo).map((dim) => `${dim} ${S.cfg.teto[dim] + x[dim] + acrescimo[dim]}`).join(", ");
    return { codigo: 0, msg: `teto diário de ${dia} (UTC): ${vale}; amanhã volta o teto da config`, dados: { dia, acrescimo }, eventos: gravar(S) };
  }
  if (!id || !S.proj.nos.has(id)) throw new Recusa(2, "uso", "zeno gate <id> --aprovar|--reprovar --motivo … | --orcamento dim=+N | --despausar --motivo … · zeno gate --teto dim=+N | --descontaminar (sem id)");
  const st = S.proj.nos.get(id);
  if (o.despausar) {
    // T98: soltar o disjuntor sem subir o teto (o gasto foi erro de medida, ou o orçamento baixou e a pessoa quer seguir)
    if (st.estado !== "pausado") throw new Recusa(1, "estado", `${id} não está pausado (estado ${st.estado})`);
    if (typeof o.motivo !== "string" || !o.motivo.trim()) throw new Recusa(2, "uso", 'zeno gate <id> --despausar --motivo "<por que soltar sem subir o teto>"');
    await abrirChaveDaPessoa(S);
    ev(S, "disjuntor.liberado", id, { motivo: o.motivo, orcamento: st.orcamento || null }, { assinar: true });
    return { codigo: 0, msg: `${id}: solto do disjuntor (orçamento segue ${JSON.stringify(st.orcamento || {})})`, eventos: gravar(S) };
  }
  if (o.orcamento) {
    const base = st.orcamento || [...ancestrais(S.proj.nos, id)].find((n) => n.orcamento)?.orcamento || {};
    const depois = { ...(st.orcamento || {}) };
    for (const par of String(o.orcamento).split(",")) {
      const m = par.trim().match(/^(tokens|usd|tentativas)=\+(\d+(\.\d+)?)$/);
      if (!m) throw new Recusa(2, "uso", `--orcamento dim=+N: ${par}`);
      const atual = num(base[m[1]]) ?? (m[1] === "tentativas" ? st.tentativas : 0);
      depois[m[1]] = atual + Number(m[2]);
    }
    await abrirChaveDaPessoa(S);
    ev(S, "orcamento.alterado", id, { antes: st.orcamento || null, depois }, { assinar: true });
    return { codigo: 0, msg: `${id}: orçamento ${JSON.stringify(depois)}`, eventos: gravar(S) };
  }
  if (!o.aprovar && !o.reprovar) throw new Recusa(2, "uso", "--aprovar ou --reprovar");
  if (st.estado !== "em-gate") throw new Recusa(1, "gate", `${id} não tem gate humano aberto`);
  mostrarSecoes(S, st, o);
  await abrirChaveDaPessoa(S);
  decidirGate(S, id, !!o.aprovar, o.motivo);
  return { codigo: 0, msg: `${id}: gate de ${TITULO_FASE[st.gate_aberto.fase]} ${o.aprovar ? "aprovado" : "reprovado"}`, eventos: gravar(S) };
}

// D40: um gate só — o cartão primeiro, no formato da caixa; as seções inteiras só com --completo
function mostrarSecoes(S, st, o) {
  const id = st.id, fase = st.gate_aberto.fase, larg = largura(S.ctx), est = estilo(S.ctx, o);
  const mudou = !!st.gate_aberto.sha && shaArtefato(lerNo(S.raiz, id).corpo, fase) !== st.gate_aberto.sha;
  S.ctx.mostrar(detalheGate(vistaGate(S, st, { mudou }), 1, larg, est).join("\n"));
  if (o.completo) {
    const n = lerNo(S.raiz, id);
    for (const f of FASES.slice(0, FASES.indexOf(fase) + 1)) S.ctx.mostrar(`\n## ${TITULO_FASE[f]}\n${(n.secoes.out[f] || "").trim()}`);
  } else S.ctx.mostrar(quebrar(`O texto inteiro: .agents/trabalho/${id}.md, ou zeno gate ${id} --aprovar --completo.`, larg).join("\n"));
}

// T53: aprovação em lote — lista os gates humanos da pessoa, ela escolhe, UMA passphrase, um evento assinado por gate.
export async function caixaAprovar(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o));
  exigirPessoa(S, "aprovar gates");
  exigirChaveConfigurada(S);
  const pend = [...S.proj.nos.values()].filter((st) => st.estado === "em-gate" && pessoasDoPapel(st, st.gate_aberto.papeis).includes(S.ator));
  if (!pend.length) return { codigo: 0, msg: "nenhum gate esperando por você" };
  // T87: o texto da seção mudou depois que o gate abriu (gates abertos antes da T87 não têm o sha e não são marcados)
  const mudou = new Set(pend.filter((st) => /*G:caixa-mudou*/ st.gate_aberto.sha && shaArtefato(lerNo(S.raiz, st.id).corpo, st.gate_aberto.fase) !== st.gate_aberto.sha).map((st) => st.id));
  // D40: resumo antes do detalhe — a tabela de todos; abertos só os que pedem olho (alto, segurança, MUDOU, sem nível),
  // ou todos com --detalhe; "v N" abre um. "todos" e "1,3" aprovam como antes (T53).
  const larg = largura(S.ctx), est = estilo(S.ctx, o);
  const vs = pend.map((st) => vistaGate(S, st, { mudou: mudou.has(st.id) }));
  const tela = [...resumoCaixa(vs, S.ator, larg, est)];
  vs.forEach((v, i) => { if (o.detalhe || pedeOlho(v)) tela.push("", ...detalheGate(v, i + 1, larg, est)); });
  const fechados = vs.filter((v) => !(o.detalhe || pedeOlho(v))).length;
  if (fechados) tela.push("", ...quebrar(`${fechados === 1 ? "1 gate de risco baixo ou nenhum ficou fechado" : `${fechados} gates de risco baixo ou nenhum ficaram fechados`}: "v N" mostra um; --detalhe mostra todos.`, larg));
  S.ctx.mostrar(tela.join("\n"));
  const tTela = S.ctx.agora(), vistos = [];
  const ver = (n) => { const v = vs[n - 1]; if (v && !vistos.includes(pend[n - 1].id)) vistos.push(pend[n - 1].id); S.ctx.mostrar(v ? detalheGate(v, n, larg, est).join("\n") : `não há gate ${n}`); };
  // T114: a rodada deixa rastro (caixa.mostrada), sem assinatura e fora do ato humano: só ids e números, nenhum texto
  const rastro = (resposta, escolhidos, pulado) => ev(S, "caixa.mostrada", null, {
    listados: pend.map((st) => st.id), mudou: pend.filter((st) => mudou.has(st.id)).map((st) => st.id),
    abertos: vs.map((v, i) => (o.detalhe || pedeOlho(v) ? pend[i].id : null)).filter(Boolean), vistos, resposta,
    escolhidos: escolhidos.map((st) => st.id), mudou_pulado: pulado, leitura_ms: S.ctx.agora() - tTela });
  const pergunta = `Aprovar: todos${mudou.size ? ` (sem os ${mudou.size} MUDOU)` : ""} · números (1,3) · v N para ver · vazio cancela\n> `;
  let resp = "";
  for (let k = 0; k < 50; k++) {
    resp = String(await S.ctx.perguntar(pergunta)).trim().toLowerCase();
    const m = resp.match(/^v\s*(\d+)$/);
    if (!m) break;
    ver(Number(m[1]));
    resp = "";
  }
  if (!resp) { rastro("vazio", [], []); return { codigo: 0, msg: "nada aprovado", eventos: gravar(S) }; }
  const todos = resp === "todos" || resp === "t";
  const escolhidos = todos ? pend.filter((st) => !mudou.has(st.id)) : resp.split(",").map((x) => pend[Number(x.trim()) - 1]).filter(Boolean);
  // D40: o todos pula o MUDOU (T87); a caixa pergunta por ele em seguida, para não ficar de fora rodada após rodada
  if (todos && mudou.size) {
    const nums = pend.map((st, i) => (mudou.has(st.id) ? `${i + 1} ${st.id}` : null)).filter(Boolean);
    let r2 = "";
    for (;;) {
      r2 = String(await ctx.perguntar(`E o MUDOU (${nums.join(", ")})? número para aprovar · v N para ver · enter pula\n> `)).trim();
      const m = r2.match(/^v\s*(\d+)$/);
      if (!m) break;
      ver(Number(m[1]));
    }
    if (r2) for (const x of r2.split(",")) { const st = pend[Number(x.trim()) - 1]; if (st && mudou.has(st.id) && !escolhidos.includes(st)) escolhidos.push(st); }
  }
  if (!escolhidos.length) { rastro("invalida", [], []); gravar(S); throw new Recusa(2, "uso", `escolha inválida: ${resp}`); }
  rastro(todos ? "todos" : "numeros", escolhidos, todos ? pend.filter((st) => mudou.has(st.id) && !escolhidos.includes(st)).map((st) => st.id) : []);
  // T78: uma passphrase por rodada — com código novo desde a cópia fixada, oferece o promover (lista antes da passphrase)
  let p = null;
  try {
    if (existsSync(join(resolve(ctx.cwd, typeof o.de === "string" ? o.de : S.raiz), "core", "run.mjs"))) {
      // T79: os gates de Entrega desta rodada contam como aprovados; o executar confere de novo depois de gravá-los
      const aprovando = new Set(escolhidos.filter((st) => st.gate_aberto?.fase === "entrega").map((st) => st.id));
      try { p = prepararPromover(S, { ...o, aprovando }); } catch (e) { if (o.promover) throw e; S.ctx.mostrar(`promover não oferecido: ${e.msg || e.message}`); }
      if (p && !p.novo) { S.ctx.mostrar("a cópia fixada já tem o código atual: nada a promover"); p = null; }
      if (p && !o.promover && !/^s/i.test(String(await S.ctx.perguntar("promover também, com a mesma passphrase? (s/N) ")).trim())) p = null;
    }
    await abrirChaveDaPessoa(S);
  } catch (e) { gravar(S); throw e; } // T114: a rodada fica no ledger mesmo com a passphrase recusada
  for (const st of escolhidos) decidirGate(S, st.id, true, o.motivo);
  const msg = escolhidos.map((st) => `${st.id}: aprovado`).join("\n"), dados = { aprovados: escolhidos.map((s) => s.id) }, eventos = gravar(S);
  if (!p) return { codigo: 0, msg, dados, eventos };
  const r = await executarPromover(S, p);
  return { ...r, msg: `${msg}\n${r.msg}`, dados: { ...dados, ...r.dados }, eventos: [...eventos, ...r.eventos] };
}

const AJUSTAVEIS = ["faixa", "acoes", "checks", "depende_de", "origem", "procedencia", "executor", "dono", "revisor", "tamanho", "janela", "estado", "orcamento"];
export async function ajustar(ctx, pos, o, reg) {
  const [id, ...atrs] = pos;
  if (!id || !atrs.length) throw new Recusa(2, "uso", "zeno ajustar <id> campo=valor [campo+=valor …] [--motivo …]");
  const S = reg(abrir(ctx, o));
  const { cfg } = S, nos = S.proj.nos, st = nos.get(id);
  if (!st) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
  const n = lerNo(S.raiz, id);
  const fm = { ...n.fm };
  const mud = [];
  for (const a of atrs) {
    const m = a.match(/^([a-z_]+)(\+=|-=|=)(.*)$/);
    if (!m || !AJUSTAVEIS.includes(m[1])) throw new Recusa(2, "uso", `ajuste inválido: ${a}`);
    const [, campo, op, val] = m;
    if (campo === "estado") { if (val !== "cancelado") throw new Recusa(2, "uso", "estado só aceita =cancelado"); mud.push({ campo, cancelar: true }); continue; }
    if (campo === "orcamento") {
      const novo = { ...(st.orcamento || {}), ...parseOrcamento(val) };
      if (ehAfrouxar("orcamento", st.orcamento, novo, st, nos, cfg)) throw new Recusa(2, "uso", "aumentar orçamento é zeno gate <id> --orcamento dim=+N");
      mud.push({ campo, antes: st.orcamento || null, depois: novo }); continue;
    }
    const ehLista = ["acoes", "checks", "depende_de", "origem"].includes(campo);
    const antesV = campo === "origem" ? lista(fm.origem) : ehLista ? lista(st[campo]) : st[campo];
    let depoisV;
    if (ehLista) {
      const itens = val.split(",").map((x) => x.trim()).filter(Boolean);
      depoisV = op === "=" ? itens : op === "+=" ? [...new Set([...antesV, ...itens])] : antesV.filter((x) => !itens.includes(x));
    } else { if (op !== "=") throw new Recusa(2, "uso", `${campo} só aceita =`); depoisV = val; }
    if (campo === "faixa" && !FAIXAS.includes(depoisV)) throw new Recusa(2, "uso", `faixa desconhecida: ${depoisV}`);
    if (campo === "tamanho" && !TAMANHOS.includes(depoisV)) throw new Recusa(2, "uso", `tamanho desconhecido: ${depoisV}`);
    if (campo === "acoes") for (const x of depoisV) if (!cfg.acoes[x]) throw new Recusa(1, "acao", `ação desconhecida: ${x}`);
    if (campo === "checks") for (const x of depoisV) if (!cfg.checks[x]) throw new Recusa(1, "check", `check desconhecido: ${x}`);
    if (campo === "depende_de") for (const x of depoisV) if (!nos.has(x)) throw new Recusa(1, "ref", `nó inexistente: ${x}`);
    if (["executor", "dono", "revisor"].includes(campo) && !papelValido(cfg, depoisV)) throw new Recusa(1, "papel", `${campo} desconhecido: ${depoisV}`);
    if (campo === "janela" && duracao(depoisV) === null) throw new Recusa(2, "uso", `janela inválida: ${depoisV}`);
    mud.push({ campo, antes: antesV, depois: depoisV });
  }
  // T115: subir o tamanho sobe a faixa declarada até o piso do tamanho novo, no mesmo comando. Só aperta, nunca baixa.
  // Fica no verbo, e não na faixaEfetiva: o replay dos nós antigos não muda. A pessoa que declara a faixa no mesmo
  // ajuste decide por ela (abaixo do piso, assinado: spec/controle.md); a do agente sobe ao piso.
  const tam = mud.find((x) => x.campo === "tamanho");
  let pisoTamanho = false;
  if (tam && TAMANHOS.indexOf(tam.depois) > TAMANHOS.indexOf(tam.antes)) {
    const piso = cfg.padrao[tam.depois], fx = mud.find((x) => x.campo === "faixa"), declarada = fx ? fx.depois : st.faixa;
    if (/*G:piso-tamanho*/ FAIXAS.includes(piso) && faixaRank(declarada) < faixaRank(piso) && !(fx && !ehAgente(S.ator))) {
      if (fx) Object.assign(fx, { depois: piso, motivo: "tamanho" });
      else mud.push({ campo: "faixa", antes: st.faixa, depois: piso, motivo: "tamanho" });
      pisoTamanho = true;
    }
  }
  // efeito conjunto: o nó depois dos ajustes
  const depois = { ...st };
  for (const x of mud) if (!x.cancelar) depois[x.campo === "origem" ? "origem_classes" : x.campo] = x.campo === "origem" ? [...new Set(x.depois.map(classe))] : x.depois;
  const origemNova = mud.find((x) => x.campo === "origem");
  if (origemNova && origemNova.depois.some((x) => NAO_CONFIAVEIS.includes(classe(x))) && st.procedencia !== "nao-confiavel" && !mud.some((x) => x.campo === "procedencia")) {
    mud.push({ campo: "procedencia", antes: st.procedencia, depois: "nao-confiavel" }); depois.procedencia = "nao-confiavel";
  }
  const feDepois = faixaEfetiva(depois, nos, cfg);
  if (/*G:faixa-nunca*/ feDepois === "nunca" && ehAgente(depois.executor)) throw new Recusa(1, "faixa-nunca", "faixa nunca: troque o executor para uma pessoa no mesmo ajuste");
  const afrouxa = (x) => x.cancelar ? faixaEfetiva(st, nos, cfg) !== "autonoma" : ehAfrouxar(x.campo, x.campo === "origem" ? [...new Set(lista(x.antes).map(classe))] : x.antes, x.campo === "origem" ? [...new Set(x.depois.map(classe))] : x.depois, st, nos, cfg);
  const precisa = /*G:afrouxar*/ mud.some(afrouxa);
  if (precisa) { exigirPessoa(S, "afrouxar um nó"); if (!o.motivo) throw new Recusa(2, "uso", "afrouxar pede --motivo"); await abrirChaveDaPessoa(S); }
  const feAntes = faixaEfetiva(st, nos, cfg);
  for (const x of mud) {
    const assinar = precisa && afrouxa(x);
    if (x.cancelar) { ev(S, "no.cancelado", id, { motivo_sha256: o.motivo ? sha256(o.motivo) : null }, { assinar }); continue; }
    if (x.campo === "orcamento") { ev(S, "orcamento.alterado", id, { antes: x.antes, depois: x.depois }); continue; }
    if (x.campo === "origem") { fm.origem = x.depois; ev(S, "ajuste", id, { campo: "origem", antes: [...new Set(lista(x.antes).map(classe))], depois: [...new Set(x.depois.map(classe))], afrouxa: assinar }, { assinar }); continue; }
    ev(S, "ajuste", id, { campo: x.campo, antes: x.antes, depois: x.depois, afrouxa: assinar, ...(x.motivo ? { motivo: x.motivo } : {}) }, { assinar });
  }
  if (origemNova) gravarCorpo(S, id, fm, n.corpo);
  const feNova = faixaEfetiva(S.proj.nos.get(id), S.proj.nos, cfg);
  if (feNova !== feAntes) ev(S, "faixa.alterada", id, { de: feAntes, para: feNova, motivo: pisoTamanho ? "tamanho" : "ajuste" });
  return { codigo: 0, msg: `${id}: ${mud.map((x) => x.cancelar ? "cancelado" : `${x.campo} = ${JSON.stringify(x.depois)}`).join("; ")}`, eventos: gravar(S) };
}

const RESERVADAS = new Set(["alvo", "json", "para", "arquivo", "_"]);
// T87: zeno revisar <id> --motivo "…": o agente tira da caixa o gate humano aberto de um nó que está revendo. Apertar é
// livre (só adia a decisão, nunca aprova); o próximo zeno avancar abre o gate com o texto novo. T110: o ledger guarda só o
// hash do motivo (spec/ledger.md: nada de texto livre); o texto vai para o fio, como aviso ao revisor.
export async function revisar(ctx, pos, o, reg) {
  const id = pos[0];
  if (!id || typeof o.motivo !== "string" || !o.motivo.trim()) throw new Recusa(2, "uso", 'zeno revisar <id> --motivo "<por que o nó volta para revisão>"');
  const S = reg(abrir(ctx, o));
  const st = S.proj.nos.get(id);
  if (!st) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
  if (st.estado !== "em-gate") throw new Recusa(1, "estado", `${id} não tem gate aberto (estado ${st.estado})`);
  const fase = st.gate_aberto.fase;
  const motivo = o.motivo.trim(), gr = ev(S, "gate.retirado", id, { fase, motivo_sha256: sha256(motivo) });
  msgFio(S, id, { id: "m-" + gr.id, tipo: "aviso", ts: gr.ts.slice(0, 16) + "Z", de: S.ator, para: [st.revisor],
    campos: { "o-que": `gate ${fase} retirado da caixa: ${motivo}` } });
  return { codigo: 0, msg: `${id}: gate de ${TITULO_FASE[fase]} retirado da caixa (em revisão); quando o texto estiver pronto, zeno avancar ${id} o abre de novo`, dados: { id, fase }, eventos: gravar(S) };
}

export async function msg(ctx, pos, o, reg) {
  const [id, tipo] = pos;
  if (!id || !tipo) throw new Recusa(2, "uso", "zeno msg <id> <tipo> --para <dest> --<campo> \"valor\" …");
  const S = reg(abrir(ctx, o));
  if (!S.proj.nos.has(id)) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
  let campos = {};
  if (o.arquivo) {
    const { readFileSync } = await import("node:fs");
    for (const l of readFileSync(o.arquivo, "utf8").split("\n")) { const m = l.match(/^- \*\*([a-z-]+):\*\* (.*)$/); if (m) campos[m[1]] = m[2]; }
  } else for (const [k, v] of Object.entries(o)) if (!RESERVADAS.has(k) && typeof v === "string") campos[k] = v;
  const para = String(o.para || "").split(",").map((x) => x.trim()).filter(Boolean);
  const fioPath = caminhoFio(S.raiz, id), doFio = lerFio(fioPath, S.tr.deId);
  const m = { id: "m-?", tipo, ts: "", de: S.ator, para, campos };
  const v = lint(m, { cfg: S.cfg, msgsDoFio: doFio, existeNo: (x) => S.proj.nos.has(x), termos: lista(S.cfg.nucleo.lintObj.vazios) });
  if (v.length) {
    ev(S, "msg.recusada", id, { tipo, faltando: v.filter((x) => x.campo).map((x) => x.campo), regras: [...new Set(v.map((x) => x.regra))] });
    const eventos = gravar(S);
    return { codigo: 1, msg: v.map((x) => `lint ${x.regra}: ${x.msg}`).join("\n"), erros: v.map((x) => ({ regra: x.regra, msg: x.msg })), eventos };
  }
  const e = ev(S, "msg.enviada", id, { msg: null, tipo, para, responde_a: campos["responde-a"] ?? null, bytes: 0 });
  m.id = "m-" + e.id; m.ts = e.ts.slice(0, 16) + "Z";
  if (tipo === "pedido") m.campos.clausula = `(${m.id}) ${CLAUSULA}`;
  e.dados.msg = m.id; e.dados.bytes = Buffer.byteLength(Object.entries(m.campos).map(([k, x]) => `- **${k}:** ${x}`).join("\n"));
  msgFio(S, id, m);
  return { codigo: 0, msg: m.id, dados: { msg: m.id }, eventos: gravar(S) };
}

export async function registrar(ctx, pos, o, reg) {
  if (pos[0] === "gasto") {
    const id = pos[1];
    const S = reg(abrir(ctx, o));
    if (!S.proj.nos.has(id)) throw new Recusa(1, "ref", `nó inexistente: ${id}`);
    const tokens = num(o.tokens) ?? 0, usd = num(o.usd) ?? 0;
    if (!(tokens >= 0) || !(usd >= 0)) throw new Recusa(2, "uso", "--tokens N [--usd X]");
    ev(S, "gasto.registrado", id, { tokens, usd, fonte: "declarado" });
    const { codigo, msg } = poscusto(S, id);
    return { codigo, msg: msg || `${id}: gasto registrado`, eventos: gravar(S) };
  }
  if (!o.retro) throw new Recusa(2, "uso", 'zeno registrar "<título>" --retro … | zeno registrar gasto <id> --tokens N');
  const titulo = pos[0];
  if (!titulo || !TAMANHOS.includes(o.tamanho) || !o.inicio || !o.fim) throw new Recusa(2, "uso", "--retro pede título, --tamanho, --inicio e --fim (ISO)");
  if (isNaN(Date.parse(o.inicio)) || isNaN(Date.parse(o.fim))) throw new Recusa(2, "uso", "--inicio/--fim em ISO 8601");
  const S = reg(abrir(ctx, o));
  S.retro = { retro: true, ts_fato: new Date(o.inicio).toISOString() };
  const id = criarNo(S, titulo, { ...o, janela: "0d" });
  S.retro = { retro: true, ts_fato: new Date(o.fim).toISOString() };
  const kv = chavesDe(o);
  if (Object.keys(kv).length) escreverChaves(S, id, kv);
  const r = andar(S, id, "fechado");
  const eventos = gravar(S);
  if (!existsSync(caminhoFio(S.raiz, id))) writeFileSync(caminhoFio(S.raiz, id), "");
  return { codigo: r.codigo, msg: `${id} (retro)\n${r.msg}`, dados: { id, fase: S.proj.nos.get(id).fase }, eventos };
}

// Depois de um gasto: disjuntor do nó e teto diário do alvo.
export function poscusto(S, id) {
  let codigo = 0, msg = "";
  if (id) {
    const e = estouro(S.proj.nos, id);
    if (e && S.proj.nos.get(e.no_limite).estado !== "pausado") {
      ev(S, "disjuntor.disparou", id, e);
      const dono = S.proj.nos.get(e.no_limite).dono, last = S.buf.at(-1);
      msgFio(S, e.no_limite, { id: "m-" + last.id, tipo: "escalada", ts: last.ts.slice(0, 16) + "Z", de: S.ator, para: [dono], campos: { travou: `orçamento de ${e.no_limite}: ${e.limite} ${e.consumo} de ${e.teto}`, tentado: "registrar gasto", precisa: `uma pessoa decidir: zeno gate ${e.no_limite} --orcamento ${e.limite}=+N` } });
      codigo = 4; msg = `disjuntor: ${e.no_limite} pausado (${e.limite})`;
    }
  }
  const dia = new Date(S.ctx.agora()).toISOString().slice(0, 10), t = tetoDiario(S.proj, S.cfg, dia);
  // um estouro por dia, contado de novo depois de cada liberação do dia (T93)
  const doDia = S.proj.alvo.eventos.filter((x) => x.ts.slice(0, 10) === dia && ["teto_diario.estourou", "orcamento.alterado"].includes(x.ev));
  if (t && doDia.at(-1)?.ev !== "teto_diario.estourou" && !S.buf.some((x) => x.ev === "teto_diario.estourou")) {
    ev(S, "teto_diario.estourou", null, t); codigo = 4; msg += `${msg ? "; " : ""}teto diário estourado (${t.dimensao}); uma pessoa libera o dia com zeno gate --teto ${t.dimensao}=+N`;
  }
  return { codigo, msg };
}

export async function chave(ctx, pos, o, reg) {
  if (pos[0] === "pub") return chavePub(ctx, o, reg);
  if (pos[0] !== "nova") throw new Recusa(2, "uso", "zeno chave nova | chave pub [--pem | --em <arquivo>]");
  const S = reg(abrir(ctx, o, { escrever: false }));
  exigirPessoa(S, "gerar chave");
  const p1 = await ctx.segredo("nova passphrase (mín. 8): "), p2 = await ctx.segredo("de novo: ");
  if (p1 !== p2) throw new Recusa(1, "chave", "as passphrases não conferem");
  if (String(p1).length < 8) throw new Recusa(1, "chave", "passphrase curta (mín. 8)");
  const { pem, pub } = gerarPar(p1);
  const onde = gravarChave(ctx.home, S.ator, pem);
  return { codigo: 0, msg: `chave privada (cifrada) em ${onde}\nponha no .agents/sistema.yaml, em pessoas.${S.ator}:\n    chave_pub: "${pub}"`, dados: { pub } };
}

// chave pub: a pública sai da privada decifrada pela passphrase (um arquivo de chave trocado não abre).
// --pem mostra o PEM; --em grava o PEM num arquivo novo (o gate de pessoa exige stdout em TTY, então não há pipe).
async function chavePub(ctx, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  exigirPessoa(S, "abrir a chave");
  if (o.em === true || (o.em && o.pem)) throw new Recusa(2, "uso", "zeno chave pub [--pem | --em <arquivo>]");
  const destino = o.em ? resolve(ctx.cwd, String(o.em)) : null;
  if (destino && existsSync(destino)) throw new Recusa(1, "chave", `${destino} já existe; nada foi sobrescrito`);
  const k = await comTentativas(ctx, S.ator, (pass) => abrirPrivada(ctx.home, S.ator, pass));
  const pub = pubDe(k), doYaml = S.cfg.pessoas[S.ator]?.chave_pub;
  // o aviso vai pelo mostrar (stderr), para não sujar o PEM nem a linha
  if (!doYaml) ctx.mostrar?.(`aviso: o sistema.yaml não tem chave_pub de ${S.ator}`);
  else if (doYaml !== pub) ctx.mostrar?.(`aviso: a chave de ${S.ator} NÃO confere com a chave_pub do sistema.yaml`);
  const linha = `chave_pub: "${pub}"`;
  if (o.pem) return { codigo: 0, cru: pemDe(k), dados: { pub } };
  if (destino) {
    writeFileSync(destino, pemDe(k), { flag: "wx", mode: 0o644 });
    return { codigo: 0, msg: `a pública em PEM em ${destino}\n${linha}`, dados: { pub, destino } };
  }
  return { codigo: 0, msg: linha, dados: { pub } };
}
