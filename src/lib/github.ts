// Shared GitHub contents-API helper for pages that write files into this repo
// from the browser (live recorder saves, inbox tracking). BYO fine-grained PAT.

const OWNER = 'Hari487-coder';
const REPO = 'hari487-coder.github.io';

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Create or replace a file at an exact path.
 *
 * Unlike putNewFile this DOES overwrite, which is what moving a task between
 * columns needs. The sha of the current file is required by the contents API and
 * is what makes the write a compare-and-set: if the file changed since we read
 * it, GitHub rejects with 409 rather than silently clobbering.
 */
export async function upsertFile(args: {
  token: string;
  path: string;
  content: string;
  message: string;
}): Promise<{ path: string; url: string }> {
  const { token, path, content, message } = args;

  let sha: string | undefined;
  const head = await gh(token, `/repos/${OWNER}/${REPO}/contents/${path}`);
  if (head.ok) {
    sha = (await head.json()).sha;
  } else if (head.status !== 404) {
    throw new Error(`GitHub read failed (${head.status})`);
  }

  const put = await gh(token, `/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(content), ...(sha ? { sha } : {}) }),
  });

  if (!put.ok) {
    const detail = await put.text().catch(() => '');
    throw new Error(`GitHub save failed (${put.status}): ${detail.slice(0, 200)}`);
  }

  const json = await put.json();
  return {
    path,
    url: json.content?.html_url ?? `https://github.com/${OWNER}/${REPO}/blob/main/${path}`,
  };
}

/** Remove a file. Used when a task is deleted from a board. */
export async function deleteFile(args: {
  token: string;
  path: string;
  message: string;
}): Promise<void> {
  const { token, path, message } = args;
  const head = await gh(token, `/repos/${OWNER}/${REPO}/contents/${path}`);
  if (head.status === 404) return; // already gone
  if (!head.ok) throw new Error(`GitHub read failed (${head.status})`);

  const { sha } = await head.json();
  const res = await gh(token, `/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) throw new Error(`GitHub delete failed (${res.status})`);
}

/**
 * Create a NEW file in the repo, probing base, -2, -3... until a free name is
 * found (never overwrites). Returns the repo path and the commit's html_url.
 */
export async function putNewFile(args: {
  token: string;
  dir: string;
  slugBase: string;
  content: string;
  message: string;
}): Promise<{ path: string; slug: string; url: string }> {
  const { token, dir, slugBase, content, message } = args;

  let slug = slugBase;
  for (let i = 2; i <= 9; i++) {
    const head = await gh(token, `/repos/${OWNER}/${REPO}/contents/${dir}/${slug}.md`);
    if (head.status === 404) break;
    if (!head.ok) throw new Error(`GitHub check failed (${head.status})`);
    slug = `${slugBase}-${i}`;
  }

  const put = await gh(token, `/repos/${OWNER}/${REPO}/contents/${dir}/${slug}.md`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(content) }),
  });

  if (!put.ok) {
    const detail = await put.text().catch(() => '');
    throw new Error(`GitHub save failed (${put.status}): ${detail.slice(0, 200)}`);
  }

  const json = await put.json();
  return {
    path: `${dir}/${slug}.md`,
    slug,
    url: json.content?.html_url ?? `https://github.com/${OWNER}/${REPO}/blob/main/${dir}/${slug}.md`,
  };
}
