import { connectWebSocket, type WsConnection } from "./ws-client";

/**
 * TrueNAS middleware JSON-RPC 2.0 client over the {@link WsConnection} (v0.3.2,
 * SERVER-ONLY). Speaks the current TrueNAS SCALE API (`/api/current`): open a
 * WebSocket, authenticate with an API key, then issue read-only `*.query` calls.
 *
 * Read-only by contract: callers only reach the specific query methods the
 * provider builds — there is no generic passthrough exposed beyond `call`, and
 * the provider never invokes a mutating method. The API key is used solely for
 * the auth handshake and is NEVER logged or returned.
 */

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class TrueNasAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrueNasAuthError";
  }
}

export class TrueNasClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCall>();
  private closedReason: string | null = null;

  private constructor(
    private readonly conn: WsConnection,
    private readonly callTimeoutMs: number,
  ) {
    conn.onText((msg) => this.onMessage(msg));
    conn.onClose((reason) => this.onConnectionClosed(reason));
  }

  /** Open a connection. Rejects (caller treats as "unavailable") on any failure. */
  static async open(
    url: URL,
    options: { allowInsecure?: boolean; handshakeTimeoutMs?: number; callTimeoutMs?: number },
  ): Promise<TrueNasClient> {
    const conn = await connectWebSocket(url, {
      allowInsecure: options.allowInsecure,
      handshakeTimeoutMs: options.handshakeTimeoutMs,
    });
    return new TrueNasClient(conn, options.callTimeoutMs ?? 4_000);
  }

  /** Authenticate with an API key. Throws {@link TrueNasAuthError} on rejection.
   * The key is passed only here and never logged. */
  async authenticate(apiKey: string): Promise<void> {
    const ok = await this.call("auth.login_with_api_key", [apiKey]);
    if (ok !== true) throw new TrueNasAuthError("TrueNAS rejected the API key");
  }

  /** Issue one JSON-RPC call and resolve with its `result`. */
  call(method: string, params: unknown[] = []): Promise<unknown> {
    if (this.closedReason) return Promise.reject(new Error(this.closedReason));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`TrueNAS call timed out: ${method}`));
      }, this.callTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.conn.sendText(payload);
    });
  }

  close(): void {
    this.conn.close();
    this.onConnectionClosed("client closed");
  }

  private onMessage(raw: string): void {
    let msg: { id?: unknown; result?: unknown; error?: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore non-JSON / partial garbage
    }
    if (typeof msg.id !== "number") return; // ignore server notifications/events
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error !== undefined && msg.error !== null) {
      // Keep the message generic; never surface raw backend error text upstream.
      pending.reject(new Error(`TrueNAS call failed`));
      return;
    }
    pending.resolve(msg.result);
  }

  private onConnectionClosed(reason: string): void {
    if (this.closedReason) return;
    this.closedReason = reason;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
