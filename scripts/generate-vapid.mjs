// Genera el par de llaves VAPID para las notificaciones push.
//   node scripts/generate-vapid.mjs
import webPush from "web-push"

const keys = webPush.generateVAPIDKeys()
console.log("Agrega estas líneas a tu .env (la privada nunca se comparte):\n")
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`)
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`)
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`)
console.log('VAPID_SUBJECT="mailto:contacto@tu-iglesia.org"')
