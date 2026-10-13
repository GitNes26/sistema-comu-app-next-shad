import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/db"
import { subscriptionUsage, syncExpiredSubscriptions } from "@/lib/billing/subscriptions"

export async function GET() {
 const session = await getServerSession(authOptions); if (!session?.user) return NextResponse.json({ok:false,error:"No autorizado"},{status:401})
 await syncExpiredSubscriptions()
 if (hasPermission(session,"organizations.manage")) {
  const organizations = await prisma.organization.findMany({ include: { subscription: { include: { plan: true } }, subscriptionPayments: { orderBy: { createdAt: "desc" }, take: 20 }, _count: { select: { locations: true, employees: true } } }, orderBy: { name: "asc" } })
  return NextResponse.json({ok:true,organizations})
 }
 const organizationId=effectiveOrgId(session); if(!organizationId) return NextResponse.json({ok:false,error:"Selecciona una iglesia"},{status:400})
 return NextResponse.json({ok:true,usage:await subscriptionUsage(organizationId),payments:await prisma.subscriptionPayment.findMany({where:{organizationId},orderBy:{createdAt:"desc"},take:20})})
}
export async function POST(request:Request){
 const session=await getServerSession(authOptions); if(!hasPermission(session,"organizations.manage")) return NextResponse.json({ok:false,error:"Solo el superadministrador puede modificar suscripciones"},{status:403})
 try { const body=await request.json(); const organizationId=String(body.organizationId??"");
  if(body.action==="payment") { const payment=await prisma.subscriptionPayment.create({data:{organizationId,subscriptionId:body.subscriptionId||null,planId:body.planId||null,amount:Number(body.amount),status:"paid",paidAt:new Date(),reference:String(body.reference??"")||null}}); if(body.subscriptionId) await prisma.organizationSubscription.update({where:{id:String(body.subscriptionId)},data:{status:"active"}}); await prisma.organization.update({where:{id:organizationId},data:{isBlocked:false,blockedReason:null}}); return NextResponse.json({ok:true,payment}) }
  const periodEndsAt=new Date(String(body.periodEndsAt)); if(Number.isNaN(periodEndsAt.getTime())) throw new Error("Selecciona una fecha de vencimiento válida")
  const subscription=await prisma.organizationSubscription.upsert({where:{organizationId},update:{planId:String(body.planId),status:String(body.status??"active"),periodEndsAt,graceEndsAt:body.graceEndsAt?new Date(body.graceEndsAt):null,extraLocations:Math.max(0,Number(body.extraLocations??0)),extraEmployeePacks:Math.max(0,Number(body.extraEmployeePacks??0)),autoBlockOnPastDue:body.autoBlockOnPastDue!==false,reminderDaysBefore:Math.max(0,Number(body.reminderDaysBefore??5))},create:{organizationId,planId:String(body.planId),periodEndsAt,status:String(body.status??"active"),extraLocations:Math.max(0,Number(body.extraLocations??0)),extraEmployeePacks:Math.max(0,Number(body.extraEmployeePacks??0))}})
  const blocked=body.blocked===true; await prisma.organization.update({where:{id:organizationId},data:{isBlocked:blocked,blockedReason:blocked?String(body.blockedReason??"Cuenta suspendida por administración"):null}}); return NextResponse.json({ok:true,subscription})
 } catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"No fue posible actualizar la suscripción"},{status:400})}
}
