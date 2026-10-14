import { PDFDocument } from "pdf-lib"
import { createHmac } from "node:crypto"
// Pruebas de permisos (integración) — Node test runner, sin dependencias.
//
// Requiere servidor y demo sembrada:
//   npm run dev -- -p 3100        (o TEST_BASE_URL para otra URL)
//   SEED_DEMO=true npm run db:seed
//   DEMO_PASSWORD (por defecto, el valor de desarrollo del seeder)
//
// Ejecutar:  npm run test:integration
//
// Verifica en el flujo HTTP real:
//   creyente   → /api/crud/* 403 y /admin redirige a /mi
//   secretaría → ve creyentes; empleados y alta de sedes 403
//   propietario→ crea un creyente (201), el padrón queda acotado a su iglesia

import test from "node:test"
import assert from "node:assert/strict"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3100"
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-Comu-2026"

async function login(email) {
  const jar = new Map()
  const store = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";")
      const [k, ...v] = pair.split("=")
      jar.set(k, v.join("="))
    }
  }
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
  const csrf = await fetch(`${BASE}/api/auth/csrf`)
  store(csrf)
  const { csrfToken } = await csrf.json()
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ csrfToken, identifier: email, password: PASSWORD, json: "true" }),
  })
  store(res)
  return (path, init = {}) =>
    fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers: { ...(init.headers ?? {}), cookie: cookie() } })
}

test("creyente: sin acceso al CRUD y redirigido a su espacio", async () => {
  const api = await login("demo.creyente@comuapp.test")
  assert.equal((await api("/api/crud/members")).status, 403)
  const admin = await api("/admin")
  assert.equal(admin.status, 307)
  assert.match(admin.headers.get("location") ?? "", /\/mi$/)
  assert.equal((await api("/mi")).status, 200)
})

test("secretaría: ve creyentes pero no empleados ni crea sedes", async () => {
  const api = await login("demo.secretaria@comuapp.test")
  assert.equal((await api("/api/crud/members?pageSize=1")).status, 200)
  assert.equal((await api("/api/crud/employees")).status, 403)
  const created = await api("/api/crud/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "No debe crearse" }),
  })
  assert.equal(created.status, 403)
})

test("propietario: crea un creyente y no puede tocar otra iglesia", async () => {
  const api = await login("demo.owner@comuapp.test")
  const res = await api("/api/crud/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: `Prueba integración ${Date.now()}`, visionStage: "win" }),
  })
  assert.equal(res.status, 201)
  const { row } = await res.json()
  assert.equal(row.visionStage, "win")
  // id inexistente en la iglesia de la sesión → 404 (nunca datos de otra iglesia)
  assert.equal((await api("/api/crud/members/id-que-no-existe")).status, 404)
})

test("sin sesión: 401", async () => {
  const res = await fetch(`${BASE}/api/crud/members`)
  assert.equal(res.status, 401)
})

// ── Ministerios: acceso por relación (el rol base no cambia) ─────────────────

const json = { "Content-Type": "application/json" }

async function ministryIds() {
  const owner = await login("demo.owner@comuapp.test")
  const res = await owner("/api/crud/ministries?pageSize=100")
  assert.equal(res.status, 200)
  const { rows } = await res.json()
  return { owner, ids: Object.fromEntries(rows.map((r) => [r.name, r.id])) }
}

test("ministerios: un servidor ve su ministerio pero no lo gestiona ni ve otros", async () => {
  const { ids } = await ministryIds()
  const carlos = await login("demo.creyente@comuapp.test") // creyente, servidor en Bienvenida y Ujieres
  const own = await carlos(`/api/ministries/${ids["Bienvenida"]}`)
  assert.equal(own.status, 200)
  const { workspace } = await own.json()
  assert.equal(workspace.access.canManage, false)
  assert.equal(workspace.requests, null)
  assert.equal(workspace.access.myRole, "servant")
  // No es de Producción: ni siquiera se revela que existe.
  assert.equal((await carlos(`/api/ministries/${ids["Producción"]}`)).status, 404)
  // No puede agregar servidores ni crear reuniones.
  const add = await carlos(`/api/ministries/${ids["Bienvenida"]}/members`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ memberId: "x" }),
  })
  assert.equal(add.status, 403)
  const meeting = await carlos(`/api/ministries/${ids["Bienvenida"]}/meetings`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: "No", startsAt: new Date().toISOString() }),
  })
  assert.equal(meeting.status, 403)
})

test("ministerios: un líder (nivel leader, sin permisos globales) gestiona solo el suyo", async () => {
  const { ids } = await ministryIds()
  const lupita = await login("demo.celula@comuapp.test") // líder de Consolidación, servidora en Ujieres
  const created = await lupita(`/api/ministries/${ids["Consolidación"]}/meetings`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: `Junta ${Date.now()}`, kind: "internal", startsAt: new Date(Date.now() + 86400000).toISOString() }),
  })
  assert.equal(created.status, 201)
  const { id: meetingId } = await created.json()

  const sheetRes = await lupita(`/api/ministries/meetings/${meetingId}`)
  assert.equal(sheetRes.status, 200)
  const { sheet } = await sheetRes.json()
  assert.equal(sheet.canEdit, true)

  // Con servidores en la lista: agrega a alguien y pasa lista; una persona ajena se rechaza.
  const owner = await login("demo.owner@comuapp.test")
  const pastor = (await (await owner("/api/crud/members?q=Pastor+Principal")).json()).rows[0]
  const bad = await lupita(`/api/ministries/meetings/${meetingId}`, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ records: [{ memberId: "persona-ajena", status: "present" }] }),
  })
  assert.equal(bad.status, 400)
  const add = await lupita(`/api/ministries/${ids["Consolidación"]}/members`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ memberId: pastor.id, role: "servant" }),
  })
  assert.ok([201, 409].includes(add.status)) // 409 si una corrida previa ya lo agregó
  const ok = await lupita(`/api/ministries/meetings/${meetingId}`, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ records: [{ memberId: pastor.id, status: "present" }] }),
  })
  assert.equal(ok.status, 200)

  // En Ujieres solo es servidora: ve, pero no crea reuniones.
  assert.equal((await lupita(`/api/ministries/${ids["Ujieres"]}`)).status, 200)
  const denied = await lupita(`/api/ministries/${ids["Ujieres"]}/meetings`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: "No", startsAt: new Date().toISOString() }),
  })
  assert.equal(denied.status, 403)
  // De Producción no es: ni se revela que existe.
  assert.equal((await lupita(`/api/ministries/${ids["Producción"]}`)).status, 404)
})

test("ministerios: la requisición la decide la administración, no el líder", async () => {
  const { owner, ids } = await ministryIds()
  const lupita = await login("demo.celula@comuapp.test")
  const res = await lupita(`/api/ministries/${ids["Consolidación"]}/requests`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: `Folletos ${Date.now()}`, quantity: 50 }),
  })
  assert.equal(res.status, 201)
  const { id } = await res.json()
  const own = await lupita(`/api/ministries/requests/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "approved" }) })
  assert.equal(own.status, 403)
  const approved = await owner(`/api/ministries/requests/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "approved" }) })
  assert.equal(approved.status, 200)
})

test("alabanza: el líder arma programa y canciones; el servidor solo lee y responde por sí mismo", async () => {
  const { ids } = await ministryIds()
  const alabanza = ids["Alabanza"]
  const lupita = await login("demo.celula@comuapp.test") // líder de Alabanza
  const carlos = await login("demo.creyente@comuapp.test") // servidor de Alabanza

  // Catálogo: el servidor lo ve pero no escribe.
  assert.equal((await carlos("/api/worship/songs")).status, 200)
  const denied = await carlos("/api/worship/songs", { method: "POST", headers: json, body: JSON.stringify({ title: "No" }) })
  assert.equal(denied.status, 403)

  // El líder crea una canción con enlaces (solo http/https) y la pone en el programa de la semana.
  const title = `Prueba ${Date.now()}`
  const created = await lupita("/api/worship/songs", {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      title,
      songKey: "g",
      links: [
        { label: "YouTube", url: "https://example.com/a" },
        { label: "Malo", url: "javascript:alert(1)" },
      ],
    }),
  })
  assert.equal(created.status, 201)
  const { song } = await created.json()
  assert.equal(song.songKey, "G")
  assert.equal(song.links.length, 1)

  const week = "2030-01-07" // lunes
  const saved = await lupita(`/api/worship/${alabanza}/program?week=${week}`, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ title: "Prueba", songs: [{ songId: song.id, keyUsed: "A" }] }),
  })
  assert.equal(saved.status, 200)
  const read = await carlos(`/api/worship/${alabanza}/program?week=${week}`)
  assert.equal(read.status, 200)
  const { program } = await read.json()
  assert.equal(program.songs.length, 1)
  assert.equal(program.canEdit, false)
  const edit = await carlos(`/api/worship/${alabanza}/program?week=${week}`, { method: "PUT", headers: json, body: JSON.stringify({ songs: [] }) })
  assert.equal(edit.status, 403)

  // Quien no es del ministerio no ve ni que existe.
  const tesorero = await login("demo.tesorero@comuapp.test")
  assert.equal((await tesorero(`/api/worship/${alabanza}/program?week=${week}`)).status, 404)
})

test("alabanza: el rol lo responde solo la persona asignada y la audición se resuelve una vez", async () => {
  const { ids } = await ministryIds()
  const alabanza = ids["Alabanza"]
  const lupita = await login("demo.celula@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const owner = await login("demo.owner@comuapp.test")

  const month = new Date().toISOString().slice(0, 7)
  const rosterRes = await lupita(`/api/worship/${alabanza}/roster?month=${month}`)
  assert.equal(rosterRes.status, 200)
  const { roster } = await rosterRes.json()
  const mine = roster.entries.find((e) => e.mine === false) // asignación de otra persona (para Carlos)
  const carlosEntry = (await (await carlos(`/api/worship/${alabanza}/roster?month=${month}`)).json()).roster.entries.find((e) => e.mine)
  if (carlosEntry) {
    const ok = await carlos(`/api/worship/roster/${carlosEntry.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "confirmed" }) })
    assert.equal(ok.status, 200)
  }
  const other = roster.entries.find((e) => e.id !== carlosEntry?.id)
  if (other && mine) {
    const bad = await carlos(`/api/worship/roster/${other.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "declined" }) })
    assert.equal(bad.status, 403)
  }

  // Audición: el servidor no la ve; el líder la agenda y la resuelve; no se resuelve dos veces.
  assert.equal((await carlos(`/api/worship/${alabanza}/auditions`)).status, 403)
  const candidates = (await (await lupita(`/api/ministries/${alabanza}/members?q=`)).json()).candidates
  const pastor = (await (await owner("/api/crud/members?q=Pastor+Principal")).json()).rows[0]
  const target = candidates.find((c) => c.id === pastor.id) ?? candidates[0]
  assert.ok(target, "sin candidatos para audicionar")
  const sched = await lupita(`/api/worship/${alabanza}/auditions`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ memberId: target.id, instrument: "Teclado", scheduledAt: new Date(Date.now() + 86400000).toISOString() }),
  })
  assert.ok([201, 409].includes(sched.status))
  if (sched.status === 201) {
    const { id } = await sched.json()
    const done = await lupita(`/api/worship/auditions/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "passed", addToMinistry: true }) })
    assert.equal(done.status, 200)
    const again = await lupita(`/api/worship/auditions/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "failed" }) })
    assert.equal(again.status, 409)
  }
})

