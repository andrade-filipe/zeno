// seccomp.mjs — o filtro BPF clássico que o zeno sessao passa ao bwrap (--seccomp 3), sem dependência (T82).
// Nega com EPERM: socket/socketpair de AF_VSOCK (o vsock ignora o namespace de rede no 6.6), ioctl TIOCSTI e TIOCLINUX
// (injetar teclas no terminal), keyctl/add_key/request_key (o chaveiro do kernel), io_uring (cria socket por fora do
// socket()), e toda syscall de outra ABI (i386 por int 0x80, x32): o filtro só entende x86_64 e aarch64.
const LD_W_ABS = 0x20, JEQ = 0x15, JGE = 0x35, RET = 0x06;
const ALLOW = 0x7fff0000, EPERM = 0x00050000 | 1, KILL = 0x80000000;
const AF_VSOCK = 40, TIOCSTI = 0x5412, TIOCLINUX = 0x541c;
// números por arquitetura (asm/unistd.h)
export const ARCHS = {
  x64: { audit: 0xc000003e, socket: 41, socketpair: 53, ioctl: 16, negar: [248, 249, 250, 425, 426, 427], x32: 0x40000000 },
  arm64: { audit: 0xc00000b7, socket: 198, socketpair: 199, ioctl: 29, negar: [217, 218, 219, 425, 426, 427], x32: null },
};

// Monta o programa como lista de [code, jt, jf, k]; os saltos são resolvidos por rótulo.
export function programa(arch = "x64") {
  const A = ARCHS[arch];
  if (!A) throw new Error(`seccomp: arquitetura sem filtro: ${arch}`);
  const p = [], L = {}, refs = [];
  const op = (code, k, jt = 0, jf = 0) => { p.push([code, jt, jf, k]); return p.length - 1; };
  const jeq = (k, alvoT, alvoF) => { const i = op(JEQ, k); refs.push([i, alvoT, alvoF]); };
  const jge = (k, alvoT, alvoF) => { const i = op(JGE, k); refs.push([i, alvoT, alvoF]); };
  const rot = (n) => { L[n] = p.length; };
  op(LD_W_ABS, 4);                                   // arch
  jeq(A.audit, null, "kill");
  op(LD_W_ABS, 0);                                   // nr
  if (A.x32) jge(A.x32, "eperm", null);
  jeq(A.socket, "sock", null);
  jeq(A.socketpair, "sock", null);
  jeq(A.ioctl, "ioctl", null);
  for (const n of A.negar) jeq(n, "eperm", null);
  op(RET, ALLOW);
  rot("sock"); op(LD_W_ABS, 16);                     // args[0], 32 bits de baixo (little-endian)
  jeq(AF_VSOCK, "eperm", null); op(RET, ALLOW);
  rot("ioctl"); op(LD_W_ABS, 24);                    // args[1]
  jeq(TIOCSTI, "eperm", null); jeq(TIOCLINUX, "eperm", null); op(RET, ALLOW);
  rot("eperm"); op(RET, EPERM);
  rot("kill"); op(RET, KILL);
  for (const [i, t, f] of refs) {
    const salto = (n) => (n === null ? 0 : L[n] - i - 1);
    p[i][1] = salto(t); p[i][2] = salto(f);
    if (p[i][1] < 0 || p[i][1] > 255 || p[i][2] < 0 || p[i][2] > 255) throw new Error("seccomp: salto fora do alcance");
  }
  return p;
}

// struct sock_filter { u16 code; u8 jt; u8 jf; u32 k; } em little-endian, como o bwrap lê do fd.
export function bpf(arch = "x64") {
  const p = programa(arch), b = Buffer.alloc(p.length * 8);
  p.forEach(([code, jt, jf, k], i) => { b.writeUInt16LE(code, i * 8); b.writeUInt8(jt, i * 8 + 2); b.writeUInt8(jf, i * 8 + 3); b.writeUInt32LE(k >>> 0, i * 8 + 4); });
  return b;
}
