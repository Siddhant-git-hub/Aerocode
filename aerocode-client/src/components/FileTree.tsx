import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Palette,
} from 'lucide-react';
import type { FileNode } from '../types';
import { extOf } from '../lib/api';

interface TreeNode {
  name: string;
  path: string;
  file?: FileNode;
  children: TreeNode[];
}

function build(files: FileNode[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let next = cur.children.find((c) => c.name === part && !!c.file === (i === parts.length - 1));
      if (!next) {
        next = { name: part, path, children: [], file: i === parts.length - 1 ? f : undefined };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const order = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file));
    nodes.forEach((n) => order(n.children));
  };
  order(root.children);
  return root.children;
}

function FileIcon({ path, active }: { path: string; active: boolean }) {
  const ext = extOf(path);
  const cls = `h-4 w-4 shrink-0 ${active ? 'text-iris' : 'text-ink/45'}`;
  if (ext === 'html' || ext === 'htm') return <FileCode className={cls} />;
  if (ext === 'css') return <Palette className={cls} />;
  if (ext === 'js' || ext === 'mjs' || ext === 'ts' || ext === 'json') return <FileJson className={cls} />;
  return <FileText className={cls} />;
}

interface Props {
  files: FileNode[];
  activePath: string;
  writingPath: string | null;
  onSelect: (path: string) => void;
  onDownload: () => void;
  canDownload: boolean;
}

export const FileTree: React.FC<Props> = ({
  files,
  activePath,
  writingPath,
  onSelect,
  onDownload,
  canDownload,
}) => {
  const tree = useMemo(() => build(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (p: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((n) => {
      const pad = { paddingLeft: 12 + depth * 14 };
      if (!n.file) {
        const open = !collapsed.has(n.path);
        return (
          <li key={`d:${n.path}`}>
            <button
              type="button"
              onClick={() => toggle(n.path)}
              style={pad}
              className="flex w-full items-center gap-1.5 py-1.5 pr-3 text-left text-[13px] text-ink/70 transition hover:bg-ink/[0.04]"
            >
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
              {open ? <FolderOpen className="h-4 w-4 text-iris/70" /> : <Folder className="h-4 w-4 text-iris/70" />}
              <span className="truncate">{n.name}</span>
            </button>
            {open && <ul>{render(n.children, depth + 1)}</ul>}
          </li>
        );
      }
      const active = n.file.path === activePath;
      const writing = n.file.path === writingPath;
      return (
        <li key={`f:${n.path}`}>
          <button
            type="button"
            onClick={() => onSelect(n.file!.path)}
            style={{ paddingLeft: pad.paddingLeft + 18 }}
            aria-current={active ? 'true' : undefined}
            className={`relative flex w-full items-center gap-2 py-1.5 pr-3 text-left font-mono text-[12.5px] transition ${
              active ? 'bg-iris-wash text-ink' : 'text-ink/75 hover:bg-ink/[0.04]'
            }`}
          >
            {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-iris" />}
            <FileIcon path={n.file.path} active={active} />
            <span className="truncate">{n.name}</span>
            {writing && <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-iris" title="Being written" />}
          </button>
        </li>
      );
    });

  const bytes = files.reduce((s, f) => s + new Blob([f.content]).size, 0);
  const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-ink/10 px-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Files</h2>
        <span className="text-xs text-ink/50 tabular-nums">{files.length}</span>
      </div>

      <nav aria-label="Generated files" className="scroll-light min-h-0 flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="px-4 py-5 text-[13px] leading-relaxed text-ink/50">
            Files appear here as Aerocode writes them.
          </p>
        ) : (
          <ul>{render(tree, 0)}</ul>
        )}
      </nav>

      <div className="shrink-0 border-t border-ink/10 p-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={!canDownload}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink/15 py-2 text-[13px] font-medium transition hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          Download .zip
        </button>
        {files.length > 0 && <p className="mt-2 text-center text-xs text-ink/45 tabular-nums">{size} total</p>}
      </div>
    </aside>
  );
};

export default FileTree;
