// assinatura.mjs — decisão humana assinada (T14): Ed25519, chave privada em PEM cifrado por passphrase.
// Ambiente (TTY, CLAUDECODE, e-mail do git) não prova pessoa; só a passphrase prova.
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { canon, Recusa } from "./util.mjs";

export const caminhoChave = (home, pessoa) => join(home, ".config", "zeno", `${pessoa}.key`);

export function gerarPar(passphrase) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase },
  });
  return { pem: privateKey, pub: Buffer.from(publicKey).toString("base64") };
}

export function gravarChave(home, pessoa, pem) {
  const p = caminhoChave(home, pessoa);
  if (existsSync(p)) throw new Recusa(1, "chave", `já existe uma chave para ${pessoa}; nada foi sobrescrito`);
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, pem, { mode: 0o600 });
  return p;
}

export function pubDe(chave) { return createPublicKey(chave).export({ type: "spki", format: "der" }).toString("base64"); }
export function pemDe(chave) { return createPublicKey(chave).export({ type: "spki", format: "pem" }); }

// Só decifra a chave da pessoa (o chave pub, que pode rodar antes de haver chave_pub no sistema.yaml).
export function abrirPrivada(home, pessoa, passphrase) {
  const p = caminhoChave(home, pessoa);
  if (!existsSync(p)) throw new Recusa(1, "assinatura", `${pessoa} não tem chave (zeno chave nova)`);
  try { return createPrivateKey({ key: readFileSync(p, "utf8"), format: "pem", passphrase }); }
  catch { throw new Recusa(1, "assinatura", "passphrase errada"); }
}

// Abre a chave da pessoa e confere com a pública do sistema.yaml.
export function abrirChave(home, pessoa, passphrase, pubEsperada) {
  const k = abrirPrivada(home, pessoa, passphrase);
  if (!pubEsperada)throw new Recusa(1, "assinatura", `sistema.yaml não tem chave_pub de ${pessoa}`);
  if (pubDe(k) !== pubEsperada) throw new Recusa(1, "assinatura", `a chave de ${pessoa} não confere com a chave_pub do sistema.yaml`);
  return k;
}

const dadosDe = (ev) => { const { assinatura, ...resto } = ev; return Buffer.from(canon(resto)); };

// forma: o evento como vai ao disco (T73: pessoas em hash); assina-se e confere-se o que está no disco.
export function assinar(ev, pessoa, chave, forma = (x) => x) {
  ev.assinatura = { pessoa, sig: sign(null, dadosDe(forma(ev)), chave).toString("base64") };
  return ev;
}

// Válida quando a pessoa existe, tem chave_pub e a assinatura confere com o evento inteiro.
export function valida(ev, pessoas, forma = (x) => x) {
  const a = ev.assinatura;
  if (!a || !a.pessoa || !a.sig) return false;
  const pub = pessoas?.[a.pessoa]?.chave_pub;
  if (!pub) return false;
  try {
    const k = createPublicKey({ key: Buffer.from(pub, "base64"), format: "der", type: "spki" });
    return verify(null, dadosDe(forma(ev)), k, Buffer.from(a.sig, "base64"));
  } catch { return false; }
}
