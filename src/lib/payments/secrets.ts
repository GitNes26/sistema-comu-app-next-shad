import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// Cifrado de las llaves de la pasarela en la base de datos (AES-256-GCM).
// La llave sale de PAYMENTS_SECRET_KEY o, si no existe, de NEXTAUTH_SECRET.

function key(): Buffer {
  const base = process.env.PAYMENTS_SECRET_KEY || process.env.NEXTAUTH_SECRET
  if (!base) throw new Error("Falta PAYMENTS_SECRET_KEY (o NEXTAUTH_SECRET) para guardar las llaves de la pasarela")
  return createHash("sha256").update(`comu-app:payments:${base}`).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".")
}

export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split(".")
  if (!iv || !tag || !data) throw new Error("Secreto con formato inválido")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
}
