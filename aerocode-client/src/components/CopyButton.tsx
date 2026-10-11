import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyText } from '../lib/clipboard';

interface CopyButtonProps {
  /** The full code to copy (always the whole file, even while it is still typing out). */
  code?: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  code = '',
  label = 'Copy code',
  className = '',
  onCopied,
}) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!code) return;
    const ok = await copyText(code);
    setState(ok ? 'copied' : 'failed');
    if (ok) onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1800);
  };

  const tone =
    state === 'copied'
      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
      : state === 'failed'
        ? 'border-rose-400/50 bg-rose-400/15 text-rose-300'
        : 'border-white/15 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white';

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!code}
      title="Copy the entire file to the clipboard"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${className}`}
    >
      {state === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
};

export default CopyButton;
