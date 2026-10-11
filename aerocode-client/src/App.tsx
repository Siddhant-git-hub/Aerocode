import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Scene3D from './components/Scene3D';
import { PromptBar, CATEGORIES, Category } from './components/PromptBar';
import { Workspace } from './components/Workspace';
import { ApiError, generateSite } from './lib/api';
import { openInBrowser } from './lib/bundle';
import type { FileNode } from './types';

const EXAMPLES = [
  'A landing page for a luxury watch brand with a slowly rotating 3D watch and scroll animations',
  'A portfolio for a photographer, full-screen gallery with smooth parallax',
  'A coffee roaster landing page with a floating 3D coffee bag and a menu section',
];

const STORE_KEY = 'aerocode:last-project';

interface Saved {
  prompt: string;
  categorySlug: string;
  files: FileNode[];
  model?: string;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function App() {
  const saved = useRef(loadSaved()).current;

  const [prompt, setPrompt] = useState(saved?.prompt ?? '');
  const [category, setCategory] = useState<Category>(
    CATEGORIES.find((c) => c.slug === saved?.categorySlug) ?? CATEGORIES[0],
  );
  const [files, setFiles] = useState<FileNode[]>(saved?.files ?? []);
  const [model, setModel] = useState<string | undefined>(saved?.model);
  const [runKey, setRunKey] = useState(0); // 0 = restored from storage, no typing animation
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [received, setReceived] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const barRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const workRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<number>();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* ---------- scroll depth: drives the 3D tilt of the workspace ---------- */
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const update = () => {
      raf = 0;
      const heroH = heroRef.current?.offsetHeight ?? window.innerHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(heroH, 1)));
      root.style.setProperty('--p', easeOut(p).toFixed(4));
      root.dataset.settled = p >= 0.995 ? '1' : '0';
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- keep --bar-h in sync with the prompt bar height ---------- */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  /* ---------- elapsed timer while generating ---------- */
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  const scrollToWorkspace = useCallback(() => {
    const hero = heroRef.current;
    if (!hero) return;
    window.scrollTo({ top: hero.offsetHeight, behavior: 'smooth' });
  }, []);

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    setError(null);
    setWarning(null);
    setStatus('');
    setReceived([]);
    setLoading(true);
    scrollToWorkspace();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await generateSite(text, category, ctrl.signal, (p) => {
        if (p.message) setStatus(p.message);
        setReceived(p.received);
      });
      setFiles(res.files);
      setModel(res.model);
      setRunKey((k) => k + 1);
      if (res.truncated.length > 0) {
        setWarning(
          `${res.truncated.join(', ')} ${res.truncated.length > 1 ? 'look' : 'looks'} cut off: the model stopped in the middle of ${res.truncated.length > 1 ? 'them' : 'it'}, so the preview may be broken. The backend needs to allow longer output (max_tokens).`,
        );
      } else if (!res.complete) {
        setWarning('The connection closed before the backend said it was finished. Some files may be missing.');
      }
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ prompt: text, categorySlug: category.slug, files: res.files, model: res.model } satisfies Saved),
        );
      } catch {
        /* storage full or blocked: not important */
      }
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') {
        notify('Generation stopped');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
      setStatus('');
      setReceived([]);
      abortRef.current = null;
    }
  }, [prompt, category, loading, scrollToWorkspace, notify]);

  const handleStop = () => abortRef.current?.abort();

  const handleOpenBrowser = useCallback(() => {
    const result = openInBrowser(files);
    if (result === 'opened') notify('Opened in a new tab');
    else if (result === 'downloaded') notify('Pop-ups are blocked, so index.html was downloaded instead');
    else notify('No HTML file to open yet');
  }, [files, notify]);

  const pickExample = useCallback((text: string) => {
    setPrompt(text);
    setFocusSignal((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Ctrl/Cmd + Enter anywhere = Generate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleGenerate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGenerate]);

  return (
    <div className="relative min-h-screen">
      <Scene3D energy={loading ? 1 : 0} />

      <div className="relative z-10">
        <PromptBar
          prompt={prompt}
          onPrompt={setPrompt}
          category={category}
          onCategory={setCategory}
          loading={loading}
          elapsed={elapsed}
          onSubmit={handleGenerate}
          onStop={handleStop}
          error={error}
          onDismissError={() => setError(null)}
          warning={warning}
          onDismissWarning={() => setWarning(null)}
          barRef={barRef}
          focusSignal={focusSignal}
        />

        {/* Hero: copy floats back in depth as you scroll */}
        <section
          ref={heroRef}
          className="hero-stage relative flex items-center"
          style={{ height: 'calc(100vh - var(--bar-h, 72px))', minHeight: 520 }}
        >
          <div className="hero-copy mx-auto w-full max-w-[1600px] px-6 sm:px-10">
            <h1 className="max-w-[13ch] font-display text-[clamp(2.75rem,7.2vw,6.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
              Say what you want built. Watch the files appear.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink/65">
              Type or speak a request in the bar above. Aerocode writes index.html, styles and scripts, shows the code as
              it is written, and renders the site beside it.
            </p>

            <div className="mt-8 flex max-w-2xl flex-wrap gap-2.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => pickExample(ex)}
                  className="rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-left text-sm text-ink/75 backdrop-blur transition hover:border-iris hover:bg-white hover:text-ink"
                >
                  {ex.length > 52 ? `${ex.slice(0, 50)}…` : ex}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={scrollToWorkspace}
              className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition hover:text-iris"
            >
              <span className="grid h-9 w-9 animate-bounce place-items-center rounded-full border border-ink/20 bg-white/70">
                <ChevronDown className="h-4 w-4" />
              </span>
              Open the workspace
            </button>
          </div>
        </section>

        {/* Workspace: tilts up out of the depth and settles flat */}
        <div className="deck-wrap">
          <div ref={workRef} className="deck overflow-hidden rounded-t-2xl border border-b-0 border-ink/15 bg-white"
            style={{ height: 'calc(100vh - var(--bar-h, 72px))', minHeight: 560 }}>
            <Workspace
              files={files}
              runKey={runKey}
              loading={loading}
              elapsed={elapsed}
              status={status}
              received={received}
              model={model}
              onOpenBrowser={handleOpenBrowser}
              onNotify={notify}
              onExample={() => pickExample(EXAMPLES[0])}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
