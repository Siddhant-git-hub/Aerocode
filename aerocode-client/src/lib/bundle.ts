import type { FileNode } from '../types';

const norm = (p: string) => p.trim().replace(/^[./]+/, '').replace(/\\/g, '/').toLowerCase();
const base = (p: string) => norm(p).split('/').pop() ?? '';

/** The page that gets previewed and opened in the browser. */
export function findEntry(files: FileNode[]): FileNode | undefined {
  return (
    files.find((f) => norm(f.path) === 'index.html') ??
    files.find((f) => base(f.path) === 'index.html') ??
    files.find((f) => /\.html?$/i.test(f.path))
  );
}

function lookup(files: FileNode[], ref: string): FileNode | undefined {
  if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('data:')) return undefined;
  const clean = norm(ref.split(/[?#]/)[0]);
  return files.find((f) => norm(f.path) === clean) ?? files.find((f) => base(f.path) === base(clean));
}

/**
 * Turns the generated project into ONE self-contained HTML string by inlining
 * the local CSS and JS files the page links to. Works in the preview iframe
 * and in a new browser tab (blob URL).
 */
export function buildDocument(files: FileNode[]): string | null {
  const entry = findEntry(files);
  if (!entry) return null;
  let html = entry.content;

  // <link rel="stylesheet" href="styles.css"> -> <style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const file = href ? lookup(files, href) : undefined;
    return file ? `<style data-file="${file.path}">\n${file.content}\n</style>` : tag;
  });

  // <script src="script.js"></script> -> inline <script>
  html = html.replace(
    /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const file = lookup(files, src);
      if (!file) return tag;
      const safe = file.content.replace(/<\/script/gi, '<\\/script');
      // The model often writes `import * as THREE from 'https://...'` in script.js.
      // That only works in a module script, so add type="module" when needed.
      const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
      const needsModule = /^\s*(import|export)\s/m.test(file.content) && !/\btype\s*=/i.test(attrs);
      return `<script${attrs ? ` ${attrs}` : ''}${needsModule ? ' type="module"' : ''}>\n${safe}\n</script>`;
    },
  );

  return html;
}

/** Opens the built page in a new browser tab. Falls back to a download if pop-ups are blocked. */
export function openInBrowser(files: FileNode[]): 'opened' | 'downloaded' | 'none' {
  const doc = buildDocument(files);
  if (!doc) return 'none';

  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'opened';
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = 'index.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
