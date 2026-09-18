/**
 * Minimal Gmail SMTP send (ssl://smtp.gmail.com:465).
 * Server-only. Uses GMAIL_USER + GMAIL_APP_PASSWORD. No extra npm package.
 */

import { connect, type TLSSocket } from "node:tls";

export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 465;

export type GmailSmtpInput = {
  user: string;
  password: string;
  to: string;
  from: string;
  subject: string;
  text: string;
};

export type GmailSmtpResult = {
  ok: boolean;
  error?: string;
};

export type GmailSmtpDeps = {
  connectTls?: typeof connect;
};

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function rfc822(input: GmailSmtpInput): string {
  const from = input.from.includes("<") ? input.from : `${input.from}`;
  return [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.text.replace(/\r?\n/g, "\r\n"),
    "",
  ].join("\r\n");
}

function readCode(buffer: string): number | null {
  const lines = buffer.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = /^(\d{3})(?: |-)/.exec(lines[i] ?? "");
    if (match) return Number(match[1]);
  }
  return null;
}

function expectOk(code: number | null, command: string): void {
  if (code === null || code >= 400) {
    throw new Error(`gmail_smtp_${command}_${code ?? "empty"}`);
  }
}

export async function sendGmailSmtp(
  input: GmailSmtpInput,
  deps: GmailSmtpDeps = {},
): Promise<GmailSmtpResult> {
  const connectTls = deps.connectTls ?? connect;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: GmailSmtpResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const socket: TLSSocket = connectTls(
      {
        host: GMAIL_SMTP_HOST,
        port: GMAIL_SMTP_PORT,
        servername: GMAIL_SMTP_HOST,
      },
      () => {
        void runConversation(socket, input).then(
          () => finish({ ok: true }),
          (error: unknown) => {
            const message = error instanceof Error ? error.message : "gmail_smtp_failed";
            finish({ ok: false, error: message.slice(0, 180) });
          },
        );
      },
    );

    socket.setTimeout(20_000, () => {
      socket.destroy();
      finish({ ok: false, error: "gmail_smtp_timeout" });
    });
    socket.on("error", (error) => {
      finish({ ok: false, error: error.message.slice(0, 180) });
    });
  });
}

async function runConversation(socket: TLSSocket, input: GmailSmtpInput): Promise<void> {
  const read = () =>
    new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        cleanup();
        resolve(chunk.toString("utf8"));
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        socket.off("data", onData);
        socket.off("error", onError);
      };
      socket.on("data", onData);
      socket.on("error", onError);
    });

  const write = (line: string) => {
    socket.write(`${line}\r\n`);
  };

  expectOk(readCode(await read()), "banner");
  write("EHLO gcfieldlog.com");
  expectOk(readCode(await read()), "ehlo");
  write("AUTH LOGIN");
  expectOk(readCode(await read()), "auth");
  write(Buffer.from(input.user).toString("base64"));
  expectOk(readCode(await read()), "user");
  write(Buffer.from(input.password).toString("base64"));
  expectOk(readCode(await read()), "pass");
  const fromAddress = input.from.includes("<")
    ? (input.from.match(/<([^>]+)>/)?.[1] ?? input.user)
    : input.from;
  write(`MAIL FROM:<${fromAddress}>`);
  expectOk(readCode(await read()), "from");
  write(`RCPT TO:<${input.to}>`);
  expectOk(readCode(await read()), "rcpt");
  write("DATA");
  const dataCode = readCode(await read());
  if (dataCode !== 354 && (dataCode === null || dataCode >= 400)) {
    throw new Error(`gmail_smtp_data_${dataCode ?? "empty"}`);
  }
  socket.write(`${rfc822(input)}\r\n.\r\n`);
  expectOk(readCode(await read()), "body");
  write("QUIT");
  try {
    await read();
  } catch {
    /* QUIT reply optional */
  }
  socket.end();
}
