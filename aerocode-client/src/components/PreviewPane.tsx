import React, { useMemo, useState } from 'react';
import { ExternalLink, Monitor, MonitorPlay, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import type { FileNode } from '../types';
import { buildDocument } from '../lib/bundle';

type Device = 'desktop' | 'tablet' | 'mobile';
const WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

interface Props {
  files: FileNode[];
  /** false while the code is still being written */
  ready: boolean;
  loading: boolean;
  onOpenBrowser: () => void;
  dragging: boolean;
}

export const PreviewPane: React.FC<Props> = ({ files, ready, loading, onOpenBrowser, dragging }) => {
  const [device, setDevice] = useState<Device>('desktop');
  const [reload, setReload] = useState(0);

  const doc = useMemo(() => (ready ? buildDocument(files) : null), [files, ready]);
  const hasFiles = files.length > 0;

  const DeviceBtn = ({ d, icon: Icon, label }: { d: Device; icon: typeof Monitor; label: string }) => (
    <button
      type="button"
      onClick={() => setDevice(d)}
      title={label}
      aria-label={label}
      aria-pressed={device === d}
      className={`grid h-7 w-7 place-items-center rounded-md transition ${
        device === d ? 'bg-ink text-white' : 'text-ink/55 hover:bg-ink/5 hover:text-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <section className="flex h-full min-w-0 flex-col bg-white" aria-label="Live preview">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-ink/10 px-3">
        <span className={`h-2 w-2 rounded-full ${doc ? 'bg-emerald-500' : 'bg-ink/20'}`} />
        <p className="min-w-0 flex-1 truncate text-[13px] text-ink/70">
          {doc ? 'Preview of index.html' : 'Preview'}
        </p>
        <div className="flex items-center gap-1">
          <DeviceBtn d="desktop" icon={Monitor} label="Desktop width" />
          <DeviceBtn d="tablet" icon={Tablet} label="Tablet width" />
          <DeviceBtn d="mobile" icon={Smartphone} label="Phone width" />
          <span className="mx-1 h-4 w-px bg-ink/10" />
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            disabled={!doc}
            title="Reload preview"
            aria-label="Reload preview"
            className="grid h-7 w-7 place-items-center rounded-md text-ink/55 transition hover:bg-ink/5 hover:text-ink disabled:opacity-30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenBrowser}
            disabled={!doc}
            title="Open in a new browser tab"
            aria-label="Open in a new browser tab"
            className="grid h-7 w-7 place-items-center rounded-md text-ink/55 transition hover:bg-ink/5 hover:text-ink disabled:opacity-30"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-[#eceaf5] scroll-light">
        {doc ? (
          <div className="mx-auto h-full transition-[width] duration-300" style={{ width: WIDTH[device], maxWidth: '100%' }}>
            <iframe
              key={`${reload}:${doc.length}`}
              srcDoc={doc}
              title="Generated site preview"
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
              className={`h-full w-full border-0 bg-white ${device !== 'desktop' ? 'shadow-[0_0_0_1px_rgba(14,12,22,0.12),0_20px_50px_-20px_rgba(14,12,22,0.4)]' : ''}`}
              style={dragging ? { pointerEvents: 'none' } : undefined}
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center px-8">
            <div className="max-w-xs text-center">
              <MonitorPlay className="mx-auto h-6 w-6 text-iris" />
              <p className="mt-4 font-display text-lg font-semibold">
                {loading ? 'Preview comes next' : hasFiles && !ready ? 'Almost there' : 'No preview yet'}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
                {loading
                  ? 'The site renders here as soon as the files arrive.'
                  : hasFiles && !ready
                    ? 'The site renders here once the last file is written.'
                    : hasFiles
                      ? 'None of the files is an HTML page, so there is nothing to render.'
                      : 'Your generated site will render here, live.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PreviewPane;
