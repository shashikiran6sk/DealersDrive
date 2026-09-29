import { createConnection } from 'node:net';

import { env } from '../../config/env.js';
import type { MailerPort, MailMessage, MailResult } from './mail.port.js';

export function createSmtpMailer(): MailerPort {
  return {
    driver: 'smtp',
    async send(message: MailMessage): Promise<MailResult> {
      const socket = createConnection({ host: env.SMTP_HOST, port: env.SMTP_PORT });
      socket.setTimeout(10_000);
      let buffer = '';
      const replies: { resolve: (line: string) => void; reject: (error: Error) => void }[] = [];
      socket.on('error', (error: Error) => {
        while (replies.length) replies.shift()?.reject(error);
      });
      socket.on('close', () => {
        while (replies.length) replies.shift()?.reject(new Error('Mailpit SMTP disconnected'));
      });
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        while (buffer.includes('\r\n')) {
          const index = buffer.indexOf('\r\n');
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (line[3] === ' ' && replies.length) replies.shift()?.resolve(line);
        }
      });
      const reply = () =>
        new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Mailpit SMTP timed out')), 10_000);
          replies.push({
            resolve: (line) => {
              clearTimeout(timeout);
              resolve(line);
            },
            reject: (error) => {
              clearTimeout(timeout);
              reject(error);
            },
          });
        });
      const command = async (value: string, expected: number) => {
        socket.write(`${value}\r\n`);
        const line = await reply();
        if (Number(line.slice(0, 3)) !== expected) throw new Error(`Mailpit SMTP: ${line}`);
      };
      try {
        const greeting = await reply();
        if (!greeting.startsWith('220')) throw new Error(`Mailpit SMTP: ${greeting}`);
        await command('EHLO dealers-drive.local', 250);
        const from = env.MAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.MAIL_FROM;
        await command(`MAIL FROM:<${from}>`, 250);
        await command(`RCPT TO:<${message.to}>`, 250);
        await command('DATA', 354);
        const boundary = `dd-${message.idempotencyKey.replace(/[^A-Za-z0-9]/g, '')}`;
        const lines = [
          `From: ${env.MAIL_FROM}`,
          `To: ${message.to}`,
          `Subject: ${message.subject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          message.text,
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          '',
          message.html,
          `--${boundary}--`,
        ];
        socket.write(`${lines.join('\r\n').replace(/(^|\r\n)\./g, '$1..')}\r\n.\r\n`);
        const accepted = await reply();
        if (!accepted.startsWith('250')) throw new Error(`Mailpit SMTP: ${accepted}`);
        return { providerMessageId: null };
      } finally {
        socket.end();
      }
    },
  };
}
