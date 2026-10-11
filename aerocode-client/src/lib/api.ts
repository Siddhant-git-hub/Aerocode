import type { FileNode } from '../types';

/**
 * Where the backend lives.
 *
 * Default: relative `/api/...`. In dev, Vite (port 5173) forwards /api to the
 * backend on port 3001 (see vite.config.ts), so there is no CORS and no port
 * hard-coded in the UI. For a production build, set VITE_API_URL.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const GENERATE_URL = `${API_BASE}/api/generate`;

export type ApiErrorKind = 'network' | 'http' | 'format' | 'aborted';

export class ApiError extends Error {
  kind: ApiErrorKind;
  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const EXT_LANG: Record<string, string> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
  txt: 'text',
};

export function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : '';
}

export function langFromPath(path: string): string {
  return EXT_LANG[extOf(path)] ?? 'text';
}

/** LLMs sometimes wrap file content in ``` fences. Remove them. */
function stripFences(content: string): string {
  const m = /^\s*```[\w-]*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(content);
  return m ? m[1] : content;
}

function filePriority(path: string): number {
  const p = path.toLowerCase();
  if (p === 'index.html') return 0;
  if (p.endsWith('.html')) return 1;
  if (p.endsWith('.css')) return 2;
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 3;
  return 4;
}

export function sortFiles(files: FileNode[]): FileNode[] {
  return [...files].sort(
    (a, b) => filePriority(a.path) - filePriority(b.path) || a.path.localeCompare(b.path),
  );
}

function toFile(path: unknown, content: unknown, language?: unknown): FileNode | null {
  if (typeof path !== 'string' || typeof content !== 'string' || !path.trim()) return null;
  const clean = path.trim().replace(/^\.?\/+/, '');
  return {
    path: clean,
    content: stripFences(content),
    language: typeof language === 'string' && language ? language : langFromPath(clean),
  };
}

/** Accepts `[{path, content}]`, `[{name, code}]` or `{ "index.html": "..." }`. */
function normalizeFiles(raw: unknown): FileNode[] {
  const out: FileNode[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const f = toFile(
        o.path ?? o.name ?? o.filename ?? o.file,
        o.content ?? o.code ?? o.text,
        o.language ?? o.lang,
      );
      if (f) out.push(f);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [path, content] of Object.entries(raw as Record<string, unknown>)) {
      const f = toFile(path, content);
      if (f) out.push(f);
    }
  }

  return sortFiles(out);
}

export interface GenerateResponse {
  files: FileNode[];
  model?: string;
  /** Files that look like the model stopped in the middle of them. */
  truncated: string[];
  /** false if the stream closed before the backend sent its final "COMPLETE" event */
  complete: boolean;
}

export interface Progress {
  phase?: string;
  message?: string;
  /** paths of the files that have arrived so far */
  received: string[];
}


/** Heuristic: does this file end the way a finished file of its type ends? */
function looksCutOff(f: FileNode): boolean {
  const t = f.content.trimEnd();
  if (!t) return true;
  switch (extOf(f.path)) {
    case 'html':
    case 'htm':
      return !/<\/html>\s*$/i.test(t);
    case 'css':
      return !/(\}|\*\/)$/.test(t);
    case 'js':
    case 'mjs':
      return !/([;})\]]|\*\/)$/.test(t);
    default:
      return false;
  }
}

/** Pulls every complete SSE event out of `buf`, returns what is left over. */
function drainSse(buf: string, onData: (data: unknown) => void): string {
  buf = buf.replace(/\r\n/g, '\n');
  let idx: number;
  while ((idx = buf.indexOf('\n\n')) !== -1) {
    const block = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data || data === '[DONE]') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue; // ignore a malformed event instead of failing the whole run
    }
    onData(parsed);
  }
  return buf;
}

export async function generateSite(
  prompt: string,
  category: { label: string; slug: string },
  signal: AbortSignal,
  onProgress?: (p: Progress) => void,
): Promise<GenerateResponse> {
  let res: Response;
  try {
    res = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
      body: JSON.stringify({ prompt, category: category.label, type: category.slug }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new ApiError('aborted', 'Stopped.');
    throw new ApiError(
      'network',
      "Can't reach the backend. Start it on port 3001, then press Generate again.",
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    if (data?.error) throw new ApiError('http', String(data.error));
    if (res.status >= 500 && !text.trim()) {
      throw new ApiError(
        'network',
        `The backend didn't answer (HTTP ${res.status}). Check that it's running on port 3001.`,
      );
    }
    throw new ApiError('http', `The backend returned HTTP ${res.status}.`);
  }

  // ---- state filled in by events ----
  const received: FileNode[] = [];
  let finalFiles: FileNode[] | null = null;
  let model: string | undefined;
  let complete = false;
  let message: string | undefined;

  const handle = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const d = raw as Record<string, any>;
    const phase = typeof d.phase === 'string' ? d.phase.toUpperCase() : undefined;

    if (d.error || d.success === false || phase === 'ERROR' || phase === 'FAILED') {
      throw new ApiError('http', String(d.error ?? d.message ?? 'The backend reported a failure.'));
    }
    if (typeof d.model === 'string') model = d.model;
    if (typeof d.message === 'string') message = d.message;

    if (d.file && typeof d.file === 'object') {
      const f = toFile(d.file.path ?? d.file.name, d.file.content ?? d.file.code, d.file.language);
      if (f) {
        const i = received.findIndex((r) => r.path === f.path);
        if (i >= 0) received[i] = f;
        else received.push(f);
      }
    }
    if (d.files && typeof d.files === 'object') {
      const fs = normalizeFiles(d.files);
      if (fs.length) finalFiles = fs;
    }
    if (phase === 'COMPLETE' || (d.success === true && d.files)) complete = true;

    onProgress?.({ phase, message, received: received.map((r) => r.path) });
  };

  // ---- read the body: SSE stream (what the backend sends) or one JSON document ----
  try {
    if (!res.body) {
      const text = await res.text();
      const t = text.trimStart();
      if (t.startsWith('{') || t.startsWith('[')) handle(JSON.parse(t));
      else drainSse(text + '\n\n', handle);
    } else {
      const reader = res.body.getReader();
      const dec = new TextDecoder('utf-8');
      let buf = '';
      let mode: 'sse' | 'json' | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (mode === null) {
          const t = buf.trimStart();
          if (!t) continue;
          mode = t[0] === '{' || t[0] === '[' ? 'json' : 'sse';
        }
        if (mode === 'sse') buf = drainSse(buf, handle);
      }
      buf += dec.decode();
      if (mode === 'json') handle(JSON.parse(buf));
      else if (mode === 'sse') drainSse(buf + '\n\n', handle);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') throw new ApiError('aborted', 'Stopped.');
    if (received.length === 0 && !finalFiles) {
      throw new ApiError('network', 'The connection to the backend dropped while generating.');
    }
    // otherwise fall through and use what arrived
  }

  const files = sortFiles(finalFiles ?? received);
  if (files.length === 0) {
    throw new ApiError('format', 'The backend replied, but no files came back.');
  }

  return {
    files,
    model,
    complete,
    truncated: files.filter(looksCutOff).map((f) => f.path),
  };
}
