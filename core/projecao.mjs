// projecao.mjs — o estado de controle é a projeção do ledger (T1). Também: faixa efetiva, gate da fase, orçamento.
import { valida } from "./assinatura.mjs";
import { FASES, faixaRank, maxFaixa, ehAgente, num, lista, faseIdx } from "./util.mjs";

export function faixaEfetiva(st, nos, cfg, visto = new Set()) {
  let f = st.faixa;
  for (const a of lista(st.acoes)) if (cfg.acoes[a]) f = maxFaixa(f, cfg.acoes[a].faixa);
  // T76 (D36): P de código do zeno (--codigo) não sobe por procedência: quem guarda é o promover assinado; o commit é conferido na Entrega
  if (/*G:procedencia*/ st.procedencia === "nao-confiavel" && !st.codigo) f = maxFaixa(f, "aprovacao");
  const pai = st.pai && nos.get(st.pai);
  if (pai && !visto.has(pai.id)) { visto.add(st.id); if (faixaEfetiva(pai, nos, cfg, visto) === "nunca") f = "nunca"; }
  return f;
}

// Gate de saída de uma fase: humano (com papéis) ou check; "juiz" só no formato (Inc. 4).
export function gateDaFase(st, nos, cfg, fase) {
  const fe = faixaEfetiva(st, nos, cfg);
  let papeis = lista(cfg.gates[fe]?.[fase]);
  if (fase === "entrega") for (const a of lista(st.acoes)) { const d = cfg.acoes[a]; if (d && d.aprova.length && faixaRank(d.faixa) >= 1) papeis = d.aprova; }
  if (papeis.includes("juiz") && papeis.length === 1) return { tipo: "juiz", papeis: [] };
  return papeis.length ? { tipo: "humano", papeis: papeis.filter((p) => p !== "juiz") } : { tipo: "check", papeis: [] };
}

export const pessoasDoPapel = (st, papeis) => [...new Set(papeis.map((p) => st[p]).filter((x) => x && !ehAgente(x)))];

const dimsAcima = (antes, depois) => ["tokens", "usd", "tentativas"].some((d) => {
  const a = num(antes?.[d]), b = num(depois?.[d]);
  return b === null ? a !== null : a !== null && b > a;
});

// Afrouxar pelo EFEITO (T18).
export function ehAfrouxar(campo, antes, depois, st, nos, cfg) {
  const saiu = (a, b) => lista(a).some((x) => !lista(b).includes(x));
  switch (campo) {
    case "faixa": return faixaRank(depois) < faixaRank(antes);
    case "acoes": case "checks": case "depende_de": case "origem": return saiu(antes, depois);
    case "procedencia": return antes === "nao-confiavel" && depois !== "nao-confiavel";
    case "executor": case "dono": case "revisor": return ehAgente(depois) && !ehAgente(antes);
    case "tamanho": return faixaRank(cfg.padrao[depois]) < faixaRank(cfg.padrao[antes]) || "PMG".indexOf(depois) < "PMG".indexOf(antes);
    case "janela": return true;
    case "pai": case "tipo": return true;
    case "orcamento": return dimsAcima(antes, depois);
    default: return true;
  }
}

