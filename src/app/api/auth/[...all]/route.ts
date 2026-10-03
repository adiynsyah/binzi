// Better Auth catch-all handler (card A-09). All auth endpoints live under
// /api/auth/*; the instance (and its lazy environment/database wiring) is
// created per this module's documentation in src/lib/auth.ts.
import { getAuth } from "@/lib/auth";

export async function GET(request: Request) {
  return (await getAuth()).handler(request);
}

export async function POST(request: Request) {
  return (await getAuth()).handler(request);
}
