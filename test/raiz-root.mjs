// Uma /opt/zeno falsa para os testes do modo root (T95). A raiz é um mkdtemp que se limpa, com o dono declarado (o uid
// de quem roda o teste) e as permissões de um /opt/zeno do root (755, pessoa.pub 644). O instalador é o
// bin/zeno-instalar-root deste checkout (o que o censo muta), com a linha RAIZ=/opt/zeno trocada pela raiz falsa.
// Nada aqui chama sudo.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { raizTmp } from "./ajuda.mjs";
import { comandoTar, sha256Arquivo, assinarCopia, INSTALADOR } from "../core/root.mjs";

const SCRIPT = new URL("../bin/zeno-instalar-root", import.meta.url).pathname;
export const uid = () => Number(spawnSync("id", ["-u"], { encoding: "utf8" }).stdout.trim());
export const outraChave = () => generateKeyPairSync("ed25519").privateKey;

// o texto do instalador com a raiz trocada; o original precisa ter a linha exata (senão a raiz falsa não vale)
export function instaladorPara(raiz) {
  const txt = readFileSync(SCRIPT, "utf8");
  if (!txt.includes("\nRAIZ=/opt/zeno\n")) throw new Error("o instalador perdeu a linha RAIZ=/opt/zeno");
  return txt.replace("\nRAIZ=/opt/zeno\n", `\nRAIZ='${raiz}'\n`);
}

export function raizFalsa({ comPub = true } = {}) {
  const base = mkdtempSync(join(raizTmp(), "zeno-root-"));
  const raiz = join(base, "opt zeno"); // com espaço: o instalador precisa aguentar
  mkdirSync(raiz); chmodSync(raiz, 0o755);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = join(raiz, "pessoa.pub");
  if (comPub) { writeFileSync(pub, publicKey.export({ type: "spki", format: "pem" })); chmodSync(pub, 0o644); }
  const inst = join(base, "zeno-instalar-root");
  writeFileSync(inst, instaladorPara(raiz)); chmodSync(inst, 0o755);
  let n = 0;
  const R = {
    base, raiz, pub, inst, chave: privateKey, pubPem: publicKey.export({ type: "spki", format: "pem" }),
    rodar: (...args) => spawnSync("sh", [inst, ...args], { encoding: "utf8" }),
    // uma cópia empacotada como o promover empacota, assinada por `chave` sobre `assinado` (commit) e `shaAssinado`
    pacote(commit, { arquivos = { "cli.mjs": "// zeno\n", "core/run.mjs": "// run\n" }, chave = privateKey, assinado = commit, shaAssinado = null } = {}) {
      const d = join(base, `copia ${++n}`);
      for (const [f, t] of Object.entries(arquivos)) { mkdirSync(join(d, f, ".."), { recursive: true }); writeFileSync(join(d, f), t); }
      const tar = join(base, `pacote '${n}'.tar`), sig = join(base, `assinatura ${n}`);
      const r = spawnSync("sh", ["-c", comandoTar(d, tar)], { encoding: "utf8" });
      if (r.status !== 0) throw new Error("tar falhou: " + r.stderr);
      const sha = sha256Arquivo(tar);
      writeFileSync(sig, assinarCopia(chave, assinado, shaAssinado ?? sha));
      return { tar, sha, sig };
    },
    // a raiz já com uma cópia instalada e o instalador dela (para o promover chamar raiz/atual/bin/zeno-instalar-root)
    semear(commit = "000000000000") {
      const c = join(raiz, commit);
      mkdirSync(join(c, "bin"), { recursive: true });
      writeFileSync(join(c, INSTALADOR), instaladorPara(raiz)); chmodSync(join(c, INSTALADOR), 0o755);
      symlinkSync(c, join(raiz, "atual"));
      return c;
    },
    limpar: () => rmSync(base, { recursive: true, force: true }),
  };
  return R;
}
