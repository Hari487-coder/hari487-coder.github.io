// Gmail: inbox mail from the last 14 days that is unread or important.

import { ApiDisabledError, AuthError } from './classroom';

export interface MailItem {
  id: string;
  from: string;
  subject: string;
  date: Date;
  snippet: string;
  unread: boolean;
  important: boolean;
  link: string;
}

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function api(token: string, path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new AuthError('unauthorized');
  if (res.status === 403) throw new ApiDisabledError('forbidden');
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json();
}

function parseFrom(raw: string): string {
  const match = raw.match(/^"?([^"<]+)"?\s*<.*>$/);
  return (match ? match[1] : raw).trim();
}

export async function fetchAttention(token: string): Promise<MailItem[]> {
  const q = encodeURIComponent('in:inbox newer_than:14d (is:unread OR is:important)');
  const list = await api(token, `/messages?q=${q}&maxResults=25`);
  const ids: { id: string }[] = list.messages ?? [];

  const items = await Promise.all(
    ids.map(async ({ id }) => {
      const msg = await api(
        token,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      const labels: string[] = msg.labelIds ?? [];
      return {
        id,
        from: parseFrom(header('From')) || 'Unknown sender',
        subject: header('Subject') || '(no subject)',
        date: new Date(Number(msg.internalDate) || header('Date') || Date.now()),
        snippet: msg.snippet ?? '',
        unread: labels.includes('UNREAD'),
        important: labels.includes('IMPORTANT'),
        link: `https://mail.google.com/mail/u/0/#inbox/${id}`,
      } satisfies MailItem;
    }),
  );

  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}
