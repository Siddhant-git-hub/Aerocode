import React, { useEffect, useMemo, useRef } from 'react';
import { ExternalLink, FastForward, Loader2, Wand2 } from 'lucide-react';
import type { FileNode } from '../types';
import { CopyButton } from './CopyButton';
import { highlight } from '../lib/highlight';

interface Props {
  files: FileNode[];
  activeFile?: FileNode;
  visible: string;
  streaming: boolean;
  writing: boolean;
  loading: boolean;
  elapsed: number;
  status: string;
  received: string[];
  model?: string;
  canOpen: boolean;
  onSelect: (path: string) => void;
  onSkip: () => void;
  onOpenBrowser: () => void;
  onNotify: (msg: string) => void;
  onExample: () => void;
}

export const CodePane: React.FC<Props> = ({
  files,
  activeFile,
  visible,
  streaming,
  writing,
  loading,
  elapsed,
  status,
  received,
  model,
  canOpen,
  onSelect,
  onSkip,
  onOpenBrowser,
  onNotify,
  onExample,
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const lang = activeFile?.language ?? 'text';

  const html = useMemo(() => highlight(visible, lang), [visible, lang]);
  const lineCount = useMemo(() => (visible ? visible.split('\n').length : 0), [visible]);
  const gutter = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);

  // Follow the cursor while code is being written.
  useEffect(() => {
    if (writing && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [visible, writing]);

  const hasFiles = files.length > 0;

  return (
    <section className="flex h-full min-w-0 flex-col bg-ink text-white" aria-label="Generated code">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px] text-white/90">{activeFile?.path ?? 'No file open'}</p>
          {activeFile && (
            <p className="text-xs text-white/45">
              {lang}
              {model ? ` · ${model}` : ''}
            </p>
          )}
        </div>

        {streaming && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <FastForward className="h-3.5 w-3.5" />
            Show all
          </button>
        )}

        <CopyButton code={activeFile?.content ?? ''} onCopied={() => onNotify('Code copied to clipboard')} />

        <button
          type="button"
          onClick={onOpenBrowser}
          disabled={!canOpen}
          title={canOpen ? 'Open index.html in a new browser tab' : 'Generate a site first'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-iris-soft px-3 py-1.5 text-[13px] font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in browser
        </button>
      </div>

      {/* File chips: small screens only (the tree is hidden there) */}
      {hasFiles && (
        <div className="scroll-dark flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-3 py-2 lg:hidden">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => onSelect(f.path)}
              className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-xs transition ${
                f.path === activeFile?.path ? 'bg-white text-ink' : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              {f.path}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div ref={scroller} className="scroll-dark min-h-0 flex-1 overflow-auto">
        {hasFiles && activeFile ? (
          <div className="flex min-w-max font-mono text-[12.5px] leading-[1.7]">
            <pre
              aria-hidden="true"
              className="sticky left-0 select-none bg-ink px-3 text-right tabular-nums text-white/25"
            >
              {gutter}
            </pre>
            <pre className="flex-1 pr-8 text-white/90">
              <code dangerouslySetInnerHTML={{ __html: html + (writing ? '<span class="caret"></span>' : '') }} />
            </pre>
          </div>
        ) : loading ? (
          <div className="grid h-full place-items-center px-8">
            <div className="max-w-sm text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-iris-soft" />
              <p className="mt-4 font-display text-lg font-semibold">{status || 'Generating your site'}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                The model is writing the files. This can take a minute.{' '}
                <span className="tabular-nums">{elapsed}s elapsed.</span>
              </p>
              {received.length > 0 && (
                <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {received.map((p) => (
                    <li key={p} className="rounded-md bg-white/10 px-2 py-1 font-mono text-xs text-emerald-300">
                      {p} received
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center px-8">
            <div className="max-w-sm text-center">
              <Wand2 className="mx-auto h-6 w-6 text-iris-soft" />
              <p className="mt-4 font-display text-lg font-semibold">Nothing generated yet</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                Describe a website in the bar above and press Generate. The code shows up here as it is written.
              </p>
              <button
                type="button"
                onClick={onExample}
                className="mt-5 rounded-lg border border-white/15 px-3.5 py-2 text-[13px] text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Fill in an example request
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status line */}
      {hasFiles && activeFile && (
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-1.5 text-xs text-white/45 tabular-nums">
          <span>{writing ? 'Writing…' : 'Ready'}</span>
          <span>
            {activeFile.content.split('\n').length} lines · {activeFile.content.length.toLocaleString()} characters
          </span>
        </div>
      )}
    </section>
  );
};

export default CodePane;
