import { route, jsonOk } from "@/server/api/respond";
import { clearSessionCookie, readSessionToken, revokeSessionToken } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const token = readSessionToken(req);
  if (token) revokeSessionToken(token);
  const res = jsonOk({ ok: true });
  clearSessionCookie(res);
  return res;
});
