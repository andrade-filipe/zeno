// root.mjs — a cópia que guarda com dono root (T95). Com /opt/zeno do root, o promover não troca mais a cópia sozinho:
// ele empacota a cópia provada num tar, assina (commit, sha256 do tar) com a chave da pessoa e chama, por sudo, o
// instalador root (bin/zeno-instalar-root), que confere o sha256 e a assinatura contra /opt/zeno/pessoa.pub antes de
// instalar. O root nunca roda git nem node do uid da pessoa. Sem /opt/zeno do root, nada disto liga.
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, sign } from "node:crypto";
import { aspas } from "./prova.mjs";

export const INSTALADOR = join("bin", "zeno-instalar-root");

// ctx.root = { raiz, uid, sudo } vem do cli.mjs ({ raiz: "/opt/zeno", uid: 0, sudo: "sudo" }); os testes declaram um
// diretório temporário, o dono esperado e sudo vazio. Sem ctx.root, o modo root não existe.
// Liga só quando a raiz é um diretório de verdade (não link), do dono declarado e sem escrita de grupo nem de outros.
export function modoRoot(ctx) {
  const r = ctx.root;
  if (!r || !r.raiz) return null;
  let st;
  try { st = lstatSync(r.raiz); } catch { return null; }
  if (!st.isDirectory() || st.uid !== r.uid || (st.mode & 0o022)) return null;
  return { raiz: r.raiz, atual: join(r.raiz, "atual"), instalador: join(r.raiz, "atual", INSTALADOR), sudo: r.sudo ?? "sudo" };
}

// /opt/zeno existe mas não serve (dono ou permissão errados): o promover avisa e segue no modo de antes
export function raizEstranha(ctx) {
  const r = ctx.root;
  return !!(r && r.raiz && existsSync(r.raiz) && !modoRoot(ctx));
}

// O texto assinado: o instalador refaz o mesmo texto com o commit que recebeu e o sha256 que ele mesmo calculou.
export const mensagemCopia = (commit, sha) => `zeno-instalar-root 1\ncommit ${commit}\nsha256 ${sha}\n`;
export const assinarCopia = (chave, commit, sha) => sign(null, Buffer.from(mensagemCopia(commit, sha)), chave);
export const sha256Arquivo = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// tar da cópia provada, com dono 0 e ordem fixa (o mesmo conteúdo dá o mesmo tar)
export const comandoTar = (dir, saida) =>
  `tar --sort=name --owner=0 --group=0 --numeric-owner --mtime=@0 -C ${aspas(dir)} -cf ${aspas(saida)} .`;

export const comandoInstalar = (m, args) => [m.sudo, m.instalador, ...args].filter(Boolean).map(aspas).join(" ");
