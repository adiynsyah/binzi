// GET /api/konsultasi/whatsapp (card S6-01 §4): 302 to wa.me with the
// number read LIVE from system_settings (KSL-08) — reading it in the page
// would make / dynamic or break the DB-less CI build, so the click is the
// moment the value is read. Works without JavaScript.
//
// Fail-closed 503 (never a fallback number); both answers carry
// `Cache-Control: no-store` because the number can change any time.
// Route Handlers are dynamic by default in Next 16 (bundled docs, "Route
// Handlers → Caching") — same ƒ marker as /api/health. The redirect status
// is EXPLICIT (NextResponse.redirect defaults to 307).
import { NextResponse } from "next/server";

import { WHATSAPP_TEMPLATE } from "@/components/public/beranda/beranda-content";
import { isAppError, toErrorResponse } from "@/lib/errors";
import { getConsultationWhatsAppUrl } from "@/modules/consultation/service";

export async function GET() {
  try {
    const url = await getConsultationWhatsAppUrl(WHATSAPP_TEMPLATE);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Domain answers (the 503) are already logged by the service without
    // the value; only unexpected failures are logged here.
    if (!isAppError(error)) {
      console.error("[GET /api/konsultasi/whatsapp]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
