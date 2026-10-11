import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Square, AlertTriangle, X, RotateCw } from 'lucide-react';

export interface Category {
  label: string;
  slug: string;
}

export const CATEGORIES: Category[] = [
  { label: '3D Web Experience', slug: '3d-experience' },
  { label: 'Landing page', slug: 'landing-page' },
  { label: 'Portfolio', slug: 'portfolio' },
  { label: 'E-commerce store', slug: 'e-commerce' },
  { label: 'SaaS dashboard', slug: 'dashboard' },
  { label: 'Blog or magazine', slug: 'blog' },
];

interface Props {
  prompt: string;
  onPrompt: (v: string) => void;
  category: Category;
  onCategory: (c: Category) => void;
  loading: boolean;
  elapsed: number;
  onSubmit: () => void;
  onStop: () => void;
  error: string | null;
  onDismissError: () => void;
  warning: string | null;
  onDismissWarning: () => void;
  barRef: React.RefObject<HTMLElement>;
  focusSignal: number;
}

export const PromptBar: React.FC<Props> = ({
  prompt,
  onPrompt,
  category,
  onCategory,
  loading,
  elapsed,
  onSubmit,
  onStop,
  error,
  onDismissError,
  warning,
  onDismissWarning,
  barRef,
  focusSignal,
}) => {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  // Grow the textarea with its content (max 3 lines).
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [prompt]);

  useEffect(() => {
    if (focusSignal > 0) areaRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => () => recRef.current?.stop?.(), []);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev: any) => {
      const said = ev.results[0][0].transcript as string;
      onPrompt(prompt ? `${prompt} ${said}` : said);
    };
    recRef.current = rec;
    rec.start();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!loading && prompt.trim()) onSubmit();
    }
  };

  return (
    <header
      ref={barRef as React.RefObject<HTMLElement>}
      className="sticky top-0 z-50 border-b border-ink/10 bg-paper/80 backdrop-blur-xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && prompt.trim()) onSubmit();
        }}
        className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6"
      >
        <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Aerocode home">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#0e0c16" />
            <path d="M7 21 16 8l9 13" fill="none" stroke="#a78bfa" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 24 16 17l5 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">Aerocode</span>
        </a>

        <label className="sr-only" htmlFor="category">
          Site type
        </label>
        <select
          id="category"
          value={category.slug}
          disabled={loading}
          onChange={(e) => onCategory(CATEGORIES.find((c) => c.slug === e.target.value) ?? CATEGORIES[0])}
          className="hidden h-11 shrink-0 rounded-xl border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-iris focus:ring-2 focus:ring-iris/25 md:block"
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="relative min-w-0 flex-1">
          <label className="sr-only" htmlFor="prompt">
            Website request
          </label>
          <textarea
            id="prompt"
            ref={areaRef}
            rows={1}
            value={prompt}
            disabled={loading}
            onChange={(e) => onPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe the website you want, for example: a landing page for a coffee roaster with a rotating 3D bag"
            className="block min-h-[44px] w-full resize-none rounded-xl border border-ink/15 bg-white py-[11px] pl-4 pr-12 text-[15px] leading-[22px] text-ink placeholder:text-ink/40 outline-none transition focus:border-iris focus:ring-2 focus:ring-iris/25 disabled:bg-ink/[0.03]"
          />
          <button
            type="button"
            onClick={toggleMic}
            title={listening ? 'Stop listening' : 'Speak your request'}
            aria-pressed={listening}
            className={`absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-lg transition ${
              listening ? 'animate-pulse bg-rose-500/15 text-rose-600' : 'text-ink/50 hover:bg-ink/5 hover:text-ink'
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>

        {loading ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-ink/20 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-ink/5"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>Stop</span>
            <span className="tabular-nums text-ink/50">{elapsed}s</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-iris px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(109,40,217,0.7)] transition hover:bg-iris-deep disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40 disabled:shadow-none"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate</span>
          </button>
        )}
      </form>

      {warning && !error && (
        <div role="status" className="border-t border-amber-500/25 bg-amber-50">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 text-sm text-amber-950 sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1">{warning}</p>
            <button
              type="button"
              onClick={onDismissWarning}
              aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="border-t border-rose-500/20 bg-rose-50">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 text-sm text-rose-900 sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <p className="min-w-0 flex-1">{error}</p>
            {prompt.trim() && !loading && (
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-medium transition hover:bg-rose-100"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default PromptBar;