test("consolidación: el servidor atiende solo lo asignado; el líder registra y asigna", async () => {
  const { ids } = await ministryIds()
  const cid = ids["Consolidación"]
  const lupita = await login("demo.celula@comuapp.test") // líder
  const sofia = await login("demo.secretaria@comuapp.test") // servidora
  const carlos = await login("demo.creyente@comuapp.test") // ajeno

  assert.equal((await carlos(`/api/consolidation/${cid}/cases`)).status, 404)

  // El líder registra a una persona nueva; repetir el teléfono se detecta como duplicado.
  const phone = `87${String(Date.now()).slice(-8)}`
  const created = await lupita(`/api/consolidation/${cid}/cases`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ fullName: `Visita ${phone}`, phone, acceptedChrist: true, serviceLabel: "Domingo 10:00" }),
  })
  assert.equal(created.status, 201)
  const { id: caseId } = await created.json()
  const dup = await lupita(`/api/consolidation/${cid}/cases`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ fullName: "Otra persona", phone }),
  })
  assert.equal(dup.status, 409)

  // La servidora no puede atender ni asignar un caso que no es suyo.
  const noContact = await sofia(`/api/consolidation/cases/${caseId}/contacts`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ channel: "call", summary: "Hola" }),
  })
  assert.equal(noContact.status, 403)
  const noAssign = await sofia(`/api/consolidation/cases/${caseId}`, { method: "PATCH", headers: json, body: JSON.stringify({ assignedMemberId: "x" }) })
  assert.equal(noAssign.status, 403)

  // El líder la asigna a Sofía; ahora sí puede registrar el contacto y el caso pasa a seguimiento.
  const detail = await (await lupita(`/api/consolidation/${cid}/cases`)).json()
  const sofiaMember = detail.workspace.followers.find((f) => f.fullName.startsWith("Sofía"))
  assert.ok(sofiaMember)
  const assign = await lupita(`/api/consolidation/cases/${caseId}`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ assignedMemberId: sofiaMember.memberId }),
  })
  assert.equal(assign.status, 200)
  const contact = await sofia(`/api/consolidation/cases/${caseId}/contacts`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ channel: "call", summary: "Le gustó la reunión", interest: "yes" }),
  })
  assert.equal(contact.status, 201)
  const after = await (await sofia(`/api/consolidation/cases/${caseId}`)).json()
  assert.equal(after.case.status, "following")
  assert.equal(after.case.contacts.length, 1)

  // Canalizar exige destino; cerrado solo lo reabre el líder.
  const noOutcome = await sofia(`/api/consolidation/cases/${caseId}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "channeled" }) })
  assert.equal(noOutcome.status, 400)
  const channeled = await sofia(`/api/consolidation/cases/${caseId}`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ status: "channeled", outcome: "cell", outcomeNote: "Célula de jóvenes" }),
  })
  assert.equal(channeled.status, 200)
  const reopenDenied = await sofia(`/api/consolidation/cases/${caseId}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "following" }) })
  assert.equal(reopenDenied.status, 403)
  const reopen = await lupita(`/api/consolidation/cases/${caseId}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "following" }) })
  assert.equal(reopen.status, 200)
})

test("kids: la salida la autoriza quien tiene el permiso, no quien muestra el QR ni el servidor", async () => {
  const { ids } = await ministryIds()
  const kidsId = ids["Comunidad Kids"]
  const ana = await login("demo.admin@comuapp.test") // directora (permiso completo)
  const lupita = await login("demo.celula@comuapp.test") // maestra, sin permiso de salida
  const carlos = await login("demo.creyente@comuapp.test") // papá
  const tomas = await login("demo.tesorero@comuapp.test") // ajeno a Kids

  // Papá: ve a sus hijos con su QR; el espacio del personal le está vedado.
  const mine = await (await carlos("/api/kids/mine")).json()
  assert.ok(mine.children.length >= 2)
  const valeria = mine.children.find((c) => c.fullName.startsWith("Valeria"))
  assert.ok(valeria?.qrToken)
  assert.equal((await carlos(`/api/kids/${kidsId}`)).status, 404)

  // Un servidor no abre servicios; la directora sí.
  assert.equal((await lupita(`/api/kids/${kidsId}/sessions`, { method: "POST", headers: json, body: JSON.stringify({ label: "Domingo 10:00" }) })).status, 403)
  const opened = await ana(`/api/kids/${kidsId}/sessions`, { method: "POST", headers: json, body: JSON.stringify({ label: "Domingo 10:00" }) })
  assert.equal(opened.status, 201)
  const { id: sessionId } = await opened.json()

  // Entrada por QR (cualquier personal); un ajeno no identifica niños.
  assert.equal((await tomas(`/api/kids/sessions/${sessionId}/lookup`, { method: "POST", headers: json, body: JSON.stringify({ token: valeria.qrToken }) })).status, 404)
  const look = await lupita(`/api/kids/sessions/${sessionId}/lookup`, { method: "POST", headers: json, body: JSON.stringify({ token: `comuapp-kids:${valeria.qrToken}` }) })
  assert.equal(look.status, 200)
  const checkIn = await lupita(`/api/kids/sessions/${sessionId}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ token: valeria.qrToken }) })
  assert.ok([201, 409].includes(checkIn.status)) // 409 si una corrida previa ya la registró

  // Salida: la maestra no puede; la directora sí (o ya salió en una corrida previa).
  const noExit = await lupita(`/api/kids/sessions/${sessionId}/check-out`, { method: "POST", headers: json, body: JSON.stringify({ token: valeria.qrToken }) })
  assert.equal(noExit.status, 403)
  const exit = await ana(`/api/kids/sessions/${sessionId}/check-out`, { method: "POST", headers: json, body: JSON.stringify({ token: valeria.qrToken, pickedUpBy: "Carlos Creyente" }) })
  assert.ok([200, 409].includes(exit.status))

  // Mensajes: el personal avisa, el papá lee y responde; un ajeno no entra a la conversación.
  const alert = await ana(`/api/kids/children/${valeria.id}/messages`, { method: "POST", headers: json, body: JSON.stringify({ body: "Pasa por ella, por favor", kind: "alert" }) })
  assert.equal(alert.status, 201)
  const read = await (await carlos(`/api/kids/children/${valeria.id}/messages`)).json()
  assert.ok(read.messages.some((m) => m.kind === "alert" && m.body.startsWith("Pasa por ella")))
  const reply = await carlos(`/api/kids/children/${valeria.id}/messages`, { method: "POST", headers: json, body: JSON.stringify({ body: "Voy en camino" }) })
  assert.equal(reply.status, 201)
  assert.equal((await tomas(`/api/kids/children/${valeria.id}/messages`)).status, 404)
  // El papá no puede mandar alertas (queda como mensaje) ni leer niños ajenos.
  const asKind = await carlos(`/api/kids/children/${valeria.id}/messages`, { method: "POST", headers: json, body: JSON.stringify({ body: "x", kind: "alert" }) })
  assert.equal(asKind.status, 201)
})

test("células: el líder lleva varias células y actualiza el avance; el creyente no puede", async () => {
  const lupita = await login("demo.celula@comuapp.test") // líder de dos células
  const carlos = await login("demo.creyente@comuapp.test") // integrante de una
  const tomas = await login("demo.tesorero@comuapp.test") // ajeno

  const mine = (await (await lupita("/api/cells?scope=mine")).json()).cells
  const hogar = mine.find((c) => c.name === "Hogar de Amor Norte")
  const matri = mine.find((c) => c.name === "Matrimonios Centro")
  assert.ok(hogar && matri, "Lupita debe liderar las dos células")
  assert.notEqual(hogar.dayOfWeek, matri.dayOfWeek)

  // Cada célula se configura por separado.
  const before = (await (await lupita(`/api/cells/${hogar.id}`)).json()).cell
  const put = await lupita(`/api/cells/${matri.id}`, { method: "PUT", headers: json, body: JSON.stringify({ startTime: "20:30", dayOfWeek: 5 }) })
  assert.equal(put.status, 200)
  const after = (await (await lupita(`/api/cells/${hogar.id}`)).json()).cell
  assert.equal(after.startTime, before.startTime)
  assert.equal(after.dayOfWeek, before.dayOfWeek)

  // El creyente ve su célula sin datos de los demás y no la modifica ni cambia su avance.
  assert.equal((await carlos("/api/cells?scope=mine")).status, 200)
  const carlosCell = (await (await carlos(`/api/cells/${matri.id}`)).json()).cell
  assert.equal(carlosCell.members, null)
  assert.equal(carlosCell.access.canUpdateStage, false)
  assert.equal((await carlos(`/api/cells/${matri.id}`, { method: "PUT", headers: json, body: JSON.stringify({ name: "X" }) })).status, 403)
  const leaderView = (await (await lupita(`/api/cells/${matri.id}`)).json()).cell
  const carlosRow = leaderView.members.find((m) => m.fullName.startsWith("Carlos"))
  assert.ok(carlosRow)
  const selfStage = await carlos(`/api/cells/${matri.id}/members/${carlosRow.memberId}/stage`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ stage: "leadership" }),
  })
  assert.equal(selfStage.status, 403)
  assert.equal((await carlos(`/api/crud/members/${carlosRow.memberId}`, { method: "PATCH", headers: json, body: JSON.stringify({ visionStage: "leadership" }) })).status, 403)

  // El líder sí actualiza el avance de su integrante y queda en la bitácora.
  const nextStage = carlosRow.stage === "school" ? "launch" : "school"
  const staged = await lupita(`/api/cells/${matri.id}/members/${carlosRow.memberId}/stage`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ stage: nextStage }),
  })
  assert.equal(staged.status, 200)
  const reread = (await (await lupita(`/api/cells/${matri.id}`)).json()).cell
  assert.equal(reread.members.find((m) => m.memberId === carlosRow.memberId).stage, nextStage)
  // No puede actualizar a quien no es de esa célula.
  const hogarView = (await (await lupita(`/api/cells/${hogar.id}`)).json()).cell
  const foreign = hogarView.members.find((m) => m.role === "member")
  const wrongCell = await lupita(`/api/cells/${matri.id}/members/${foreign.memberId}/stage`, { method: "POST", headers: json, body: JSON.stringify({ stage: "school" }) })
  assert.equal(wrongCell.status, 404)

  // Cumpleañeros del mes y fecha del festejo (la última reunión del mes).
  assert.ok(Array.isArray(leaderView.birthdays))
  assert.match(leaderView.celebrationDate, /^\d{4}-\d{2}-\d{2}$/)

  // Ajeno: ni se entera de que existe; sin permiso global no ve todas.
  assert.equal((await tomas(`/api/cells/${matri.id}`)).status, 404)
  assert.equal((await tomas("/api/cells?scope=all")).status, 403)

  // Una persona en una célula no se agrega a otra: se pide traspaso.
  const dupAdd = await lupita(`/api/cells/${matri.id}/members`, { method: "POST", headers: json, body: JSON.stringify({ memberId: foreign.memberId }) })
  assert.equal(dupAdd.status, 409)
})

test("células: traspaso con aprobación, reunión con asistencia y nuevo creyente", async () => {
  const lupita = await login("demo.celula@comuapp.test")
  const mine = (await (await lupita("/api/cells?scope=mine")).json()).cells
  const hogar = mine.find((c) => c.name === "Hogar de Amor Norte")
  const matri = mine.find((c) => c.name === "Matrimonios Centro")
  const detail = async (c) => (await (await lupita(`/api/cells/${c.id}`)).json()).cell

  // Traspaso de Diego entre las dos células (se alterna para poder repetir la prueba).
  let from = matri
  let to = hogar
  let diego = (await detail(matri)).members.find((m) => m.fullName.startsWith("Diego"))
  if (!diego) {
    from = hogar
    to = matri
    diego = (await detail(hogar)).members.find((m) => m.fullName.startsWith("Diego"))
  }
  assert.ok(diego)
  const req = await lupita("/api/cells/transfers", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ memberId: diego.memberId, fromCellId: from.id, toCellId: to.id, reason: "Cambio de horario" }),
  })
  assert.equal(req.status, 201)
  const { id: transferId } = await req.json()
  const dupReq = await lupita("/api/cells/transfers", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ memberId: diego.memberId, fromCellId: from.id, toCellId: to.id }),
  })
  assert.equal(dupReq.status, 409)
  const approved = await lupita(`/api/cells/transfers/${transferId}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "approve" }) })
  assert.equal(approved.status, 200)
  assert.equal((await lupita(`/api/cells/transfers/${transferId}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "approve" }) })).status, 409)
  assert.ok((await detail(to)).members.some((m) => m.memberId === diego.memberId))
  assert.ok(!(await detail(from)).members.some((m) => m.memberId === diego.memberId))

  // Reunión: pasa lista en una fecha pasada; las futuras se rechazan.
  const day = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const tpl = await (await lupita(`/api/cells/${to.id}/meeting?date=${day}`)).json()
  assert.ok(tpl.meeting.attendance.length > 0)
  const saved = await lupita(`/api/cells/${to.id}/meetings`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ date: day, topic: "Prueba", presentMemberIds: [tpl.meeting.attendance[0].memberId] }),
  })
  assert.equal(saved.status, 201)
  const reread = await (await lupita(`/api/cells/${to.id}/meeting?date=${day}`)).json()
  assert.equal(reread.meeting.attendance.filter((a) => a.present).length, 1)
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  assert.equal((await lupita(`/api/cells/${to.id}/meetings`, { method: "POST", headers: json, body: JSON.stringify({ date: future, presentMemberIds: [] }) })).status, 400)

  // Nuevo creyente llegado por la célula: se registra una vez; repetir el teléfono avisa del duplicado.
  const phone = `87${String(Date.now()).slice(-8)}`
  const created = await lupita(`/api/cells/${to.id}/new-believers`, { method: "POST", headers: json, body: JSON.stringify({ fullName: `Invitado ${phone}`, phone }) })
  assert.equal(created.status, 201)
  const dup = await lupita(`/api/cells/${to.id}/new-believers`, { method: "POST", headers: json, body: JSON.stringify({ fullName: "Otro", phone }) })
  assert.equal(dup.status, 409)
})

test("kids: evento fuera de servicio y reporte mensual por salón", async () => {
  const { ids } = await ministryIds()
  const kidsId = ids["Comunidad Kids"]
  const ana = await login("demo.admin@comuapp.test")
  const lupita = await login("demo.celula@comuapp.test") // maestra: no abre eventos
  const today = new Date().toISOString().slice(0, 10)
  const payload = { label: `Campamento ${Date.now()}`, kind: "event", date: today, endDate: today, location: "Campamento Los Pinos" }

  assert.equal((await lupita(`/api/kids/${kidsId}/sessions`, { method: "POST", headers: json, body: JSON.stringify(payload) })).status, 403)
  const bad = await ana(`/api/kids/${kidsId}/sessions`, { method: "POST", headers: json, body: JSON.stringify({ ...payload, endDate: "2000-01-01" }) })
  assert.equal(bad.status, 400)
  const ok = await ana(`/api/kids/${kidsId}/sessions`, { method: "POST", headers: json, body: JSON.stringify(payload) })
  assert.equal(ok.status, 201)
  const { id: sessionId } = await ok.json()
  const detail = (await (await ana(`/api/kids/sessions/${sessionId}`)).json()).detail
  assert.equal(detail.session.kind, "event")
  assert.equal(detail.session.location, "Campamento Los Pinos")
  // Un evento sin niños dentro se cierra sin problema.
  assert.equal((await ana(`/api/kids/sessions/${sessionId}`, { method: "PATCH", headers: json, body: JSON.stringify({ action: "close" }) })).status, 200)

  const report = (await (await ana(`/api/kids/${kidsId}/report?month=${today.slice(0, 7)}`)).json()).report
  assert.ok(report.sessions.length >= 1)
  assert.ok(report.rooms.length >= 1)
  assert.equal(report.totalAttendances, Object.values(report.totalsByRoom).reduce((a, b) => a + b, 0))
  assert.ok(report.sessions.some((x) => x.kind === "event"))
})

