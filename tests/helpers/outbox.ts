import fs from 'node:fs/promises';
import path from 'node:path';

export type OutboxEmail = { from: string; to: string; subject: string; html: string; replyTo?: string };

function outboxDir(): string {
  const dir = process.env.E2E_EMAIL_OUTBOX_DIR;
  if (!dir) throw new Error('E2E_EMAIL_OUTBOX_DIR is not set; run tests through playwright.config.ts');
  return path.resolve(__dirname, '../..', dir);
}

export async function clearOutbox() {
  await fs.rm(outboxDir(), { recursive: true, force: true });
}

/** Emails "sent" by the test server since the last clearOutbox(), oldest first. */
export async function readOutbox(): Promise<OutboxEmail[]> {
  const dir = outboxDir();
  const files = (await fs.readdir(dir).catch(() => [] as string[])).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')) as OutboxEmail));
}
