import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import {
  createPeriod,
  deleteConcept,
  deletePeriod,
  emailReceipt,
  getPeriod,
  markEntryPaid,
  payrollWorkspace,
  receiptCompany,
  recalcPeriod,
  saveConcept,
  setPeriodStatus,
  updateEmployeePay,
  updateEntry,
} from "@/lib/payroll/server"

export const dynamic = "force-dynamic"

// Nómina. GET: espacio de trabajo, o detalle con ?periodId. POST: { action, ... }.
// Todo exige `payroll.manage` y se aísla por la iglesia efectiva de la sesión.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const periodId = new URL(req.url).searchParams.get("periodId")
    if (periodId) {
      const [period, company] = await Promise.all([getPeriod(ctx.actor, periodId), receiptCompany(ctx.actor.organizationId)])
      return NextResponse.json({ ok: true, period, company })
    }
    return NextResponse.json({ ok: true, ...(await payrollWorkspace(ctx.actor)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    const actor = ctx.actor
    const id = String(body.id ?? "")
    switch (String(body.action ?? "")) {
      case "employee.pay":
        return NextResponse.json({ ok: true, employee: await updateEmployeePay(actor, id, body) })
      case "concept.save":
        return NextResponse.json({ ok: true, ...(await saveConcept(actor, body)) })
      case "concept.delete":
        return NextResponse.json(await deleteConcept(actor, id))
      case "period.create":
        return NextResponse.json({ ok: true, ...(await createPeriod(actor, body as never)) }, { status: 201 })
      case "period.status":
        return NextResponse.json(await setPeriodStatus(actor, id, String(body.status ?? "")))
      case "period.recalc":
        return NextResponse.json(await recalcPeriod(actor, id))
      case "period.delete":
        return NextResponse.json(await deletePeriod(actor, id))
      case "entry.update":
        return NextResponse.json(await updateEntry(actor, id, body))
      case "entry.paid":
        return NextResponse.json(await markEntryPaid(actor, id, body.paid !== false))
      case "entry.email":
        return NextResponse.json(await emailReceipt(actor, id))
      default:
        return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 })
    }
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
