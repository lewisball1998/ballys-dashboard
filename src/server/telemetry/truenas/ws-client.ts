import net from "node:net";
import tls from "node:tls";
import crypto from "node:crypto";

/**
 * Minimal WebSocket client (RFC 6455) over `node:tls` / `node:net` (SERVER-ONLY).
 *
 * Deliberately dependency-free: TrueNAS SCALE's current API is JSON-RPC 2.0 over
 * a WebSocket, and Node's global `WebSocket` cannot be given per-connection TLS
 * options without pulling in `undici`. Speaking the framing directly over
 * `node:tls` lets us VERIFY certificates by default and scope the opt-in
 * verification bypass to THIS connection alone — never global TLS, never
 * `NODE_TLS_REJECT_UNAUTHORIZED`. Mirrors the dependency-free Docker engine client.
 *
 * Scope is intentionally tiny: a single client→server text channel with masking,
 * server text/continuation reassembly, ping/pong, and timeouts. Anything it can't
 * handle surfaces as an error, which the provider treats as a calm "unavailable".
 */

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface WsClientOptions {
  /** Skip TLS certificate verification for THIS connection only (self-signed
   * homelab TrueNAS). Never affects global TLS. Default: verify. */
  allowInsecure?: boolean;
  /** Budget for the TCP+TLS+HTTP-upgrade handshake. */
  handshakeTimeoutMs?: number;
}

type Socket = net.Socket | tls.TLSSocket;

/** A connected WebSocket. `onText` delivers reassembled UTF-8 messages. */
export class WsConnection {
  private buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private textHandler: ((msg: string) => void) | null = null;
  private closeHandler: ((reason: string) => void) | null = null;
  private closed = false;

  constructor(private readonly socket: Socket) {
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("close", () => this.fail("connection closed"));
    socket.on("error", (err: Error) => this.fail(err.message));
  }

  onText(handler: (msg: string) => void): void {
    this.textHandler = handler;
  }

  onClose(handler: (reason: string) => void): void {
    this.closeHandler = handler;
  }

  /** Send a UTF-8 text frame (client frames MUST be masked). */
  sendText(text: string): void {
    if (this.closed) return;
    this.socket.write(encodeFrame(0x1, Buffer.from(text, "utf8")));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.write(encodeFrame(0x8, Buffer.alloc(0)));
    } catch {
      // ignore — we're tearing down anyway
    }
    this.socket.destroy();
  }

  private fail(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.closeHandler?.(reason);
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // Parse as many complete frames as the buffer holds.
    for (;;) {
      const frame = decodeFrame(this.buffer);
      if (!frame) return; // need more bytes
      this.buffer = this.buffer.subarray(frame.consumed);
      this.handleFrame(frame.opcode, frame.fin, frame.payload);
    }
  }

  private handleFrame(opcode: number, fin: boolean, payload: Buffer): void {
    switch (opcode) {
      case 0x0: // continuation
      case 0x1: // text
        this.fragments.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.fragments).toString("utf8");
          this.fragments = [];
          this.textHandler?.(msg);
        }
        break;
      case 0x8: // close
        this.fail("server closed");
        break;
      case 0x9: // ping -> pong
        if (!this.closed) this.socket.write(encodeFrame(0xa, payload));
        break;
      case 0xa: // pong — ignore
        break;
      default:
        // Binary or reserved opcodes are unexpected from TrueNAS JSON-RPC; ignore.
        break;
    }
  }
}

/** Open a WebSocket to `url` (ws:// or wss://) and complete the upgrade handshake. */
export function connectWebSocket(url: URL, options: WsClientOptions = {}): Promise<WsConnection> {
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? 6_000;
  const secure = url.protocol === "wss:";
  const port = url.port ? Number(url.port) : secure ? 443 : 80;
  const host = url.hostname;
  const path = url.pathname + url.search || "/";
  const key = crypto.randomBytes(16).toString("base64");
  const expectedAccept = crypto
    .createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");

  return new Promise<WsConnection>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const socket: Socket = secure
      ? tls.connect({
          host,
          port,
          servername: host,
          // VERIFY by default; bypass only when explicitly opted in, and only here.
          rejectUnauthorized: options.allowInsecure !== true,
        })
      : net.connect({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      finish(() => reject(new Error("handshake timed out")));
    }, handshakeTimeoutMs);

    const onConnect = () => {
      const req =
        `GET ${path} HTTP/1.1\r\n` +
        `Host: ${host}:${port}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `\r\n`;
      socket.write(req);
    };

    let headerBuf = Buffer.alloc(0);
    const onHandshakeData = (chunk: Buffer) => {
      headerBuf = Buffer.concat([headerBuf, chunk]);
      const sep = headerBuf.indexOf("\r\n\r\n");
      if (sep === -1) return; // wait for full header
      const header = headerBuf.subarray(0, sep).toString("utf8");
      const leftover = headerBuf.subarray(sep + 4);
      socket.removeListener("data", onHandshakeData);

      const statusOk = /^HTTP\/1\.1 101/i.test(header);
      const accept = /sec-websocket-accept:\s*(.+)\r?\n/i.exec(header)?.[1]?.trim();
      if (!statusOk || accept !== expectedAccept) {
        socket.destroy();
        finish(() => reject(new Error("websocket upgrade rejected")));
        return;
      }
      const conn = new WsConnection(socket);
      finish(() => resolve(conn));
      // Any bytes after the header are the first WS frame(s). Defer feeding them
      // until after the awaiting caller has attached its message handler (the
      // resolve continuation runs first), so an early frame is never dropped.
      if (leftover.length > 0) queueMicrotask(() => socket.emit("data", leftover));
    };

    socket.on("data", onHandshakeData);
    socket.on("error", (err: Error) => finish(() => reject(err)));
    socket.on(secure ? "secureConnect" : "connect", onConnect);
  });
}

/** Encode a client→server frame. Client frames are always masked per RFC 6455. */
function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    // 64-bit length; high word stays 0 for our payload sizes.
    header.writeUInt32BE(Math.floor(len / 2 ** 32), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i]! ^ mask[i & 3]!;
  return Buffer.concat([header, mask, masked]);
}

interface DecodedFrame {
  opcode: number;
  fin: boolean;
  payload: Buffer;
  consumed: number;
}

/** Decode one server→client frame from the head of `buf`, or null if incomplete. */
function decodeFrame(buf: Buffer): DecodedFrame | null {
  if (buf.length < 2) return null;
  const b0 = buf[0]!;
  const b1 = buf[1]!;
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let offset = 2;
  if (len === 126) {
    if (buf.length < offset + 2) return null;
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return null;
    const high = buf.readUInt32BE(offset);
    const low = buf.readUInt32BE(offset + 4);
    len = high * 2 ** 32 + low;
    offset += 8;
  }
  const maskKey = masked ? buf.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  if (buf.length < offset + len) return null;
  let payload = buf.subarray(offset, offset + len);
  if (maskKey) {
    const unmasked = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) unmasked[i] = payload[i]! ^ maskKey[i & 3]!;
    payload = unmasked;
  }
  return { opcode, fin, payload, consumed: offset + len };
}
