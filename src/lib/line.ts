export type VerifiedLineIdentity = {
  subject: string;
};

export class LineTokenError extends Error {
  constructor() {
    super("LINE identity verification failed");
    this.name = "LineTokenError";
  }
}

export async function verifyLineIdToken(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedLineIdentity> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  if (!channelId || channelId.startsWith("replace_with_")) {
    throw new Error("LINE_LOGIN_CHANNEL_ID is not configured");
  }
  if (idToken.length > 8_192 || idToken.split(".").length !== 3) {
    throw new LineTokenError();
  }

  const body = new URLSearchParams({ id_token: idToken, client_id: channelId });
  let response: Response;
  try {
    response = await fetcher("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new LineTokenError();
  }
  if (!response.ok) throw new LineTokenError();

  const result: unknown = await response.json().catch(() => null);
  if (
    !result ||
    typeof result !== "object" ||
    !("sub" in result) ||
    typeof result.sub !== "string" ||
    !result.sub ||
    !("aud" in result) ||
    result.aud !== channelId
  ) {
    throw new LineTokenError();
  }
  return { subject: result.sub };
}
