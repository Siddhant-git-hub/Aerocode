import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FileNode } from '../types';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays back a finished generation as if the files were being written live:
 * files show up in the tree one by one and their code types out.
 * `runKey` changes for every new generation; 0 means "restored, show everything".
 */
export function useReveal(files: FileNode[], runKey: number) {
  const [cursor, setCursor] = useState<{ i: number; n: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const rafRef = useRef(0);

  useLayoutEffect(() => {
    cancelAnimationFrame(rafRef.current);
    setPicked(null);

    if (runKey === 0 || files.length === 0 || reducedMotion()) {
      setCursor(null);
      return;
    }

    const total = files.reduce((s, f) => s + f.content.length, 0);
    const seconds = Math.min(6, Math.max(1.6, total / 6000));
    const step = Math.max(8, Math.ceil(total / (60 * seconds)));

    let i = 0;
    let n = 0;
    setCursor({ i, n });

    const tick = () => {
      n += step;
      if (n >= files[i].content.length) {
        i += 1;
        n = 0;
      }
      if (i >= files.length) {
        setCursor(null);
        return;
      }
      setCursor({ i, n });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [files, runKey]);

  const skip = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setCursor(null);
  }, []);

  const streaming = cursor !== null;
  const shownFiles = useMemo(
    () => (cursor ? files.slice(0, cursor.i + 1) : files),
    [cursor, files],
  );
  const writingPath = cursor ? files[cursor.i]?.path ?? null : null;

  let activePath = picked && files.some((f) => f.path === picked) ? picked : null;
  if (!activePath) activePath = writingPath ?? files[0]?.path ?? '';

  const getVisible = (path: string): string => {
    const idx = files.findIndex((f) => f.path === path);
    if (idx < 0) return '';
    if (!cursor || idx < cursor.i) return files[idx].content;
    if (idx === cursor.i) return files[idx].content.slice(0, cursor.n);
    return '';
  };

  return {
    streaming,
    shownFiles,
    writingPath,
    activePath,
    selectFile: (p: string) => setPicked(p),
    getVisible,
    skip,
  };
}
