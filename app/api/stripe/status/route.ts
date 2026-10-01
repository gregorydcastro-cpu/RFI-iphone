import { NextResponse } from "next/server";
import { stripeReadiness } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Production Stripe readiness. Booleans and unset env names only.
 * Never returns secret values, price ids, or key prefixes.
 */
export function GET() {
  return NextResponse.json(stripeReadiness(), { headers: NO_STORE });
}
