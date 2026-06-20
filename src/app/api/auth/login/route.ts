import { route, jsonOk, jsonError, parseJson } from "@/server/api/respond";
import { loginSchema } from "@/lib/validation";
import type { AuthStatusDTO } from "@/lib/types";
import { getSettings } from "@/server/services/settings";
import { verifyLogin } from "@/server/auth/users";
import { createSession, isHttps, setSessionCookie } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const parsed = await parseJson(req, loginSchema);
  if (!parsed.success) return parsed.response;

  const user = verifyLogin(parsed.data.username, parsed.data.password);
  if (!user) return jsonError("invalid_credentials", "Invalid username or password", 401);

  const { token, expiresAt } = createSession(user.id);
  const body: AuthStatusDTO = {
    authEnabled: getSettings().authEnabled,
    authenticated: true,
    needsAdmin: false,
    username: user.username,
  };
  const res = jsonOk(body);
  setSessionCookie(res, token, expiresAt, isHttps(req));
  return res;
});
