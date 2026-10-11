import React, { useCallback, useRef, useState } from 'react';
import type { FileNode } from '../types';
import { FileTree } from './FileTree';
import { CodePane } from './CodePane';
import { PreviewPane } from './PreviewPane';
import { findEntry } from '../lib/bundle';
import { downloadZip } from '../lib/zip';
import { useReveal } from '../hooks/useReveal';

interface Props {
  files: FileNode[];
  runKey: number;
  loading: boolean;
  elapsed: number;
  status: string;
  received: string[];
  model?: string;
  onOpenBrowser: () => void;
  onNotify: (msg: string) => void;
  onExample: () => void;
}

export const Workspace: React.FC<Props> = ({
  files,
  runKey,
  loading,
  elapsed,
  status,
  received,
  model,
  onOpenBrowser,
  onNotify,
  onExample,
}) => {
  const reveal = useReveal(files, runKey);
  const activeFile = files.find((f) => f.path === reveal.activePath);
  const hasEntry = !!findEntry(files);

  // Code | preview split (desktop) and tab (mobile)
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<'code' | 'preview'>('code');
  const areaRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const r = areaRef.current?.getBoundingClientRect();
      if (!r) return;
      setSplit(Math.min(75, Math.max(25, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Code / preview switch for narrow screens */}
      <div className="flex shrink-0 gap-1 border-b border-ink/10 bg-white p-2 lg:hidden" role="tablist">
        {(['code', 'preview'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-ink text-white' : 'text-ink/60 hover:bg-ink/5'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Far left: file manager */}
        <div className="hidden w-[248px] shrink-0 border-r border-ink/10 lg:block">
          <FileTree
            files={reveal.shownFiles}
            activePath={reveal.activePath}
            writingPath={reveal.writingPath}
            onSelect={reveal.selectFile}
            onDownload={() => downloadZip(files)}
            canDownload={files.length > 0 && !reveal.streaming}
          />
        </div>

        {/* Right: code | preview */}
        <div ref={areaRef} className="flex min-h-0 min-w-0 flex-1" style={{ ['--split' as string]: `${split}%` }}>
          <div
            className={`${tab === 'code' ? 'block' : 'hidden'} min-w-0 flex-1 lg:block lg:flex-none lg:[flex-basis:var(--split)]`}
          >
            <CodePane
              files={reveal.shownFiles}
              activeFile={activeFile}
              visible={activeFile ? reveal.getVisible(activeFile.path) : ''}
              streaming={reveal.streaming}
              writing={reveal.streaming && reveal.writingPath === activeFile?.path}
              loading={loading}
              elapsed={elapsed}
              status={status}
              received={received}
              model={model}
              canOpen={hasEntry}
              onSelect={reveal.selectFile}
              onSkip={reveal.skip}
              onOpenBrowser={onOpenBrowser}
              onNotify={onNotify}
              onExample={onExample}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize code and preview"
            onPointerDown={startDrag}
            className="group relative hidden w-1.5 shrink-0 cursor-col-resize bg-ink lg:block"
          >
            <span
              className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
                dragging ? 'bg-iris-soft' : 'bg-white/10 group-hover:bg-iris-soft'
              }`}
            />
          </div>

          <div className={`${tab === 'preview' ? 'block' : 'hidden'} min-w-0 flex-1 lg:block`}>
            <PreviewPane
              files={files}
              ready={!reveal.streaming}
              loading={loading}
              onOpenBrowser={onOpenBrowser}
              dragging={dragging}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