test("reuniones: la asistencia la registra quien tiene el permiso; todos ven horario y temas", async () => {
  const sofia = await login("demo.secretaria@comuapp.test") // registra (gatherings.manage)
  const tomas = await login("demo.tesorero@comuapp.test") // sin permiso
  const carlos = await login("demo.creyente@comuapp.test") // creyente

  // Cualquier integrante ve horarios y temas, sin cifras.
  const overview = await (await carlos("/api/gatherings/overview")).json()
  assert.ok(overview.overview.series.length >= 1)
  assert.ok(!JSON.stringify(overview.overview.recent).includes("menCount"))
  // Sin permiso no se ven ni cifras ni reportes ni se registra.
  assert.equal((await carlos("/api/gatherings")).status, 403)
  assert.equal((await carlos("/api/gatherings/report")).status, 403)
  assert.equal((await tomas("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ date: "2026-01-04", counts: {} }) })).status, 403)

  const series = (await (await sofia("/api/gatherings/series")).json()).series
  const domingo = series.find((x) => x.name === "Domingo 10:00")
  assert.ok(domingo)

  // Valida: fecha futura, cantidades y nuevos mayores que el total.
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  assert.equal((await sofia("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ seriesId: domingo.id, date: future, counts: {} }) })).status, 400)
  const today = new Date().toISOString().slice(0, 10)
  assert.equal(
    (await sofia("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ seriesId: domingo.id, date: today, counts: { men: 1, women: 1, new: 5 } }) })).status,
    400
  )
  assert.equal(
    (await sofia("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ seriesId: domingo.id, date: today, counts: { men: -3 } }) })).status,
    400
  )

  // Registro válido en una fecha antigua (no choca con la demo): se crea, se repite como duplicado y se edita.
  const date = `2020-${String((Date.now() % 11) + 1).padStart(2, "0")}-${String((Date.now() % 27) + 1).padStart(2, "0")}`
  const body = { seriesId: domingo.id, date, topic: "Prueba", speakerName: "Invitado", counts: { men: 10, women: 20, youth: 5, kids: 7, new: 3 } }
  const created = await sofia("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify(body) })
  assert.ok([201, 409].includes(created.status))
  if (created.status === 201) {
    const { id } = await created.json()
    assert.equal((await sofia("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify(body) })).status, 409)
    const detail = (await (await sofia(`/api/gatherings/${id}`)).json()).gathering
    assert.equal(detail.total, 42) // nuevos no suma
    assert.equal(detail.counts.new, 3)
    const upd = await sofia(`/api/gatherings/${id}`, { method: "PUT", headers: json, body: JSON.stringify({ ...body, counts: { ...body.counts, men: 12 } }) })
    assert.equal(upd.status, 200)
    assert.equal((await (await sofia(`/api/gatherings/${id}`)).json()).gathering.total, 44)
    assert.equal((await sofia(`/api/gatherings/${id}`, { method: "DELETE" })).status, 200)
  }

  // Reporte del mes por horario.
  const report = (await (await sofia(`/api/gatherings/report?month=${today.slice(0, 7)}`)).json()).report
  assert.ok(Array.isArray(report.bySeries))
  assert.equal(report.summary.total, Object.entries(report.summary.totals).filter(([k]) => k !== "new").reduce((a, [, v]) => a + v, 0))
})

test("grupos: quien lidera Jóvenes gestiona solo las reuniones y eventos de su grupo", async () => {
  const { ids } = await ministryIds()
  const tomas = await login("demo.tesorero@comuapp.test") // líder de Jóvenes (sin permisos globales)
  const carlos = await login("demo.creyente@comuapp.test")
  const jovenes = ids["VTR (Jóvenes)"]
  const varones = ids["Hombres de Reino (HR)"]
  assert.ok(jovenes && varones)

  // Reuniones: ve y registra las de su grupo; no las de otros ni las generales.
  const list = await (await tomas("/api/gatherings")).json()
  assert.ok(list.gatherings.length >= 1)
  assert.ok(list.gatherings.every((g) => g.ministryId === jovenes))
  const day = `2019-${String((Date.now() % 11) + 1).padStart(2, "0")}-${String((Date.now() % 27) + 1).padStart(2, "0")}`
  const mine = await tomas("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ ministryId: jovenes, date: day, topic: "Prueba", counts: { youth: 20 } }) })
  assert.ok([201, 409].includes(mine.status))
  if (mine.status === 201) {
    const { id } = await mine.json()
    assert.equal((await tomas(`/api/gatherings/${id}`, { method: "DELETE" })).status, 200)
  }
  assert.equal((await tomas("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ date: day, counts: {} }) })).status, 403)
  assert.equal((await tomas("/api/gatherings", { method: "POST", headers: json, body: JSON.stringify({ ministryId: varones, date: day, counts: {} }) })).status, 403)

  // Eventos: solo ve los de su grupo y solo crea para su grupo.
  const events = (await (await tomas("/api/events?scope=all")).json()).events
  assert.ok(events.length >= 1)
  assert.ok(events.every((e) => e.groupName === "VTR (Jóvenes)"))
  const payload = { name: `Evento ${Date.now()}`, scope: "internal", startsAt: new Date(Date.now() + 9 * 86400000).toISOString(), price: 0 }
  assert.equal((await tomas("/api/events", { method: "POST", headers: json, body: JSON.stringify({ ...payload, ministryId: jovenes }) })).status, 201)
  assert.equal((await tomas("/api/events", { method: "POST", headers: json, body: JSON.stringify(payload) })).status, 403)
  assert.equal((await tomas("/api/events", { method: "POST", headers: json, body: JSON.stringify({ ...payload, ministryId: varones }) })).status, 403)
  // Un creyente sin relación con el grupo no gestiona nada.
  assert.equal((await carlos("/api/events?scope=all")).status, 403)
})

test("eventos: público, cupo, acomodo por asientos, pagos y entrada por QR", async () => {
  const ana = await login("demo.admin@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const lupita = await login("demo.celula@comuapp.test")

  // Un creyente no ve eventos solo para líderes; sí los abiertos.
  const mineEvents = (await (await carlos("/api/events?scope=mine&upcoming=1")).json()).events
  assert.ok(!mineEvents.some((e) => e.name === "Taller de liderazgo"))
  assert.ok(mineEvents.some((e) => e.name === "Noche de jóvenes"))
  const adminEvents = (await (await ana("/api/events?scope=all")).json()).events
  const taller = adminEvents.find((e) => e.name === "Taller de liderazgo")
  assert.ok(taller)
  assert.equal((await carlos(`/api/events/${taller.id}`)).status, 404)
  assert.equal((await lupita(`/api/events/${taller.id}`)).status, 200) // líder de célula: entra en su público

  // Se crea un evento propio con asientos del Auditorio Menor, cupo 3 y costo.
  const venues = (await (await ana("/api/events/venues")).json()).venues
  const menor = venues.find((v) => v.name === "Auditorio Menor")
  assert.ok(menor && menor.capacity > 100)
  const created = await ana("/api/events", {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      name: `Prueba acomodo ${Date.now()}`,
      scope: "internal",
      kind: "Taller",
      startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      venueId: menor.id,
      seating: "seats",
      seatSelection: "both",
      price: 100,
      capacity: 3,
      audience: "open",
    }),
  })
  assert.equal(created.status, 201)
  const { id } = await created.json()
  // Borrador: el creyente aún no lo ve ni aparta.
  assert.equal((await carlos(`/api/events/${id}`)).status, 404)
  assert.equal((await ana(`/api/events/${id}/status`, { method: "POST", headers: json, body: JSON.stringify({ status: "published" }) })).status, 200)

  // Carlos elige su asiento; otro intento por el mismo lugar se rechaza; no repite boleto.
  const reserve = await carlos(`/api/events/${id}/reserve`, { method: "POST", headers: json, body: JSON.stringify({ seatCode: "A-5" }) })
  assert.equal(reserve.status, 201)
  assert.equal((await carlos(`/api/events/${id}/reserve`, { method: "POST", headers: json, body: JSON.stringify({ seatCode: "A-6" }) })).status, 409)
  const guestSame = await ana(`/api/events/${id}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ guestName: "Invitado 1", seatCode: "A-5" }) })
  assert.equal(guestSame.status, 409)
  assert.equal((await ana(`/api/events/${id}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ guestName: "Invitado X", seatCode: "ZZ-99" }) })).status, 400)

  // Asignación automática y cupo (3): el cuarto boleto no entra.
  const g1 = await ana(`/api/events/${id}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ guestName: "Invitado 1", autoAssign: true }) })
  assert.equal(g1.status, 201)
  const g2 = await ana(`/api/events/${id}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ guestName: "Invitado 2", price: 0, autoAssign: true }) })
  assert.equal(g2.status, 201)
  assert.equal((await ana(`/api/events/${id}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ guestName: "Invitado 3", autoAssign: true }) })).status, 409)

  // Pagos: no excede el saldo; al liquidar el boleto pasa a pagado.
  let detail = (await (await ana(`/api/events/${id}`)).json()).event
  const t1 = detail.tickets.find((t) => t.name === "Invitado 1")
  assert.equal(t1.balance, 100)
  assert.equal((await ana(`/api/events/${id}/tickets/${t1.id}/payments`, { method: "POST", headers: json, body: JSON.stringify({ amount: 150 }) })).status, 400)
  assert.equal((await ana(`/api/events/${id}/tickets/${t1.id}/payments`, { method: "POST", headers: json, body: JSON.stringify({ amount: 40, method: "cash" }) })).status, 201)
  detail = (await (await ana(`/api/events/${id}`)).json()).event
  assert.equal(detail.tickets.find((t) => t.id === t1.id).balance, 60)
  assert.equal(detail.tickets.find((t) => t.id === t1.id).status, "reserved")

  // Entrada por QR: con saldo se avisa (402); el personal puede permitirla; no se repite.
  const code = detail.tickets.find((t) => t.id === t1.id).code
  assert.equal((await ana(`/api/events/${id}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ code: `comuapp-event:${code}` }) })).status, 402)
  assert.equal((await ana(`/api/events/${id}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ code, allowUnpaid: true }) })).status, 200)
  assert.equal((await ana(`/api/events/${id}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ code }) })).status, 409)
  // Quien ya entró no cancela; sin permiso de entrada no se escanea.
  assert.equal((await ana(`/api/events/${id}/tickets/${t1.id}`, { method: "DELETE" })).status, 409)
  assert.equal((await carlos(`/api/events/${id}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ code }) })).status, 403)

  // Carlos puede cancelar su boleto (libera el lugar) y ve solo el suyo.
  const mine = (await (await carlos(`/api/events/${id}`)).json()).event
  assert.equal(mine.tickets, null)
  assert.equal(mine.myTicket.seatCode, "A-5")
  assert.equal((await carlos(`/api/events/${id}/tickets/${mine.myTicket.id}`, { method: "DELETE" })).status, 200)

  // Cierra la prueba para no dejar el evento abierto.
  await ana(`/api/events/${id}/status`, { method: "POST", headers: json, body: JSON.stringify({ status: "cancelled" }) })
})

test("escuela: libros en orden, un libro a la vez, cuestionario con revisión del maestro y cierre", async () => {
  const ana = await login("demo.admin@comuapp.test") // directora de la escuela
  const lupita = await login("demo.celula@comuapp.test") // subdirectora y maestra del grupo de prueba
  const tomas = await login("demo.tesorero@comuapp.test") // alumno de la prueba
  const carlos = await login("demo.creyente@comuapp.test") // alumno de otro grupo

  // Limpieza: si una corrida anterior dejó a Tomás inscrito, se le da de baja.
  const leftovers = (await (await tomas("/api/school")).json()).overview.mine.filter((e) => e.status === "enrolled" || e.status === "requested")
  for (const e of leftovers) {
    await ana(`/api/school/enrollments/${e.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ action: e.status === "requested" ? "reject" : "drop" }) })
  }

  // Catálogo y portal propio.
  const overview = (await (await carlos("/api/school")).json()).overview
  const ministry = overview.schools.find((x) => x.kind === "ministry")
  assert.ok(ministry && ministry.courses.length >= 4)
  assert.ok(overview.mine.some((e) => e.status === "enrolled"))
  // Un creyente sin relación no configura la escuela.
  assert.equal((await carlos(`/api/school/programs/${ministry.id}/courses`, { method: "POST", headers: json, body: JSON.stringify({ name: "No" }) })).status, 403)

  // La dirección crea un libro de prueba con una tarea de tres preguntas.
  const stamp = Date.now()
  const course = await ana(`/api/school/programs/${ministry.id}/courses`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: `Prueba ${stamp}`, sortOrder: 1, weeks: 8, tasksCount: 1, exercisesCount: 1, enrollmentFee: 0 }),
  })
  assert.equal(course.status, 201)
  const { id: courseId } = await course.json()
  const bad = await ana(`/api/school/courses/${courseId}/assessments`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ kind: "task", number: 1, title: "T", questions: [{ type: "multiple_choice", prompt: "x", config: { options: [{ text: "a" }], correct: 0 } }] }),
  })
  assert.equal(bad.status, 400) // una sola opción
  const assessment = await ana(`/api/school/courses/${courseId}/assessments`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      kind: "task",
      number: 1,
      title: "Tarea de prueba",
      maxAttempts: 1,
      isPublished: true,
      questions: [
        { type: "multiple_choice", prompt: "Dos más dos", points: 2, config: { options: [{ text: "3" }, { text: "4" }], correct: 1 } },
        { type: "true_false", prompt: "El cielo es verde", points: 1, config: { correct: false } },
        { type: "open", prompt: "Explica", points: 4, config: {} },
      ],
    }),
  })
  assert.equal(assessment.status, 201)
  const { id: assessmentId } = await assessment.json()

  // Grupo con maestra; se inscribe a Tomás; no se repite ni se cursan dos a la vez.
  const staff = (await (await ana("/api/school/staff?q=Lupita")).json()).people
  const lupitaMember = staff.find((x) => x.fullName.startsWith("Lupita"))
  assert.ok(lupitaMember)
  const group = await ana(`/api/school/courses/${courseId}/groups`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "Grupo prueba", teacherMemberId: lupitaMember.id, status: "open" }),
  })
  assert.equal(group.status, 201)
  const { id: groupId } = await group.json()
  const people = (await (await ana(`/api/school/groups/${groupId}/people?q=Tomás`)).json()).people
  const tomasMember = people.find((x) => x.fullName.startsWith("Tomás"))
  assert.ok(tomasMember)
  const enroll = await ana(`/api/school/groups/${groupId}/enroll`, { method: "POST", headers: json, body: JSON.stringify({ memberId: tomasMember.id }) })
  assert.equal(enroll.status, 201)
  const { id: enrollmentId } = await enroll.json()
  assert.equal((await ana(`/api/school/groups/${groupId}/enroll`, { method: "POST", headers: json, body: JSON.stringify({ memberId: tomasMember.id }) })).status, 409)
  // El libro 2 exige haber aprobado el 1.
  const second = ministry.courses.find((c) => c.sortOrder === 2)
  const secondGroup = second.groups[0]
  if (secondGroup) {
    assert.equal((await tomas(`/api/school/groups/${secondGroup.id}/enroll`, { method: "POST", headers: json, body: JSON.stringify({}) })).status, 409)
  }

  // Nadie más ve esa inscripción ni la planilla.
  assert.equal((await carlos(`/api/school/enrollments/${enrollmentId}`)).status, 404)
  assert.equal((await carlos(`/api/school/groups/${groupId}`)).status, 404)

  // Tomás responde: no ve las respuestas correctas; la abierta queda para revisión.
  const take = (await (await tomas(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`)).json()).take
  assert.equal(take.questions.length, 3)
  assert.ok(!JSON.stringify(take).includes('"correct"'))
  assert.equal((await tomas(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`, { method: "POST", headers: json, body: JSON.stringify({ action: "start" }) })).status, 200)
  const q = take.questions
  const submit = await tomas(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ action: "submit", answers: { [q[0].id]: 1, [q[1].id]: false, [q[2].id]: "Porque dos y dos son cuatro" } }),
  })
  assert.equal(submit.status, 200)
  const submitted = await submit.json()
  assert.equal(submitted.needsReview, true)
  // Sin más intentos.
  assert.equal((await tomas(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`, { method: "POST", headers: json, body: JSON.stringify({ action: "submit", answers: {} }) })).status, 409)

  // La maestra revisa y califica; el alumno no puede calificarse.
  const reviews = (await (await lupita(`/api/school/groups/${groupId}/reviews`)).json()).reviews
  assert.equal(reviews.length, 1)
  assert.equal((await tomas(`/api/school/groups/${groupId}/reviews`)).status, 403)
  const sub = (await (await lupita(`/api/school/submissions/${reviews[0].id}`)).json()).submission
  const open = sub.questions.find((x) => x.type === "open")
  const withoutPoints = await lupita(`/api/school/submissions/${reviews[0].id}`, { method: "POST", headers: json, body: JSON.stringify({ perQuestion: {} }) })
  assert.equal(withoutPoints.status, 400)
  const graded = await lupita(`/api/school/submissions/${reviews[0].id}`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ perQuestion: { [open.id]: { points: 4, comment: "Bien" } }, feedback: "Buen trabajo" }),
  })
  assert.equal(graded.status, 200)
  assert.equal((await graded.json()).percent, 100)
  assert.equal((await tomas(`/api/school/enrollments/${enrollmentId}/grades`, { method: "POST", headers: json, body: JSON.stringify({ assessmentId, value: 10 }) })).status, 403)

  // La planilla refleja la nota 10 en la tarea 1 y el promedio de tareas.
  const book = (await (await lupita(`/api/school/groups/${groupId}`)).json()).book
  const row = book.rows.find((x) => x.enrollmentId === enrollmentId)
  assert.equal(row.tasks["1"].value, 10)
  assert.equal(row.tasksAvg, 10)

  // Pase de lista y cierre: sin ejercicio, la general es (10 + 0) / 2 = 5 → no aprobado.
  assert.equal(
    (await lupita(`/api/school/groups/${groupId}/sessions`, { method: "POST", headers: json, body: JSON.stringify({ week: 1, date: new Date().toISOString().slice(0, 10), topic: "Clase", attendance: { [enrollmentId]: "present" } }) })).status,
    200
  )
  assert.equal((await lupita(`/api/school/groups/${groupId}/close`, { method: "POST" })).status, 200) // subdirectora
  const after = (await (await tomas(`/api/school/enrollments/${enrollmentId}`)).json()).portal
  assert.equal(after.enrollment.status, "failed")
  assert.equal(after.enrollment.finalGrade, 5)
  assert.equal(after.enrollment.passed, false)
})

test("libro digital: el servidor solo entrega las páginas de la clase; los apuntes son privados; aprobar sube la etapa", async () => {
  const ana = await login("demo.admin@comuapp.test")
  const lupita = await login("demo.celula@comuapp.test") // maestra
  const tomas = await login("demo.tesorero@comuapp.test") // alumno
  const carlos = await login("demo.creyente@comuapp.test") // ajeno al grupo
  const owner = await login("demo.owner@comuapp.test")

  const leftovers = (await (await tomas("/api/school")).json()).overview.mine.filter((e) => e.status === "enrolled" || e.status === "requested")
  for (const e of leftovers) {
    await ana(`/api/school/enrollments/${e.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ action: e.status === "requested" ? "reject" : "drop" }) })
  }
  const ministry = (await (await ana("/api/school")).json()).overview.schools.find((x) => x.kind === "ministry")

  // Libro de prueba con tarea y ejercicio; grupo con Lupita; Tomás inscrito.
  const course = await (
    await ana(`/api/school/programs/${ministry.id}/courses`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: `Libro digital ${Date.now()}`, sortOrder: 1, weeks: 8, tasksCount: 1, exercisesCount: 1, enrollmentFee: 0 }),
    })
  ).json()
  const courseId = course.id
  for (const kind of ["task", "exercise"]) {
    const a = await ana(`/api/school/courses/${courseId}/assessments`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ kind, number: 1, title: kind, isPublished: true, questions: [{ type: "true_false", prompt: "x", points: 1, config: { correct: true } }] }),
    })
    assert.equal(a.status, 201)
  }
  const staff = (await (await ana("/api/school/staff?q=Lupita")).json()).people
  const group = await (
    await ana(`/api/school/courses/${courseId}/groups`, { method: "POST", headers: json, body: JSON.stringify({ name: "Grupo libro", teacherMemberId: staff[0].id, status: "open" }) })
  ).json()
  const people = (await (await ana(`/api/school/groups/${group.id}/people?q=Tomás`)).json()).people
  const enrollment = await (await ana(`/api/school/groups/${group.id}/enroll`, { method: "POST", headers: json, body: JSON.stringify({ memberId: people[0].id }) })).json()

  // Sube un PDF de 5 páginas; tipos no permitidos y alumnos no suben.
  const pdf = await PDFDocument.create()
  for (let i = 0; i < 5; i++) pdf.addPage([300, 400]).drawText(`Página ${i + 1}`, { x: 20, y: 350 })
  const bytes = await pdf.save()
  const upload = async (api, name, type, data) => {
    const form = new FormData()
    form.append("file", new File([data], name, { type }))
    const res = await api(`/api/school/courses/${courseId}/documents`, { method: "POST", body: form })
    return res
  }
  assert.equal((await upload(tomas, "libro.pdf", "application/pdf", bytes)).status, 403)
  assert.equal((await upload(ana, "virus.exe", "application/x-msdownload", new Uint8Array([1, 2, 3]))).status, 415)
  const up = await upload(ana, "libro.pdf", "application/pdf", bytes)
  assert.equal(up.status, 201)
  const { id: documentId, pageCount } = await up.json()
  assert.equal(pageCount, 5)

  // Secciones: semana 1 = págs. 1–2; semana 2 = págs. 3–5. Páginas fuera de rango se rechazan.
  const bad = await ana(`/api/school/documents/${documentId}`, { method: "PUT", headers: json, body: JSON.stringify({ title: "Libro", sections: [{ week: 1, title: "Intro", fromPage: 1, toPage: 9 }] }) })
  assert.equal(bad.status, 400)
  const sections = await ana(`/api/school/documents/${documentId}`, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({
      title: "Libro de prueba",
      sections: [
        { week: 1, title: "Introducción", fromPage: 1, toPage: 2 },
        { week: 2, title: "Desarrollo", fromPage: 3, toPage: 5 },
      ],
    }),
  })
  assert.equal(sections.status, 200)

  // Quien no cursa no lo ve; Tomás ve solo la semana 1 y su PDF trae solo 2 páginas.
  assert.equal((await carlos(`/api/school/documents/${documentId}`)).status, 404)
  assert.equal((await carlos(`/api/school/documents/${documentId}/file`)).status, 404)
  const view = (await (await tomas(`/api/school/documents/${documentId}`)).json()).document
  assert.deepEqual(view.pages, [1, 2])
  const file = await tomas(`/api/school/documents/${documentId}/file`)
  assert.equal(file.status, 200)
  assert.equal(file.headers.get("cache-control"), "private, no-store")
  const subset = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))
  assert.equal(subset.getPageCount(), 2)

  // Apuntes: privados, solo en páginas habilitadas.
  const note = { page: 2, kind: "note", color: "#4ade80", rects: [{ x: 0.1, y: 0.2, w: 0.4, h: 0.05 }], text: "Idea importante", quote: "Página 2" }
  assert.equal((await tomas(`/api/school/documents/${documentId}/annotations`, { method: "POST", headers: json, body: JSON.stringify({ ...note, page: 4 }) })).status, 400)
  assert.equal((await tomas(`/api/school/documents/${documentId}/annotations`, { method: "POST", headers: json, body: JSON.stringify({ ...note, rects: [] }) })).status, 400)
  const saved = await tomas(`/api/school/documents/${documentId}/annotations`, { method: "POST", headers: json, body: JSON.stringify(note) })
  assert.equal(saved.status, 201)
  const { id: annotationId } = await saved.json()
  assert.equal((await (await tomas(`/api/school/documents/${documentId}`)).json()).document.annotations.length, 1)
  // La dirección ve el documento pero no los apuntes del alumno, y no puede borrarlos.
  assert.equal((await (await ana(`/api/school/documents/${documentId}`)).json()).document.annotations.length, 0)
  assert.equal((await ana(`/api/school/documents/${documentId}/annotations?id=${annotationId}`, { method: "DELETE" })).status, 404)

  // Al darse la clase de la semana 2 se habilitan las páginas 3 a 5.
  const day = new Date().toISOString().slice(0, 10)
  assert.equal((await lupita(`/api/school/groups/${group.id}/sessions`, { method: "POST", headers: json, body: JSON.stringify({ week: 2, date: day, attendance: { [enrollment.id]: "present" } }) })).status, 200)
  assert.deepEqual((await (await tomas(`/api/school/documents/${documentId}`)).json()).document.pages, [1, 2, 3, 4, 5])
  assert.equal((await tomas(`/api/school/documents/${documentId}/annotations?id=${annotationId}`, { method: "DELETE" })).status, 200)

  // Aprobar el libro sube su etapa en la visión a «Escuela» y queda en la bitácora.
  const tomasMember = people[0]
  const beforeStage = (await (await owner(`/api/crud/members/${tomasMember.id}`)).json()).row.visionStage
  const assessments = (await (await ana(`/api/school/courses/${courseId}`)).json()).course.assessments
  for (const a of assessments) {
    assert.equal((await lupita(`/api/school/enrollments/${enrollment.id}/grades`, { method: "POST", headers: json, body: JSON.stringify({ assessmentId: a.id, value: 10 }) })).status, 200)
  }
  assert.equal((await ana(`/api/school/groups/${group.id}/close`, { method: "POST" })).status, 200)
  const afterStage = (await (await owner(`/api/crud/members/${tomasMember.id}`)).json()).row.visionStage
  const order = ["win", "consolidate", "encounter", "school", "launch", "leadership", "discipleship"]
  assert.ok(order.indexOf(afterStage) >= order.indexOf("school"))
  assert.ok(order.indexOf(afterStage) >= order.indexOf(beforeStage)) // nunca retrocede

  // El diploma no se emite sin todos los libros aprobados.
  assert.equal((await ana("/api/school/diplomas", { method: "POST", headers: json, body: JSON.stringify({ memberId: tomasMember.id }) })).status, 409)
  // Reporte de aprobados del periodo.
  const year = new Date().getFullYear()
  const report = (await (await ana(`/api/school/reports/approvals?from=${year}-01-01&to=${year}-12-31`)).json()).report
  assert.ok(report.totals.passed >= 1)
  assert.ok(report.groups.some((g) => g.groupId === group.id))

  // Diploma: solo la dirección lo configura; el alumno no ve ni la plantilla.
  const schoolId = (await (await ana("/api/school")).json()).overview.schools.find((s) => s.kind === "ministry").id
  const diplomaApi = `/api/school/programs/${schoolId}/diploma`
  assert.equal((await tomas(diplomaApi)).status, 403)
  assert.equal((await tomas(`${diplomaApi}/sample`)).status, 403)
  const diplomaCfg = (await (await ana(diplomaApi)).json()).config
  assert.equal(diplomaCfg.mode === "generated" || diplomaCfg.mode === "uploaded", true)
  // El diseño del sistema genera un PDF de ejemplo.
  assert.equal((await ana(diplomaApi, { method: "PUT", headers: json, body: JSON.stringify({ mode: "generated" }) })).status, 200)
  const diplomaSample = await ana(`${diplomaApi}/sample`)
  assert.equal(diplomaSample.status, 200)
  assert.equal(diplomaSample.headers.get("content-type"), "application/pdf")
  assert.equal(Buffer.from(await diplomaSample.arrayBuffer()).subarray(0, 5).toString(), "%PDF-")
  // Con su propio diploma: formatos inválidos se rechazan; una imagen válida se acepta y se posiciona.
  const badDiploma = new FormData()
  badDiploma.set("file", new File(["hola"], "nota.txt", { type: "text/plain" }))
  assert.equal((await ana(diplomaApi, { method: "POST", body: badDiploma })).status, 415)
  const diplomaPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
  const goodDiploma = new FormData()
  goodDiploma.set("file", new File([diplomaPng], "diploma.png", { type: "image/png" }))
  assert.equal((await ana(diplomaApi, { method: "POST", body: goodDiploma })).status, 201)
  assert.equal(
    (await ana(diplomaApi, { method: "PUT", headers: json, body: JSON.stringify({ mode: "uploaded", nameX: 0.4, nameY: 0.55, nameSize: 0.05, nameColor: "#7c2d12", showSerial: false }) })).status,
    200
  )
  const savedDiploma = (await (await ana(diplomaApi)).json()).config
  assert.equal(savedDiploma.mode, "uploaded")
  assert.equal(savedDiploma.hasTemplate, true)
  assert.equal(savedDiploma.nameColor, "#7c2d12")
  assert.equal((await ana(`${diplomaApi}/template`)).status, 200)
  assert.equal((await ana(`${diplomaApi}/sample`)).status, 200)
  // Se deja como estaba para no alterar otras pruebas.
  assert.equal((await ana(diplomaApi, { method: "PUT", headers: json, body: JSON.stringify({ mode: "generated" }) })).status, 200)
  // Finalizar un evento inexistente no entrega nada.
  assert.equal((await ana("/api/events/no-existe/finish", { method: "POST" })).status, 404)
})