export function projetar(eventos, cfg) {
  const nos = new Map(), erros = [], porId = new Map(eventos.map((e) => [e.id, e]));
  const alvo = { contaminadas: new Map(), gastoDia: new Map(), tetoExtra: new Map(), eventos: [] };
  const err = (ev, regra, msg) => erros.push([".agents/ledger.jsonl", ev._linha ?? 0, regra, `${ev.id} (${ev.ev}${ev.no ? " " + ev.no : ""}): ${msg}`]);
  const assinadaPor = (ev) => /*G:assinatura*/ !(valida(ev, cfg.pessoas, cfg.disco?.paraDisco) && ev.assinatura.pessoa === ev.ator && ev.ator in cfg.pessoas) ? null : ev.ator;

  for (const ev of eventos) {
    const d = ev.dados || {};
    if (ev.ev === "gasto.registrado") { const dia = (ev.ts_fato || ev.ts).slice(0, 10); const g = alvo.gastoDia.get(dia) || { tokens: 0, usd: 0 }; g.tokens += num(d.tokens) || 0; g.usd += num(d.usd) || 0; alvo.gastoDia.set(dia, g); }
    if (ev.ev === "contaminacao.marcada") { alvo.contaminadas.set(d.sessao_sha256, ev); continue; }
    if (ev.ev === "contaminacao.limpa") {
      if (d.como === "pessoa" && !assinadaPor(ev)) { err(ev, "assinatura", "limpeza de contaminação por pessoa sem assinatura válida"); continue; }
      if (d.como === "pessoa") alvo.contaminadas.clear(); else alvo.contaminadas.delete(d.sessao_sha256);
      continue;
    }
    // T93: a pessoa libera o teto diário do alvo por um dia UTC (zeno gate --teto dim=+N); sem assinatura, não vale
    if (ev.ev === "orcamento.alterado" && !ev.no) {
      if (/*G:teto-assinado*/ !assinadaPor(ev)) { err(ev, "assinatura", "liberação do teto diário sem assinatura válida"); continue; }
      const x = alvo.tetoExtra.get(d.dia) || { tokens: 0, usd: 0 };
      for (const dim of ["tokens", "usd"]) x[dim] += num(d.acrescimo?.[dim]) || 0;
      alvo.tetoExtra.set(d.dia, x); alvo.eventos.push(ev); continue;
    }
    if (!ev.no) { alvo.eventos.push(ev); continue; }
    if (ev.ev === "no.criado") {
      if (nos.has(ev.no)) { err(ev, "conflito", "nó criado duas vezes"); continue; }
      const st = { id: ev.no, ...d, acoes: lista(d.acoes), checks: lista(d.checks), depende_de: lista(d.depende_de), origem_classes: lista(d.origem_classes),
        fase: "intencao", estado: "ativo", criador: ev.ator, criado_ts: ev.ts_fato || ev.ts, tentativas: 0, aprovados: {}, gastos: { tokens: 0, usd: 0 },
        atrito: [], gate_aberto: null, entrega_ts: null, fechado_ts: null, eventos: [ev], retro: !!ev.retro };
      if (/*G:piso-faixa*/ ehAgente(ev.ator) && faixaRank(st.faixa) < faixaRank(cfg.padrao[st.tamanho])) {
        err(ev, "piso-faixa", `agente declarou faixa ${st.faixa} abaixo do piso de ${st.tamanho} (${cfg.padrao[st.tamanho]})`);
        st.faixa = cfg.padrao[st.tamanho];
      }
      nos.set(ev.no, st);
      continue;
    }
    const st = nos.get(ev.no);
    if (!st) { err(ev, "conflito", "evento de nó que não existe"); continue; }
    st.eventos.push(ev);
    switch (ev.ev) {
      case "fase.avancou": {
        if (/*G:pausa-fato*/ st.estado === "pausado") { err(ev, "pausado", `${ev.no} está pausado pelo disjuntor: nada avança antes de uma pessoa soltar`); break; }
        if (st.fase !== d.de || faseIdx(d.para) !== faseIdx(d.de) + 1) { err(ev, "conflito", `nó está em ${st.fase}, evento diz ${d.de} → ${d.para}`); break; }
        const g = porId.get(d.gate), need = gateDaFase(st, nos, cfg, d.de);
        const base = g && g.ev === "gate.decidido" && g.no === ev.no && g.dados?.fase === d.de && g.dados?.decisao === "aprovado";
        if (need.tipo === "humano") {
          const quem = base && g.dados.tipo === "humano" && assinadaPor(g);
          if (!quem || !pessoasDoPapel(st, need.papeis).includes(quem)) { err(ev, "assinatura", `saída de ${d.de} pede gate humano assinado por ${need.papeis.join("/")}`); break; }
        } else if (!base) { err(ev, "conflito", `saída de ${d.de} sem gate aprovado`); break; }
        if (d.de === "entrega") st.entrega_ts = ev.ts_fato || ev.ts;
        st.fase = d.para; st.gate_aberto = null;
        st.estado = d.para === "fechado" ? "fechado" : "ativo";
        if (d.para === "fechado") st.fechado_ts = ev.ts_fato || ev.ts;
        break;
      }
      case "gate.aberto": if (/*G:pausa-fato*/ st.estado === "pausado") { err(ev, "pausado", `${ev.no} está pausado pelo disjuntor: nenhum gate abre`); break; }
        st.estado = "em-gate"; st.gate_aberto = { fase: d.fase, papeis: lista(d.papeis), ts: ev.ts, sha: d.artefato_sha256 || null }; st.em_revisao = null; break;
      // T87: o agente tira o gate da caixa para rever o nó (apertar é livre); o próximo avancar o abre de novo, com o conteúdo novo
      case "gate.retirado": if (/*G:gate-retirado*/ st.estado === "em-gate") { st.estado = "ativo"; st.gate_aberto = null; st.em_revisao = { fase: d.fase, motivo_sha256: d.motivo_sha256 ?? null, ts: ev.ts }; } break;
      case "gate.decidido":
        if (/*G:pausa-fato*/ st.estado === "pausado") { err(ev, "pausado", `${ev.no} está pausado pelo disjuntor: nenhum gate se decide`); break; }
        if (d.tipo === "humano" && !assinadaPor(ev)) { err(ev, "assinatura", "decisão de gate humano sem assinatura válida"); break; }
        if (d.tipo === "humano") {
          const papeis = st.gate_aberto?.papeis?.length ? st.gate_aberto.papeis : gateDaFase(st, nos, cfg, d.fase).papeis;
          if (!pessoasDoPapel(st, papeis).includes(ev.ator)) { err(ev, "papel", `${ev.ator} não tem o papel ${papeis.join("/")} neste nó`); break; }
        }
        if (d.decisao === "aprovado" && d.tipo === "humano") {
          st.aprovados[d.fase] = d.artefato_sha256;
          if (d.fase !== st.fase) { st.estado = "ativo"; st.gate_aberto = null; } // reaprovação de seção que mudou (T15)
        }
        if (d.decisao === "reprovado") { st.tentativas++; st.estado = "ativo"; st.gate_aberto = null; st.atrito.push(ev.id); }
        break;
      case "disjuntor.disparou": { const alvoNo = nos.get(d.no_limite) || st; alvoNo.estado = "pausado"; st.atrito.push(ev.id); break; }
      case "orcamento.alterado":
        if (dimsAcima(d.antes, d.depois) && !assinadaPor(ev)) { err(ev, "assinatura", "aumento de orçamento sem assinatura válida"); break; }
        st.orcamento = d.depois;
        // T98: só a pessoa tira o nó da pausa (gate --orcamento, assinado); baixar o orçamento, livre, não despausa
        if (st.estado === "pausado" && !(/*G:despausa-assinada*/ !assinadaPor(ev))) st.estado = st.gate_aberto ? "em-gate" : "ativo";
        break;
      case "disjuntor.liberado": // T98: gate <id> --despausar, de pessoa, sem subir o teto
        if (!assinadaPor(ev)) { err(ev, "assinatura", "despausa sem assinatura válida"); break; }
        if (st.estado === "pausado") st.estado = st.gate_aberto ? "em-gate" : "ativo";
        break;
      case "ajuste": {
        const campo = d.campo === "origem" ? "origem_classes" : d.campo;
        if (/*G:afrouxar*/ ehAfrouxar(d.campo, d.antes, d.depois, st, nos, cfg) && !assinadaPor(ev)) { err(ev, "assinatura", `afrouxar ${d.campo} sem assinatura válida`); break; }
        st[campo] = d.depois;
        break;
      }
      case "no.cancelado":
        if (faixaEfetiva(st, nos, cfg) !== "autonoma" && !assinadaPor(ev)) { err(ev, "assinatura", "cancelar nó fora da faixa autônoma pede assinatura"); break; }
        st.estado = "cancelado"; break;
      case "gasto.registrado": st.gastos.tokens += num(d.tokens) || 0; st.gastos.usd += num(d.usd) || 0; break;
      case "recusa": st.atrito.push(ev.id); break;
      case "msg.enviada": if (d.tipo === "escalada") st.atrito.push(ev.id); break;
      default: break;
    }
  }
  return { nos, erros, alvo };
}

