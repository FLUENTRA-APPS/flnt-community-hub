// Minimal SMTP client for the edge runtime (Cloudflare Workers sockets).
// Credentials are read from environment secrets at call time and never logged.

type Socket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls: () => Socket;
  close: () => Promise<void>;
};

type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const username = process.env["SMTP_USERNAME"];
  const password = process.env["SMTP_PASSWORD"];
  const fromEmail = process.env["SMTP_FROM_EMAIL"];
  const fromName = process.env["SMTP_FROM_NAME"] ?? "flnt";
  if (!host || !username || !password || !fromEmail || !Number.isFinite(port)) return null;
  return { host, port, username, password, fromEmail, fromName };
}

class SmtpSession {
  private socket: Socket;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  constructor(socket: Socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  private async readLine(): Promise<string> {
    while (!this.buffer.includes("\r\n")) {
      const { value, done } = await this.reader.read();
      if (done) break;
      if (value) this.buffer += this.decoder.decode(value, { stream: true });
    }
    const index = this.buffer.indexOf("\r\n");
    if (index === -1) {
      const rest = this.buffer;
      this.buffer = "";
      return rest;
    }
    const line = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + 2);
    return line;
  }

  async readReply(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length < 4 || line[3] !== "-") break;
    }
    const last = lines[lines.length - 1] ?? "";
    return { code: Number(last.slice(0, 3)), text: lines.join("\n") };
  }

  async send(command: string, expected: number[]): Promise<{ code: number; text: string }> {
    await this.writer.write(this.encoder.encode(`${command}\r\n`));
    const reply = await this.readReply();
    if (!expected.includes(reply.code)) {
      throw new Error(`SMTP command rejected with status ${reply.code}`);
    }
    return reply;
  }

  async upgrade(): Promise<void> {
    await this.reader.cancel().catch(() => undefined);
    this.reader.releaseLock?.();
    await this.writer.close().catch(() => undefined);
    this.writer.releaseLock?.();
    this.socket = this.socket.startTls();
    this.reader = this.socket.readable.getReader();
    this.writer = this.socket.writable.getWriter();
    this.buffer = "";
  }

  async close(): Promise<void> {
    try {
      await this.writer.write(this.encoder.encode("QUIT\r\n"));
    } catch {
      /* ignore */
    }
    await this.socket.close().catch(() => undefined);
  }
}

function b64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

function dotStuff(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends one message over SMTP. Returns false (never throws) when SMTP is not
 * configured or the provider refuses, so product flows keep working.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const config = readSmtpConfig();
  if (!config) {
    console.warn("[mail] SMTP is not configured; skipping send.");
    return false;
  }

  let session: SmtpSession | undefined;
  try {
    const { connect } = (await import(/* @vite-ignore */ "cloudflare:sockets" as string)) as {
      connect: (
        address: { hostname: string; port: number },
        options?: { secureTransport?: string; allowHalfOpen?: boolean },
      ) => Socket;
    };

    const implicitTls = config.port === 465;
    const socket = connect(
      { hostname: config.host, port: config.port },
      { secureTransport: implicitTls ? "on" : "starttls", allowHalfOpen: false },
    );

    session = new SmtpSession(socket);
    const greeting = await session.readReply();
    if (greeting.code !== 220) throw new Error(`SMTP greeting failed (${greeting.code})`);

    await session.send(`EHLO flnt`, [250]);
    if (!implicitTls) {
      await session.send("STARTTLS", [220]);
      await session.upgrade();
      await session.send(`EHLO flnt`, [250]);
    }

    await session.send("AUTH LOGIN", [334]);
    await session.send(b64(config.username), [334]);
    await session.send(b64(config.password), [235]);

    await session.send(`MAIL FROM:<${config.fromEmail}>`, [250]);
    await session.send(`RCPT TO:<${message.to}>`, [250, 251]);
    await session.send("DATA", [354]);

    const boundary = `flnt-${crypto.randomUUID()}`;
    const headers = [
      `From: ${encodeHeader(config.fromName)} <${config.fromEmail}>`,
      `To: <${message.to}>`,
      `Subject: ${encodeHeader(message.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@flnt>`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].join("\r\n");

    const body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      message.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      message.html,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    await session.send(`${headers}\r\n\r\n${dotStuff(body)}\r\n.`, [250]);
    await session.close();
    return true;
  } catch (error) {
    console.error("[mail] SMTP send failed:", error instanceof Error ? error.message : error);
    if (session) await session.close().catch(() => undefined);
    return false;
  }
}