test("finanzas: la tesorería registra y confirma; el creyente solo avisa; la nómina es aparte", async () => {
  const tomas = await login("demo.tesorero@comuapp.test") // tesorería (finance + payroll + vehicles)
  const carlos = await login("demo.creyente@comuapp.test")
  const sofia = await login("demo.secretaria@comuapp.test") // sin permisos financieros

  // Sin permisos no se ve nada de finanzas.
  assert.equal((await carlos("/api/finance/summary")).status, 403)
  assert.equal((await sofia("/api/finance/summary")).status, 403)
  assert.equal((await sofia("/api/finance/payroll")).status, 403)
  assert.equal((await sofia("/api/finance/vehicles")).status, 403)

  // Corte suelto: valida montos y suma al resumen del mes.
  const day = new Date().toISOString().slice(0, 10)
  assert.equal((await tomas("/api/finance/incomes/cut", { method: "POST", headers: json, body: JSON.stringify({ date: day }) })).status, 400)
  const before = (await (await tomas("/api/finance/summary")).json()).summary
  const cut = await tomas("/api/finance/incomes/cut", { method: "POST", headers: json, body: JSON.stringify({ date: day, tithes: 1000, offerings: 250.5 }) })
  assert.equal(cut.status, 201)
  const after = (await (await tomas("/api/finance/summary")).json()).summary
  assert.equal(Math.round((after.income.total - before.income.total) * 100) / 100, 1250.5)

  // Donativo: el creyente avisa, Carlos no puede confirmarlo, la tesorería sí (una sola vez) y nace el ingreso.
  const report = await carlos("/api/finance/donations", { method: "POST", headers: json, body: JSON.stringify({ amount: 321, kind: "offering", reference: `T-${Date.now()}` }) })
  assert.equal(report.status, 201)
  const { id: donationId } = await report.json()
  assert.equal((await carlos(`/api/finance/donations/${donationId}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "confirm" }) })).status, 403)
  assert.equal((await tomas(`/api/finance/donations/${donationId}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "confirm" }) })).status, 200)
  assert.equal((await tomas(`/api/finance/donations/${donationId}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "confirm" }) })).status, 409)
  const incomes = (await (await tomas(`/api/finance/incomes?month=${day.slice(0, 7)}`)).json()).incomes
  const fromDonation = incomes.find((i) => i.amount === 321 && i.source === "transfer")
  assert.ok(fromDonation)
  assert.equal((await tomas(`/api/finance/incomes/${fromDonation.id}`, { method: "DELETE" })).status, 409) // viene de un donativo
  // El webhook de pasarela exige una iglesia con pasarela configurada y firma válida.
  assert.equal((await tomas("/api/finance/donations/webhook/stripe", { method: "POST" })).status, 404)

  // Vehículos: el servicio genera su gasto; los documentos por vencer dan alerta; km coherentes.
  const name = `Vehículo ${Date.now()}`
  const created = await tomas("/api/finance/vehicles", { method: "POST", headers: json, body: JSON.stringify({ name, plate: "tst-001", odometer: 1000 }) })
  assert.equal(created.status, 201)
  const { id: vehicleId } = await created.json()
  assert.equal((await tomas("/api/finance/vehicles", { method: "POST", headers: json, body: JSON.stringify({ name }) })).status, 409)
  const entries = `/api/finance/vehicles/${vehicleId}/entries`
  assert.equal((await tomas(entries, { method: "POST", headers: json, body: JSON.stringify({ type: "log", date: day, purpose: "Prueba", odometerStart: 1200, odometerEnd: 1100 }) })).status, 400)
  assert.equal((await tomas(entries, { method: "POST", headers: json, body: JSON.stringify({ type: "service", date: day, description: "Cambio de aceite", cost: 500, odometer: 1500 }) })).status, 201)
  assert.equal((await tomas(entries, { method: "POST", headers: json, body: JSON.stringify({ type: "fuel", date: day, liters: 30, cost: 700, odometer: 1800 }) })).status, 201)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  assert.equal((await tomas(entries, { method: "POST", headers: json, body: JSON.stringify({ type: "document", kind: "insurance", expiresAt: tomorrow }) })).status, 201)
  const detail = (await (await tomas(`/api/finance/vehicles/${vehicleId}`)).json()).vehicle
  assert.equal(detail.vehicle.odometer, 1800) // solo sube
  assert.equal(detail.totals.all, 1200)
  assert.equal(detail.documents[0].status, "soon")
  const list = (await (await tomas("/api/finance/vehicles")).json()).vehicles.find((v) => v.id === vehicleId)
  assert.ok(list.alerts.some((a) => a.status === "soon"))
  const expenses = (await (await tomas(`/api/finance/expenses?month=${day.slice(0, 7)}`)).json()).expenses
  assert.ok(expenses.some((e) => e.vehicleName === name && e.amount === 500))
  // Al quitar el servicio se quita su gasto.
  const svc = detail.services[0]
  assert.equal((await tomas(`${entries}?kind=service&id=${svc.id}`, { method: "DELETE" })).status, 200)
  const expenses2 = (await (await tomas(`/api/finance/expenses?month=${day.slice(0, 7)}`)).json()).expenses
  assert.ok(!expenses2.some((e) => e.vehicleName === name && e.amount === 500))

  // Nómina: se configura el pago, se arma el periodo, se captura, se cierra, se paga una vez y genera su gasto.
  const payrollApi = (who, body) => who("/api/payroll", { method: "POST", headers: json, body: JSON.stringify(body) })
  assert.equal((await sofia("/api/payroll")).status, 403)
  assert.equal((await payrollApi(sofia, { action: "period.create", startDate: day, endDate: day })).status, 403)
  const ws = await (await tomas("/api/payroll")).json()
  assert.ok(ws.employees.length >= 1)
  const emp = ws.employees[0]
  assert.equal((await payrollApi(tomas, { action: "employee.pay", id: emp.id, salaryType: "monthly", salaryAmount: 9000, paymentFrequency: "monthly" })).status, 200)
  assert.equal((await payrollApi(tomas, { action: "period.create", startDate: "2026-02-30", endDate: day })).status, 400)
  const created = await payrollApi(tomas, { action: "period.create", startDate: day, endDate: day, employeeIds: [emp.id] })
  assert.equal(created.status, 201)
  const { id: runId } = await created.json()
  let period = (await (await tomas(`/api/payroll?periodId=${runId}`)).json()).period
  assert.equal(period.status, "draft")
  const entry = period.entries[0]
  assert.equal((await payrollApi(tomas, { action: "entry.update", id: entry.id, overtimeHours: 2, perceptions: [{ name: "Bono", calc: "fixed", value: 100 }], deductions: [{ name: "Adelanto", calc: "fixed", value: 40 }] })).status, 200)
  period = (await (await tomas(`/api/payroll?periodId=${runId}`)).json()).period
  const adjusted = period.entries[0]
  assert.equal(adjusted.netPay, Math.round((adjusted.grossPay - 40) * 100) / 100)
  assert.ok(adjusted.overtimePay > 0)
  // Pagar exige cerrar primero; cerrada ya no se edita; pagada no se reabre ni se elimina.
  assert.equal((await payrollApi(tomas, { action: "entry.paid", id: entry.id })).status, 409)
  assert.equal((await payrollApi(tomas, { action: "period.status", id: runId, status: "closed" })).status, 200)
  assert.equal((await payrollApi(tomas, { action: "entry.update", id: entry.id, absences: 1 })).status, 409)
  assert.equal((await payrollApi(tomas, { action: "period.delete", id: runId })).status, 409)
  assert.equal((await payrollApi(tomas, { action: "period.status", id: runId, status: "paid" })).status, 200)
  assert.equal((await payrollApi(tomas, { action: "period.status", id: runId, status: "draft" })).status, 409)
  const payExpenses = (await (await tomas(`/api/finance/expenses?month=${day.slice(0, 7)}`)).json()).expenses.filter((e) => e.isPayroll && e.amount === adjusted.netPay)
  assert.equal(payExpenses.length >= 1, true)
})

test("portal del creyente: contenido, transmisiones, perfil propio y solicitudes de ministerio", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const lupita = await login("demo.celula@comuapp.test")
  const stamp = Date.now()

  // Solo quien administra el contenido publica; todos ven el feed.
  assert.equal((await carlos("/api/portal/posts?manage=1")).status, 403)
  assert.equal((await carlos("/api/portal/posts", { method: "POST", headers: json, body: JSON.stringify({ title: "x", body: "y" }) })).status, 403)
  assert.equal((await owner("/api/portal/posts", { method: "POST", headers: json, body: JSON.stringify({ title: "", body: "y" }) })).status, 400)
  const created = await owner("/api/portal/posts", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: "Aviso " + stamp, body: "Mira https://example.com", kind: "announcement", pinned: true }),
  })
  assert.equal(created.status, 201)
  const { id: postId } = await created.json()
  const feed = (await (await carlos("/api/portal/posts")).json()).posts
  assert.ok(feed.some((p) => p.id === postId))
  // Lo dirigido a líderes no lo ve un creyente común.
  const leadersOnly = await owner("/api/portal/posts", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: "Líderes " + stamp, body: "Solo líderes", audience: "leaders" }),
  })
  const { id: leadersPostId } = await leadersOnly.json()
  assert.ok(!(await (await carlos("/api/portal/posts")).json()).posts.some((p) => p.id === leadersPostId))
  // Un borrador no aparece en el feed.
  assert.equal((await owner(`/api/portal/posts/${postId}`, { method: "PATCH", headers: json, body: JSON.stringify({ isPublished: false }) })).status, 200)
  assert.ok(!(await (await carlos("/api/portal/posts")).json()).posts.some((p) => p.id === postId))
  assert.equal((await carlos(`/api/portal/posts/${postId}`, { method: "DELETE" })).status, 403)
  assert.equal((await owner(`/api/portal/posts/${postId}`, { method: "DELETE" })).status, 200)
  assert.equal((await owner(`/api/portal/posts/${leadersPostId}`, { method: "DELETE" })).status, 200)

  // Transmisiones: solo enlaces https de YouTube o Facebook; se normalizan.
  const badStream = await owner("/api/portal/streams", { method: "POST", headers: json, body: JSON.stringify({ title: "Mala", url: "https://evil.example/video" }) })
  assert.equal(badStream.status, 400)
  const stream = await owner("/api/portal/streams", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ title: "Directo " + stamp, url: "https://youtu.be/dQw4w9WgXcQ?t=5", status: "live" }),
  })
  assert.equal(stream.status, 201)
  const { id: streamId } = await stream.json()
  const seen = (await (await carlos("/api/portal/streams")).json()).streams.find((s) => s.id === streamId)
  assert.equal(seen.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")
  assert.equal(seen.status, "live")
  assert.equal((await carlos("/api/portal/streams?manage=1")).status, 403)
  const home = (await (await carlos("/api/portal/home")).json()).home
  assert.equal(home.live?.id, streamId)
  assert.equal((await carlos(`/api/portal/streams/${streamId}`, { method: "DELETE" })).status, 403)
  assert.equal((await owner(`/api/portal/streams/${streamId}`, { method: "DELETE" })).status, 200)

  // Perfil: edita sus datos de contacto, nunca los que administra la iglesia.
  const before = (await (await carlos("/api/portal/profile")).json()).profile
  assert.ok(before?.memberId)
  assert.equal((await carlos("/api/portal/profile", { method: "PUT", headers: json, body: JSON.stringify({ phone: "no es teléfono" }) })).status, 400)
  assert.equal((await carlos("/api/portal/profile", { method: "PUT", headers: json, body: JSON.stringify({ email: "malo" }) })).status, 400)
  assert.equal((await carlos("/api/portal/profile", { method: "PUT", headers: json, body: JSON.stringify({ birthDate: "2999-01-01" }) })).status, 400)
  const ok = await carlos("/api/portal/profile", {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ occupation: "Docente " + stamp, visionStage: "discipleship", hierarchy: "pastor", fullName: "Otro Nombre" }),
  })
  assert.equal(ok.status, 200)
  const after = (await (await carlos("/api/portal/profile")).json()).profile
  assert.equal(after.occupation, "Docente " + stamp)
  assert.equal(after.fullName, before.fullName) // el nombre no se edita aquí
  const row = (await (await owner(`/api/crud/members/${before.memberId}`)).json()).row
  assert.notEqual(row.visionStage, "discipleship") // la etapa tampoco
  assert.notEqual(row.hierarchy, "pastor")

  // Servir en un ministerio: el creyente pide, su líder decide, y solo una vez.
  // Se usa un ministerio de prueba propio para no alterar la pertenencia de los demás casos.
  const madeMinistry = await owner("/api/crud/ministries", { method: "POST", headers: json, body: JSON.stringify({ name: `Prueba servir ${stamp}` }) })
  assert.equal(madeMinistry.status, 201)
  const madeId = (await madeMinistry.json()).row.id
  const catalog = (await (await carlos("/api/portal/ministries")).json()).ministries
  const target = catalog.find((m) => m.id === madeId)
  assert.equal(target?.state, "none")
  const asked = await carlos("/api/portal/ministries", { method: "POST", headers: json, body: JSON.stringify({ ministryId: target.id, message: "Quiero servir" }) })
  assert.equal(asked.status, 201)
  const { id: requestId } = await asked.json()
  assert.equal((await carlos("/api/portal/ministries", { method: "POST", headers: json, body: JSON.stringify({ ministryId: target.id }) })).status, 409)
  assert.equal((await carlos("/api/portal/join-requests")).status, 200)
  assert.equal((await (await carlos("/api/portal/join-requests")).json()).requests.some((r) => r.id === requestId), false) // no es líder
  assert.equal((await carlos(`/api/portal/join-requests/${requestId}`, { method: "POST", headers: json, body: JSON.stringify({ decision: "approve" }) })).status, 404)
  const pending = (await (await owner("/api/portal/join-requests")).json()).requests
  assert.ok(pending.some((r) => r.id === requestId))
  assert.equal((await owner(`/api/portal/join-requests/${requestId}`, { method: "POST", headers: json, body: JSON.stringify({ decision: "maybe" }) })).status, 400)
  assert.equal((await owner(`/api/portal/join-requests/${requestId}`, { method: "POST", headers: json, body: JSON.stringify({ decision: "approve" }) })).status, 200)
  assert.equal((await owner(`/api/portal/join-requests/${requestId}`, { method: "POST", headers: json, body: JSON.stringify({ decision: "approve" }) })).status, 409)
  const mineNow = (await (await carlos("/api/portal/ministries")).json()).ministries.find((m) => m.id === target.id)
  assert.equal(mineNow.state, "member")
  void lupita
})

test("camino en la visión: bautismo, encuentro y lanzamiento se marcan al finalizar, con asistencia verificada", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const profile = (await (await carlos("/api/portal/profile")).json()).profile
  const memberId = profile.memberId
  const stamp = Date.now()

  const create = async (kind) => {
    const r = await owner("/api/events", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: `${kind} ${stamp}`, scope: "internal", kind, startsAt: new Date(Date.now() + 5 * 86400000).toISOString(), audience: "open" }),
    })
    assert.equal(r.status, 201)
    return (await r.json()).id
  }

  // Evento de bautizo: nace con su lista de pendientes y no admite a quien ya se bautizó.
  const baptismId = await create("Bautismo en aguas")
  const detail = (await (await owner(`/api/events/${baptismId}`)).json()).event
  assert.ok(detail.checklist.length >= 5)
  const before = (await (await owner(`/api/crud/members/${memberId}`)).json()).row
  const wasBaptized = Boolean(before.baptizedWater)

  const ticket = await owner(`/api/events/${baptismId}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ memberId }) })
  if (wasBaptized) {
    assert.equal(ticket.status, 409) // ya bautizado: no tiene sentido registrarlo
    return
  }
  assert.equal(ticket.status, 201)
  const { id: ticketId } = await ticket.json()
  assert.equal((await owner(`/api/events/${baptismId}/groups`)).status, 200)

  // Sin entrada registrada no se marca.
  const none = await (await owner(`/api/events/${baptismId}/finish`, { method: "POST" })).json()
  assert.equal(none.growth.check, "baptism")
  assert.equal(none.growth.marked.length, 0)
  assert.equal(none.growth.absent >= 1, true)
  assert.equal((await (await owner(`/api/crud/members/${memberId}`)).json()).row.baptizedWater, false)

  // Con la entrada registrada y al finalizar, queda marcado; repetir no duplica.
  assert.equal((await owner(`/api/events/${baptismId}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ ticketId }) })).status, 200)
  const done = await (await owner(`/api/events/${baptismId}/finish`, { method: "POST" })).json()
  assert.ok(done.growth.marked.some((m) => m.memberId === memberId))
  const after = (await (await owner(`/api/crud/members/${memberId}`)).json()).row
  assert.equal(after.baptizedWater, true)
  const again = await (await owner(`/api/events/${baptismId}/finish`, { method: "POST" })).json()
  assert.equal(again.growth.marked.length, 0)
  assert.ok(again.growth.already >= 1)
  // La entrada de un Encuentro por sí sola no sube la etapa: falta finalizar.
  const encId = await create("Encuentro con Jesús")
  const t2 = await owner(`/api/events/${encId}/tickets`, { method: "POST", headers: json, body: JSON.stringify({ memberId }) })
  assert.equal(t2.status, 201)
  const { id: t2id } = await t2.json()
  assert.equal((await owner(`/api/events/${encId}/check-in`, { method: "POST", headers: json, body: JSON.stringify({ ticketId: t2id }) })).status, 200)
  const stageNow = (await (await owner(`/api/crud/members/${memberId}`)).json()).row
  assert.equal(stageNow.encounterAt ?? null, null)
  await owner(`/api/events/${encId}/finish`, { method: "POST" })
  const stageAfter = (await (await owner(`/api/crud/members/${memberId}`)).json()).row
  assert.ok(stageAfter.encounterAt)
})

test("consolidación: la dirección con ubicación canaliza a la célula más cercana", async () => {
  const { ids } = await ministryIds()
  const cid = ids["Consolidación"]
  const lupita = await login("demo.celula@comuapp.test")
  const owner = await login("demo.owner@comuapp.test")
  const stamp = Date.now()
  const phone = `81${String(stamp).slice(-8)}`

  // Dos células con ubicación: una cerca de la persona y otra lejos.
  const mk = async (name, lat, lon) => {
    const r = await owner("/api/cells", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: `${name} ${stamp}`, dayOfWeek: 3, startTime: "19:30", street: "Calle de prueba 100", latitude: lat, longitude: lon }),
    })
    assert.equal(r.status, 201)
    return (await r.json()).id
  }
  // Punto distinto en cada corrida: las células de corridas previas no estorban.
  const lat0 = 18 + Math.random() * 10
  const lon0 = -110 + Math.random() * 10
  const near = await mk("Cerca", lat0 + 0.001, lon0 + 0.001)
  await mk("Lejos", lat0 + 0.3, lon0 + 0.3)

  const created = await lupita(`/api/consolidation/${cid}/cases`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ fullName: `Vecino ${stamp}`, phone, address: "Av. Juárez 120, Centro, Torreón", latitude: lat0, longitude: lon0 }),
  })
  assert.equal(created.status, 201)
  const { id: caseId } = await created.json()
  const detail = (await (await lupita(`/api/consolidation/cases/${caseId}`)).json()).case
  assert.equal(detail.person.street, "Av. Juárez 120, Centro, Torreón")
  assert.equal(Math.round(detail.person.latitude * 1000), Math.round(lat0 * 1000))

  const nearby = (await (await lupita(`/api/consolidation/cases/${caseId}/nearest-cells`)).json()).nearby
  assert.equal(nearby.hasLocation, true)
  // Ordenadas de la más cercana a la más lejana (corridas previas dejan células en el mismo punto).
  const dist = nearby.cells.map((x) => x.distanceKm)
  assert.deepEqual(dist, [...dist].sort((x, y) => x - y))
  const mine = nearby.cells.find((x) => x.id === near)
  assert.ok(mine && mine.distanceKm <= 0.2, JSON.stringify({ near, mine, nearby: nearby.cells.map((x) => [x.id, x.distanceKm]) }))
  assert.ok(nearby.cells[0].distanceKm <= mine.distanceKm)

  // Un caso sin ubicación no sugiere nada.
  const noLoc = await lupita(`/api/consolidation/${cid}/cases`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ fullName: `Sin mapa ${stamp}`, phone: `82${String(stamp).slice(-8)}` }),
  })
  const { id: noLocId } = await noLoc.json()
  assert.equal((await (await lupita(`/api/consolidation/cases/${noLocId}/nearest-cells`)).json()).nearby.hasLocation, false)

  // Canalizar: queda en la célula y el caso se cierra como canalizado a célula.
  assert.equal((await lupita(`/api/consolidation/cases/${caseId}/channel`, { method: "POST", headers: json, body: JSON.stringify({}) })).status, 400)
  assert.equal((await lupita(`/api/consolidation/cases/${caseId}/channel`, { method: "POST", headers: json, body: JSON.stringify({ cellId: near }) })).status, 200)
  const closed = (await (await lupita(`/api/consolidation/cases/${caseId}`)).json()).case
  assert.equal(closed.status, "channeled")
  assert.equal(closed.outcome, "cell")
})

test("reportes: cada quien ve los de sus módulos y se exportan a PDF y CSV", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const sofia = await login("demo.secretaria@comuapp.test")

  assert.equal((await carlos("/api/reports/attendance")).status, 403)
  assert.deepEqual((await (await carlos("/api/reports")).json()).reports, [])
  const all = (await (await owner("/api/reports")).json()).reports.map((r) => r.id)
  for (const id of ["attendance", "service", "vision", "cells", "school", "events", "kids", "consolidation", "finance"]) assert.ok(all.includes(id), id)
  // La secretaría no tiene finanzas.
  assert.equal((await sofia("/api/reports/finance")).status, 403)
  assert.equal((await owner("/api/reports/no-existe")).status, 404)

  const year = new Date().getFullYear()
  const q = `from=${year}-01-01&to=${year}-12-31`
  for (const id of all) {
    const json1 = await owner(`/api/reports/${id}?${q}`)
    assert.equal(json1.status, 200, id)
    const body = await json1.json()
    assert.ok(body.report.sections.length >= 1)
    const pdf = await owner(`/api/reports/${id}?${q}&format=pdf`)
    assert.equal(pdf.status, 200, id)
    assert.equal(pdf.headers.get("content-type"), "application/pdf")
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-")
  }
  const csv = await owner(`/api/reports/attendance?${q}&format=csv`)
  assert.equal(csv.status, 200)
  assert.ok((await csv.text()).includes("Asistencia a reuniones"))
})

test("pagos en línea: la iglesia conecta su pasarela y solo un webhook firmado confirma el cobro", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const stamp = Date.now()

  // Solo quien administra finanzas configura; las llaves no se devuelven nunca.
  assert.equal((await carlos("/api/finance/gateway")).status, 403)
  assert.equal((await carlos("/api/finance/gateway", { method: "PUT", headers: json, body: JSON.stringify({ provider: "stripe", secretKey: "sk_test_x" }) })).status, 403)
  assert.equal((await owner("/api/finance/gateway", { method: "PUT", headers: json, body: JSON.stringify({ provider: "stripe", secretKey: "no-es-llave" }) })).status, 400)
  assert.equal((await owner("/api/finance/gateway", { method: "PUT", headers: json, body: JSON.stringify({ provider: "paypal", secretKey: "x" }) })).status, 400)
  const secret = `whsec_prueba_${stamp}`
  // No se activa sin el secreto del webhook (no habría forma de confirmar cobros).
  assert.equal(
    (await owner("/api/finance/gateway", { method: "PUT", headers: json, body: JSON.stringify({ provider: "mercadopago", secretKey: "TEST-0000-prueba", isActive: true }) })).status,
    409
  )
  const saved = await owner("/api/finance/gateway", {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ provider: "stripe", secretKey: "sk_test_prueba123", webhookSecret: secret, isActive: true }),
  })
  assert.equal(saved.status, 200)
  const listing = await (await owner("/api/finance/gateway")).text()
  assert.ok(!listing.includes("sk_test_prueba123") && !listing.includes(secret))
  const gw = JSON.parse(listing).gateways.find((g) => g.provider === "stripe")
  assert.equal(gw.isActive, true)
  assert.equal(gw.hasSecret && gw.hasWebhookSecret, true)
  const orgId = new URL(gw.webhookUrl).searchParams.get("org")
  assert.ok(orgId)

  // El creyente ve el medio de pago disponible.
  const info = (await (await carlos("/api/finance/donations/info")).json()).info
  assert.ok(info.online.includes("stripe"))
  // Monto inválido y pasarela caída (llave de prueba falsa): no deja cobros colgados.
  assert.equal((await carlos("/api/finance/donations/checkout", { method: "POST", headers: json, body: JSON.stringify({ provider: "stripe", amount: 5 }) })).status, 400)
  assert.equal((await carlos("/api/finance/donations/checkout", { method: "POST", headers: json, body: JSON.stringify({ provider: "mercadopago", amount: 100 }) })).status, 409)
  const checkout = await carlos("/api/finance/donations/checkout", { method: "POST", headers: json, body: JSON.stringify({ provider: "stripe", amount: 100 }) })
  assert.ok([502].includes(checkout.status))

  // Webhook: sin firma o con firma ajena se rechaza; org desconocida no existe.
  const url = `/api/finance/donations/webhook/stripe?org=${orgId}`
  const sessionId = `cs_test_${stamp}`
  const event = JSON.stringify({
    id: `evt_${stamp}`,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, payment_status: "paid", amount_total: 123456, currency: "mxn", customer_details: { email: "donante@example.com", name: "Donante Prueba" } } },
  })
  const sign = (body, key = secret) => {
    const t = Math.floor(Date.now() / 1000)
    return `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`
  }
  assert.equal((await fetch(`${BASE}${url}`, { method: "POST", body: event })).status, 400)
  assert.equal((await fetch(`${BASE}${url}`, { method: "POST", body: event, headers: { "stripe-signature": sign(event, "whsec_ajeno") } })).status, 400)
  assert.equal((await fetch(`${BASE}/api/finance/donations/webhook/stripe?org=no-existe`, { method: "POST", body: event, headers: { "stripe-signature": sign(event) } })).status, 404)
  assert.equal((await fetch(`${BASE}/api/finance/donations/webhook/paypal?org=${orgId}`, { method: "POST", body: event })).status, 404)

  // Sesión sin pagar: se ignora. Pagada: se registra una sola vez como ingreso en línea.
  const unpaid = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: `cs_u_${stamp}`, payment_status: "unpaid", amount_total: 5000 } } })
  const ign = await fetch(`${BASE}${url}`, { method: "POST", body: unpaid, headers: { "stripe-signature": sign(unpaid) } })
  assert.equal(ign.status, 200)
  assert.equal((await ign.json()).ignored, true)
  const ok1 = await fetch(`${BASE}${url}`, { method: "POST", body: event, headers: { "stripe-signature": sign(event) } })
  assert.equal(ok1.status, 200)
  assert.equal((await ok1.json()).result, "paid")
  const ok2 = await fetch(`${BASE}${url}`, { method: "POST", body: event, headers: { "stripe-signature": sign(event) } })
  assert.equal((await ok2.json()).result, "duplicate")
  const month = new Date().toISOString().slice(0, 7)
  const incomes = (await (await owner(`/api/finance/incomes?month=${month}`)).json()).incomes
  const mine = incomes.filter((i) => i.amount === 1234.56 && i.source === "online")
  assert.ok(mine.length >= 1)
  assert.equal(mine.filter((i) => i.reference === sessionId).length, 1) // no se duplicó

  // Los pagos en línea no se confirman a mano.
  const pending = (await (await owner("/api/finance/donations?status=pending")).json()).donations.find((d) => d.provider === "stripe")
  if (pending) assert.equal((await owner(`/api/finance/donations/${pending.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ decision: "confirm" }) })).status, 409)

  // Se deja desactivada para no afectar otras corridas.
  assert.equal((await owner("/api/finance/gateway", { method: "PUT", headers: json, body: JSON.stringify({ provider: "stripe", isActive: false }) })).status, 200)
  assert.equal((await fetch(`${BASE}${url}`, { method: "POST", body: event, headers: { "stripe-signature": sign(event) } })).status, 404)
})

