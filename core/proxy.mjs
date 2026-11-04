// proxy.mjs — a única saída de rede de uma sessão de agente (T82): um proxy HTTP CONNECT num socket Unix, de fora do
// sandbox, com allowlist de hosts e portas. Endereço privado ou de loopback é negado mesmo para host permitido (o
// 127.0.0.1 do WSL em modo mirrored é o do Windows). Sem dependência.
import { createServer, connect, isIP } from "node:net";
import { lookup } from "node:dns/promises";

export function hostPermitido(host, hosts) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  return !!h && hosts.some((x) => { const a = String(x).toLowerCase(); return a.startsWith(".") ? h.endsWith(a) || h === a.slice(1) : h === a; });
}
export function enderecoPrivado(ip) {
  const v = String(ip || "").replace(/^::ffff:/, "");
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (isIP(v) === 6) return v === "::" || v === "::1" || /^f[cd]/i.test(v) || /^fe[89ab]/i.test(v);
  return true;
}

// Sobe o proxy em `sock`. Devolve { conta, fechar }. `resolver` é injetável (teste); o padrão é o DNS do sistema.
export function servirProxy(sock, { hosts = [], portas = [443, 80], resolver = async (h) => (await lookup(h)).address } = {}) {
  const conta = { permitidas: 0, negadas: 0, negados: new Set() };
  const negar = (c, alvo, motivo) => { conta.negadas++; conta.negados.add(`${alvo} (${motivo})`); if (!c.destroyed) c.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); };
  const srv = createServer((c) => {
    let buf = Buffer.alloc(0);
    c.on("error", () => {});
    const aoLer = async (d) => {
      buf = Buffer.concat([buf, d]);
      const fim = buf.indexOf("\r\n\r\n");
      if (fim < 0) { if (buf.length > 16384) c.destroy(); return; }
      c.off("data", aoLer); c.pause();
      const [metodo, url] = buf.subarray(0, fim).toString("latin1").split("\r\n")[0].split(" ");
      let host = null, porta = 0, inicial = Buffer.alloc(0);
      if (metodo === "CONNECT") { const m = String(url).match(/^\[?([^\]]+?)\]?:(\d+)$/); if (m) { host = m[1]; porta = Number(m[2]); } inicial = buf.subarray(fim + 4); }
      else { try { const u = new URL(url); if (u.protocol === "http:") { host = u.hostname; porta = Number(u.port || 80); inicial = buf; } } catch {} }
      const alvo = `${host}:${porta}`;
      const foraDaLista = !hostPermitido(host, hosts) || !portas.includes(porta);
      if (!host) return negar(c, alvo, "pedido ilegível");
      if (/*G:proxy-allowlist*/ foraDaLista) return negar(c, alvo, "fora da allowlist");
      let ip; try { ip = isIP(host) ? host : await resolver(host); } catch { conta.negadas++; conta.negados.add(`${alvo} (dns)`); return c.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); }
      if (/*G:proxy-privado*/ enderecoPrivado(ip)) return negar(c, alvo, `endereço privado ${ip}`);
      conta.permitidas++;
      const s = connect(porta, ip, () => {
        if (metodo === "CONNECT") c.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (inicial.length) s.write(inicial);
        c.pipe(s); s.pipe(c); c.resume();
      });
      s.on("error", () => { if (!c.destroyed) c.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); });
      c.on("close", () => s.destroy());
    };
    c.on("data", aoLer);
  });
  return new Promise((ok, falha) => {
    srv.once("error", falha);
    srv.listen(sock, () => ok({ conta, fechar: () => new Promise((r) => srv.close(() => r())) }));
  });
}
