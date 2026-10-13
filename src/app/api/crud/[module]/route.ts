import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../guard";
import { parseListParams } from "@/lib/crud/types";

export async function GET(req: NextRequest) {
  const moduleKey = req.nextUrl.pathname.split("/").at(-1) as string;
  const guard = await guardCrud(moduleKey, "view");
  if ("response" in guard) return guard.response;
  const { entry, organizationId } = guard;

  try {
    if (req.nextUrl.searchParams.get("defaults") === "1") {
      const defaults = (await entry.module.createDefaults?.(organizationId)) ?? {};
      return NextResponse.json({ ok: true, defaults });
    }
    const params = parseListParams(req.nextUrl.searchParams);
    const result = await entry.module.list(organizationId, params);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const moduleKey = req.nextUrl.pathname.split("/").at(-1) as string;
  const guard = await guardCrud(moduleKey, "manage");
  if ("response" in guard) return guard.response;
  const { entry, organizationId, userId } = guard;

  try {
    const body = await req.json();
    const row = await entry.module.create(organizationId, body, { userId });
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (err) {
    return crudErrorResponse(err);
  }
}