test("notificaciones: el creyente recibe sus avisos; el aviso de publicación llega a su bandeja", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const stamp = Date.now()
  // El creyente (portal) ya tiene bandeja propia.
  assert.equal((await carlos("/api/notifications")).status, 200)
  assert.equal((await carlos("/api/notifications/read-all", { method: "POST" })).status, 200)

  const title = `Aviso de prueba ${stamp}`
  const created = await owner("/api/portal/posts", { method: "POST", headers: json, body: JSON.stringify({ title, body: "Cuerpo", kind: "announcement" }) })
  assert.equal(created.status, 201)
  const { id } = await created.json()
  let found = null
  for (let i = 0; i < 15 && !found; i++) {
    const rows = (await (await carlos("/api/notifications?pageSize=50")).json()).rows
    found = rows.find((n) => n.title.includes(title)) ?? null
    if (!found) await new Promise((r) => setTimeout(r, 200))
  }
  assert.ok(found, "debe llegar la notificación de la publicación")
  assert.equal(found.read, false)
  assert.equal((await carlos(`/api/notifications/${found.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ read: true }) })).status, 200)
  // La publicación dirigida a líderes no le llega a un creyente común.
  const leadersTitle = `Solo líderes ${stamp}`
  await owner("/api/portal/posts", { method: "POST", headers: json, body: JSON.stringify({ title: leadersTitle, body: "x", audience: "leaders" }) })
  await new Promise((r) => setTimeout(r, 800))
  const rows2 = (await (await carlos("/api/notifications?pageSize=50")).json()).rows
  assert.ok(!rows2.some((n) => n.title.includes(leadersTitle)))
  // Prueba de notificación a uno mismo.
  const t = await (await carlos("/api/push/test", { method: "POST" })).json()
  assert.equal(t.ok, true)
  await owner(`/api/portal/posts/${id}`, { method: "DELETE" })
})

test("reportes programados: se configuran, se pausan y no se envían sin correo configurado", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const sofia = await login("demo.secretaria@comuapp.test")

  assert.equal((await carlos("/api/reports/schedules")).status, 403)
  assert.equal((await carlos("/api/reports/schedules", { method: "POST", headers: json, body: JSON.stringify({ reportId: "attendance", frequency: "weekly", recipients: "a@b.mx" }) })).status, 403)
  // La secretaría solo puede programar los reportes a los que ya tiene acceso.
  assert.equal((await sofia("/api/reports/schedules", { method: "POST", headers: json, body: JSON.stringify({ reportId: "finance", frequency: "weekly", recipients: "a@b.mx" }) })).status, 403)

  const post = (body) => owner("/api/reports/schedules", { method: "POST", headers: json, body: JSON.stringify(body) })
  assert.equal((await post({ reportId: "attendance", frequency: "weekly", recipients: "no-es-correo" })).status, 400)
  assert.equal((await post({ reportId: "attendance", frequency: "weekly", recipients: "" })).status, 400)
  assert.equal((await post({ reportId: "attendance", frequency: "daily", recipients: "a@b.mx" })).status, 400)
  assert.equal((await post({ reportId: "inexistente", frequency: "weekly", recipients: "a@b.mx" })).status, 403)

  const created = await post({ reportId: "attendance", frequency: "weekly", dayOfWeek: 1, hour: 8, recipients: "pastor@example.com, tesoreria@example.com", includeCsv: true })
  assert.equal(created.status, 201)
  const { id } = await created.json()
  let list = (await (await owner("/api/reports/schedules")).json()).schedules
  let mine = list.find((s) => s.id === id)
  assert.deepEqual(mine.recipients, ["pastor@example.com", "tesoreria@example.com"])
  assert.equal(mine.isActive, true)
  assert.ok(new Date(mine.nextRunAt).getTime() > Date.now())
  assert.equal(mine.label, "Cada lunes a las 08:00")

  // Pausar quita el siguiente envío; reactivar lo vuelve a calcular.
  assert.equal((await owner(`/api/reports/schedules/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ isActive: false }) })).status, 200)
  mine = (await (await owner("/api/reports/schedules")).json()).schedules.find((s) => s.id === id)
  assert.equal(mine.nextRunAt, null)
  assert.equal((await owner(`/api/reports/schedules/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ isActive: true, frequency: "monthly", dayOfMonth: 3 }) })).status, 200)
  mine = (await (await owner("/api/reports/schedules")).json()).schedules.find((s) => s.id === id)
  assert.equal(mine.frequency, "monthly")
  assert.ok(mine.nextRunAt)

  // «Enviar ahora»: sin SMTP en el servidor de pruebas se informa con claridad y queda registrado.
  const run = await owner(`/api/reports/schedules/${id}/run`, { method: "POST" })
  assert.ok([200, 502].includes(run.status))
  mine = (await (await owner("/api/reports/schedules")).json()).schedules.find((s) => s.id === id)
  assert.ok(["sent", "error"].includes(mine.lastStatus))
  if (run.status === 502) assert.match(mine.lastError, /SMTP|correo/i)

  // El cron externo exige su secreto.
  const cron = await fetch(`${BASE}/api/cron/reports`, { method: "POST" })
  assert.ok([401, 503].includes(cron.status))
  const bad = await fetch(`${BASE}/api/cron/reports`, { method: "POST", headers: { authorization: "Bearer incorrecto" } })
  assert.ok([401, 503].includes(bad.status))

  assert.equal((await carlos(`/api/reports/schedules/${id}`, { method: "DELETE" })).status, 403)
  assert.equal((await owner(`/api/reports/schedules/${id}`, { method: "DELETE" })).status, 200)
  list = (await (await owner("/api/reports/schedules")).json()).schedules
  assert.ok(!list.some((s) => s.id === id))
})

test("reportes comparativos: periodo anterior, mismo periodo del año pasado y sin comparar", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const year = new Date().getFullYear()
  const base = `from=${year}-03-01&to=${year}-03-31`
  const ids = (await (await owner("/api/reports")).json()).reports.map((r) => r.id)

  for (const id of ids) {
    const prev = (await (await owner(`/api/reports/${id}?${base}&compare=previous`)).json()).report
    assert.ok(prev.comparedWith, id)
    assert.deepEqual(prev.comparedWith.period, { from: `${year}-02-01`, to: `${year}-02-${year % 4 === 0 ? 29 : 28}` })
    assert.ok(prev.sections[0].title.startsWith("Comparativo"), id)
    assert.ok(prev.charts.some((c) => c.id.startsWith("compare-")), id)
    const cols = prev.sections[0].columns.map((c) => c.key)
    assert.deepEqual(cols, ["metric", "current", "previous", "change"])

    const ly = (await (await owner(`/api/reports/${id}?${base}&compare=year`)).json()).report
    assert.deepEqual(ly.comparedWith.period, { from: `${year - 1}-03-01`, to: `${year - 1}-03-31` })

    const none = (await (await owner(`/api/reports/${id}?${base}`)).json()).report
    assert.equal(none.comparedWith ?? null, null)
    assert.ok(!none.sections[0].title.startsWith("Comparativo"))

    // El PDF con comparativo se genera.
    const pdf = await owner(`/api/reports/${id}?${base}&compare=previous&format=pdf`)
    assert.equal(pdf.status, 200)
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-")
  }
  // Un valor inválido se trata como «sin comparar».
  const weird = (await (await owner(`/api/reports/attendance?${base}&compare=lo-que-sea`)).json()).report
  assert.equal(weird.comparedWith ?? null, null)
})

test("conciliación bancaria: importar, sugerir, conciliar, registrar lo que falta y no duplicar", async () => {
  const tomas = await login("demo.tesorero@comuapp.test") // finanzas
  const sofia = await login("demo.secretaria@comuapp.test") // sin finanzas
  const carlos = await login("demo.creyente@comuapp.test")
  const stamp = Date.now()
  const day = new Date().toISOString().slice(0, 10)
  const [y, m, d] = day.split("-")
  const bankDate = `${d}/${m}/${y}`
  // Importes únicos por corrida para no chocar con otros movimientos.
  const dep = 1000 + (stamp % 9000) + 0.37
  const ret = 500 + (stamp % 4000) + 0.19
  const extra = 77 + (stamp % 900) + 0.55

  assert.equal((await sofia("/api/finance/bank")).status, 403)
  assert.equal((await carlos("/api/finance/bank")).status, 403)

  // Ingreso y gasto ya registrados en el sistema.
  const cut = await tomas("/api/finance/incomes/cut", { method: "POST", headers: json, body: JSON.stringify({ date: day, tithes: dep }) })
  assert.equal(cut.status, 201)
  const exp = await tomas("/api/finance/expenses", { method: "POST", headers: json, body: JSON.stringify({ concept: `Luz prueba ${stamp}`, amount: ret, spentAt: day, category: "servicios" }) })
  assert.equal(exp.status, 201)

  const csv = [
    "Fecha,Descripción,Cargo,Abono,Saldo",
    `${bankDate},DEPOSITO EFECTIVO ${stamp},,${dep.toFixed(2)},`,
    `${bankDate},PAGO CFE ${stamp},${ret.toFixed(2)},,`,
    `${bankDate},COMISION BANCARIA ${stamp},${extra.toFixed(2)},,`,
  ].join("\n")

  // Vista previa y archivo inválido.
  assert.equal((await tomas("/api/finance/bank", { method: "POST", headers: json, body: JSON.stringify({ csv: "a,b\n1,2", preview: true }) })).status, 400)
  const pv = await (await tomas("/api/finance/bank", { method: "POST", headers: json, body: JSON.stringify({ csv, preview: true }) })).json()
  assert.equal(pv.preview.lines, 3)
  assert.equal(pv.preview.withdrawals, Math.round((ret + extra) * 100) / 100)

  const imp = await tomas("/api/finance/bank", { method: "POST", headers: json, body: JSON.stringify({ csv, label: `Prueba ${stamp}`, fileName: "estado.csv" }) })
  assert.equal(imp.status, 201)
  const { id, imported } = await imp.json()
  assert.equal(imported, 3)
  // Reimportar el mismo archivo no duplica nada.
  assert.equal((await tomas("/api/finance/bank", { method: "POST", headers: json, body: JSON.stringify({ csv }) })).status, 409)

  let st = await (await tomas(`/api/finance/bank/${id}`)).json()
  assert.equal(st.summary.pending, 3)
  const lineDep = st.lines.find((l) => l.description.startsWith("DEPOSITO"))
  const lineRet = st.lines.find((l) => l.description.startsWith("PAGO CFE"))
  const lineFee = st.lines.find((l) => l.description.startsWith("COMISION"))
  assert.equal(lineDep.candidates[0]?.kind, "income")
  assert.equal(lineRet.candidates[0]?.kind, "expense")
  assert.equal(lineFee.candidates.length, 0)

  // Reglas de conciliación manual: sentido, permiso y no repetir.
  const post = (lineId, body, who = tomas) => who(`/api/finance/bank/lines/${lineId}`, { method: "POST", headers: json, body: JSON.stringify(body) })
  assert.equal((await post(lineDep.id, { action: "match", kind: "expense", id: lineRet.candidates[0].id })).status, 409)
  assert.equal((await post(lineDep.id, { action: "match", kind: "income", id: lineDep.candidates[0].id }, sofia)).status, 403)
  assert.equal((await post(lineDep.id, { action: "match", kind: "income", id: lineDep.candidates[0].id })).status, 200)
  assert.equal((await post(lineDep.id, { action: "match", kind: "income", id: lineDep.candidates[0].id })).status, 409)

  // Lo claro se concilia solo; lo que no existe se registra desde el banco.
  const auto = await (await tomas(`/api/finance/bank/${id}`, { method: "POST" })).json()
  assert.equal(auto.matched, 1)
  const created = await post(lineFee.id, { action: "create", category: "otro", concept: `Comisión ${stamp}` })
  assert.equal(created.status, 201)
  st = await (await tomas(`/api/finance/bank/${id}`)).json()
  assert.equal(st.summary.pending, 0)
  assert.equal(st.summary.matched, 3)
  assert.equal(st.lines.find((l) => l.id === lineFee.id).match.kind, "expense")

  // Se puede deshacer, ignorar y volver a considerar.
  assert.equal((await post(lineDep.id, { action: "unmatch" })).status, 200)
  assert.equal((await post(lineDep.id, { action: "ignore" })).status, 200)
  assert.equal((await post(lineRet.id, { action: "ignore" })).status, 409) // conciliado: primero se quita
  assert.equal((await post(lineDep.id, { action: "restore" })).status, 200)
  assert.equal((await post(lineDep.id, { action: "nada" })).status, 400)

  // Eliminar el estado de cuenta no toca ingresos ni gastos.
  assert.equal((await tomas(`/api/finance/bank/${id}`, { method: "DELETE" })).status, 200)
  assert.equal((await tomas(`/api/finance/bank/${id}`)).status, 404)
  const expenses = (await (await tomas(`/api/finance/expenses?month=${day.slice(0, 7)}`)).json()).expenses
  assert.ok(expenses.some((e) => e.concept === `Luz prueba ${stamp}`))
})

test("servicio en reuniones generales: el líder pasa lista de sus servidores; el servidor solo ve", async () => {
  const { owner, ids } = await ministryIds()
  const lupita = await login("demo.celula@comuapp.test") // líder de Alabanza
  const carlos = await login("demo.creyente@comuapp.test") // servidor en Alabanza y Ujieres
  const sofia = await login("demo.secretaria@comuapp.test") // apoyo en Alabanza
  const alabanza = ids["Alabanza"]
  const ujieres = ids["Ujieres"]
  const series = (await (await owner("/api/gatherings/series")).json()).series
  const domingo = series.find((x) => x.name === "Domingo 10:00")

  // Reunión en que solo estuvo en servicio Alabanza (un día reciente libre de ese horario).
  let gatheringId = null
  for (let i = 1; i <= 100 && !gatheringId; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const r = await owner("/api/gatherings", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ seriesId: domingo.id, date, topic: "Servicio prueba", counts: { men: 5 }, ministryIds: [alabanza] }),
    })
    if (r.status === 201) gatheringId = (await r.json()).id
  }
  assert.ok(gatheringId, "no se pudo crear la reunión de prueba")

  const url = (m) => `/api/gatherings/${gatheringId}/service?ministryId=${m}`
  // Un ministerio que no estuvo en servicio no tiene lista.
  assert.equal((await lupita(url(ujieres))).status, 409)
  const sheet = (await (await lupita(url(alabanza))).json()).sheet
  assert.equal(sheet.canEdit, true)
  assert.ok(sheet.people.length >= 3)
  assert.equal(sheet.summary.unmarked, sheet.people.length)
  const carlosRow = sheet.people.find((x) => x.fullName.toLowerCase().includes("carlos"))
  assert.ok(carlosRow)

  const put = (who, body) => who(`/api/gatherings/${gatheringId}/service`, { method: "PUT", headers: json, body: JSON.stringify({ ministryId: alabanza, ...body }) })
  // El servidor ve la lista pero no pasa lista.
  const asServant = (await (await carlos(url(alabanza))).json()).sheet
  assert.equal(asServant.canEdit, false)
  assert.equal((await put(carlos, { records: [{ memberId: carlosRow.memberId, status: "present" }] })).status, 403)

  // Validaciones: persona ajena al ministerio y estado inválido.
  assert.equal((await put(lupita, { records: [{ memberId: "no-es-servidor", status: "present" }] })).status, 400)
  assert.equal((await put(lupita, { records: [{ memberId: carlosRow.memberId, status: "tal vez" }] })).status, 400)

  // La líder pasa lista; el apoyo también puede corregirla.
  const records = sheet.people.map((x, i) => ({ memberId: x.memberId, status: i === 0 ? "absent" : i === 1 ? "excused" : "present" }))
  assert.equal((await put(lupita, { records })).status, 200)
  let after = (await (await lupita(url(alabanza))).json()).sheet
  assert.equal(after.summary.absent, 1)
  assert.equal(after.summary.excused, 1)
  assert.equal(after.summary.unmarked, 0)
  assert.equal((await put(sofia, { records: [{ memberId: sheet.people[0].memberId, status: "present" }] })).status, 200)
  // Quitar la marca la deja sin marcar.
  assert.equal((await put(lupita, { records: [{ memberId: sheet.people[1].memberId, status: null }] })).status, 200)
  after = (await (await lupita(url(alabanza))).json()).sheet
  assert.equal(after.summary.unmarked, 1)

  // El ministerio lista sus reuniones con el estado de cada quien.
  const list = await (await carlos(`/api/ministries/${alabanza}/services`)).json()
  assert.equal(list.canEdit, false)
  const row = list.rows.find((r) => r.gatheringId === gatheringId)
  assert.ok(row)
  assert.ok(["present", "absent", "excused", null].includes(row.mine))
  // Y la secretaría ve el reporte.
  const report = (await (await owner(`/api/reports/service?from=${new Date(Date.now() - 101 * 86400000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`)).json()).report
  assert.ok(report.sections[0].rows.some((r) => r.name === "Alabanza" && r.times >= 1))

  // Eliminar la reunión limpia sus listas.
  assert.equal((await owner(`/api/gatherings/${gatheringId}`, { method: "DELETE" })).status, 200)
})

test("servidores para eventos: el organizador pide, el líder asigna, el servidor confirma u ofrece", async () => {
  const { owner, ids } = await ministryIds()
  const lupita = await login("demo.celula@comuapp.test") // líder de Alabanza
  const carlos = await login("demo.creyente@comuapp.test") // servidor
  const sofia = await login("demo.secretaria@comuapp.test") // apoyo (no gestiona)
  const alabanza = ids["Alabanza"]
  const stamp = Date.now()

  const ev = await owner("/api/events", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: `Evento con servidores ${stamp}`, scope: "internal", kind: "Taller", startsAt: new Date(Date.now() + 6 * 86400000).toISOString(), audience: "open" }),
  })
  assert.equal(ev.status, 201)
  const { id: eventId } = await ev.json()
  const staff = (body, who = owner) => who(`/api/events/${eventId}/staff`, { method: "POST", headers: json, body: JSON.stringify(body) })

  // Solo quien organiza pide; los datos se validan.
  assert.equal((await staff({ ministryId: alabanza, quantity: 2 }, carlos)).status, 403)
  assert.equal((await staff({ ministryId: alabanza, quantity: 0 })).status, 400)
  assert.equal((await staff({ ministryId: "no-existe", quantity: 2 })).status, 400)
  const asked = await staff({ ministryId: alabanza, quantity: 2, notes: "Equipo de sonido y plataforma" })
  assert.equal(asked.status, 201)

  // El ministerio ve el pedido; el servidor puede ofrecerse pero no asignar.
  const asServant = await (await carlos(`/api/ministries/${alabanza}/staff-requests`)).json()
  const reqCarlos = asServant.requests.find((r) => r.eventId === eventId)
  assert.ok(reqCarlos)
  assert.equal(reqCarlos.canAssign, false)
  assert.equal(reqCarlos.canOffer, true)
  assert.equal(asServant.roster.length, 0) // el equipo solo lo ve quien asigna
  const requestId = reqCarlos.id
  const act = (who, body) => who(`/api/staff-requests/${requestId}`, { method: "POST", headers: json, body: JSON.stringify(body) })

  const asLeader = await (await lupita(`/api/ministries/${alabanza}/staff-requests`)).json()
  assert.equal(asLeader.canAssign, true)
  const roster = asLeader.roster
  assert.ok(roster.length >= 3)
  const carlosRow = roster.find((p) => p.fullName.toLowerCase().includes("carlos"))
  const sofiaRow = roster.find((p) => p.fullName.toLowerCase().includes("secretar") || p.fullName.toLowerCase().includes("sofía") || p.fullName.toLowerCase().includes("sofia"))
  assert.ok(carlosRow)

  // Asignar: solo el líder, solo gente del ministerio y sin pasarse del pedido.
  assert.equal((await act(carlos, { action: "assign", memberIds: [carlosRow.memberId] })).status, 403)
  assert.equal((await act(lupita, { action: "assign", memberIds: ["no-es-del-ministerio"] })).status, 400)
  const three = roster.slice(0, 3).map((p) => p.memberId)
  assert.equal((await act(lupita, { action: "assign", memberIds: three })).status, 409) // pidieron 2
  assert.equal((await act(lupita, { action: "assign", memberIds: [carlosRow.memberId] })).status, 200)

  // El asignado responde; no puede responder dos veces ni ofrecerse estando asignado.
  let mine = (await (await carlos(`/api/ministries/${alabanza}/staff-requests`)).json()).requests.find((r) => r.id === requestId)
  assert.equal(mine.mine, "assigned")
  assert.equal((await act(carlos, { action: "offer" })).status, 409)
  assert.equal((await act(carlos, { action: "confirm" })).status, 200)
  assert.equal((await act(carlos, { action: "confirm" })).status, 409)
  const agenda = (await (await carlos("/api/portal/home")).json()).home.agenda
  assert.ok(agenda.some((a) => a.kind === "serve" && a.title.includes(`Evento con servidores ${stamp}`)))

  // Un servidor se ofrece y el líder lo acepta: el pedido queda completo.
  assert.equal((await act(sofia, { action: "offer" })).status, 200)
  const offered = (await (await lupita(`/api/ministries/${alabanza}/staff-requests`)).json()).requests.find((r) => r.id === requestId)
  const offer = offered.assignments.find((a) => a.status === "offered")
  assert.ok(offer)
  assert.equal((await act(sofia, { action: "approve", assignmentId: offer.id })).status, 403) // nadie decide su propio ofrecimiento
  assert.equal((await act(lupita, { action: "approve", assignmentId: offer.id })).status, 200)
  const full = (await (await lupita(`/api/ministries/${alabanza}/staff-requests`)).json()).requests.find((r) => r.id === requestId)
  assert.equal(full.confirmed, 2)
  assert.equal(full.remaining, 0)
  assert.equal(sofiaRow === undefined || Boolean(offer.memberId), true)

  // Ya está completo: nadie más puede ofrecerse ni asignarse; el organizador no puede pedir menos de lo asignado.
  assert.equal((await act(lupita, { action: "assign", memberIds: [three[0]] })).status, 409)
  assert.equal((await staff({ ministryId: alabanza, quantity: 1 })).status, 409)
  assert.equal((await staff({ ministryId: alabanza, quantity: 3 })).status, 201) // pedir más sí

  // Quien confirmó puede retirarse; el líder reasigna.
  assert.equal((await act(carlos, { action: "withdraw" })).status, 200)
  const after = (await (await owner(`/api/events/${eventId}/staff`)).json()).requests[0]
  assert.equal(after.quantity, 3)
  assert.equal(after.confirmed, 1)
  assert.equal((await act(lupita, { action: "assign", memberIds: [carlosRow.memberId] })).status, 200)
  assert.equal((await act(carlos, { action: "decline" })).status, 200)
  assert.equal((await act(carlos, { action: "nada" })).status, 400)

  // Un ministerio ajeno no ve el pedido; el organizador lo puede quitar.
  assert.equal((await carlos(`/api/events/${eventId}/staff`)).status, 403)
  assert.equal((await owner(`/api/events/${eventId}/staff/${requestId}`, { method: "DELETE" })).status, 200)
  assert.equal((await act(lupita, { action: "assign", memberIds: [carlosRow.memberId] })).status, 404)
})

test("cara pública: «Soy nuevo» entra a Consolidación, la oración llega al equipo y todo se aísla", async () => {
  const owner = await login("demo.owner@comuapp.test")
  const carlos = await login("demo.creyente@comuapp.test")
  const slug = "comunidad-demo"
  const stamp = Date.now()
  const post = (path, body) => fetch(`${BASE}${path}`, { method: "POST", headers: json, body: JSON.stringify(body) })

  // Encender la página pública (solo quien administra la iglesia).
  const company = (await (await owner("/api/settings/company")).json()).profile
  assert.equal(
    (await carlos("/api/settings/company", { method: "PATCH", headers: json, body: JSON.stringify({ tradeName: "X", publicEnabled: true, publicSlug: slug }) })).status >= 400,
    true
  )
  const on = await owner("/api/settings/company", {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ tradeName: company.tradeName ?? "Comunidad Torreón (demo)", publicEnabled: true, publicSlug: slug, tagline: "Familia es lo que somos" }),
  })
  assert.equal(on.status, 200)
  assert.equal((await owner("/api/settings/company", { method: "PATCH", headers: json, body: JSON.stringify({ tradeName: "Y", publicSlug: "admin" }) })).status >= 400, true) // reservada

  // La página es pública; una dirección desconocida no existe.
  assert.equal((await fetch(`${BASE}/c/${slug}`)).status, 200)
  assert.equal((await fetch(`${BASE}/c/no-existe-${stamp}`)).status, 404)

  // Tarjeta: validaciones, alta, duplicado y campo trampa.
  assert.equal((await post(`/api/public/${slug}/connect`, { kind: "visitor", name: "A" })).status, 400)
  assert.equal((await post(`/api/public/${slug}/connect`, { kind: "visitor", name: "María Prueba" })).status, 400) // sin contacto
  assert.equal((await post(`/api/public/${slug}/connect`, { kind: "visitor", name: "María Prueba", phone: "123" })).status, 400)
  assert.equal((await post(`/api/public/no-existe-${stamp}/connect`, { kind: "visitor", name: "María Prueba", phone: "8711234567" })).status, 404)
  const phone = `871${String(stamp).slice(-7)}`
  const sent = await post(`/api/public/${slug}/connect`, { kind: "visitor", name: `Visita ${stamp}`, phone, message: "Vengo el domingo" })
  assert.equal(sent.status, 201)
  const again = await (await post(`/api/public/${slug}/connect`, { kind: "visitor", name: `Visita ${stamp}`, phone })).json()
  assert.equal(again.duplicate, true)
  const trap = await post(`/api/public/${slug}/connect`, { kind: "visitor", name: "Robot Prueba", phone: "8719999999", website: "http://spam" })
  assert.equal(trap.status, 201)

  // Bandeja: solo el equipo; el creyente no.
  assert.equal((await carlos("/api/connect")).status, 403)
  const inbox = await (await owner("/api/connect")).json()
  const card = inbox.cards.find((c) => c.name === `Visita ${stamp}`)
  assert.ok(card)
  assert.equal(inbox.cards.some((c) => c.name === "Robot Prueba"), false)
  assert.equal((await owner("/api/connect", { method: "PATCH", headers: json, body: JSON.stringify({ type: "card", id: card.id, status: "done" }) })).status, 200)
  assert.equal((await owner("/api/connect", { method: "PATCH", headers: json, body: JSON.stringify({ type: "card", id: card.id, status: "raro" }) })).status, 400)

  // Oración: anónima desde la página y propia desde el portal; cada quien ve la suya.
  assert.equal((await post(`/api/public/${slug}/connect`, { kind: "prayer", message: `Por mi familia ${stamp}` })).status, 201)
  const mine = await carlos("/api/prayer", { method: "POST", headers: json, body: JSON.stringify({ body: `Necesito paz ${stamp}`, visibility: "leaders" }) })
  assert.equal(mine.status, 201)
  const myList = (await (await carlos("/api/prayer")).json()).prayers
  assert.ok(myList.some((p) => p.body === `Necesito paz ${stamp}`))
  assert.equal(myList.some((p) => p.body === `Por mi familia ${stamp}`), false)
  const team = (await (await owner("/api/connect")).json()).prayers
  const anon = team.find((p) => p.body === `Por mi familia ${stamp}`)
  assert.ok(anon)
  assert.equal((await owner("/api/connect", { method: "PATCH", headers: json, body: JSON.stringify({ type: "prayer", id: anon.id, status: "praying" }) })).status, 200)
})
