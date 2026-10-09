import { securityTxtBody } from "@/lib/securityTxt";

export const dynamic = "force-static";

/** RFC 9116. Placeholder contact until Greg replaces it. */
export function GET() {
  return new Response(securityTxtBody(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