export function filhos(nos, id) { return [...nos.values()].filter((n) => n.pai === id); }
export function ancestrais(nos, id) {
  const out = [], visto = new Set();
  let n = nos.get(id);
  while (n && n.pai && nos.has(n.pai) && !visto.has(n.pai)) { visto.add(n.pai); n = nos.get(n.pai); out.push(n); }
  return out;
}
export function consumo(nos, id) {
  const st = nos.get(id), c = { tokens: st.gastos.tokens, usd: st.gastos.usd };
  for (const f of filhos(nos, id)) { const x = consumo(nos, f.id); c.tokens += x.tokens; c.usd += x.usd; }
  return c;
}

// Disjuntor (T13/T26): tokens/usd estouram quando consumo > teto; tentativas, quando reprovações ≥ teto (só do próprio nó).
export function estouro(nos, id) {
  const st = nos.get(id), cadeia = [st, ...ancestrais(nos, id)];
  for (const n of cadeia) {
    if (!n.orcamento) continue;
    const c = consumo(nos, n.id);
    for (const dim of ["tokens", "usd"]) {
      const t = num(n.orcamento[dim]);
      if (/*G:disjuntor*/ t !== null && c[dim] > t) return { limite: dim, no_limite: n.id, consumo: c[dim], teto: t };
    }
  }
  const comT = cadeia.find((n) => n.orcamento && num(n.orcamento.tentativas) !== null);
  if (comT) { const t = num(comT.orcamento.tentativas); if (/*G:disjuntor*/ st.tentativas >= t) return { limite: "tentativas", no_limite: id, consumo: st.tentativas, teto: t }; }
  return null;
}
export const pausadoNaCadeia = (nos, id) => [nos.get(id), ...ancestrais(nos, id)].find((n) => n.estado === "pausado") || null;

export function tetoDiario(proj, cfg, dia) {
  const g = proj.alvo.gastoDia.get(dia) || { tokens: 0, usd: 0 }, x = proj.alvo.tetoExtra?.get(dia) || { tokens: 0, usd: 0 };
  for (const dim of ["tokens", "usd"]) { const t = cfg.teto[dim] === null ? null : cfg.teto[dim] + x[dim]; if (/*G:disjuntor*/ t !== null && g[dim] > t) return { dimensao: dim, consumo: g[dim], teto: t }; }
  return null;
}

export const passouDaEntrega = (st) => faseIdx(st.fase) > FASES.indexOf("entrega");
