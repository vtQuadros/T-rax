import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { ipc } from "@/lib/ipc";

export type MediaFile = { src: string; size: number; modified: number };

/**
 * Grants the webview access to this one file and returns a cache-busted URL for it.
 * While `active`, the file is re-checked so edits on disk show up without reopening.
 */
export function useMediaFile(path: string, active: boolean) {
  const [file, setFile] = useState<MediaFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let last = -1;
    const load = async () => {
      try {
        const st = await ipc.stat(path);
        if (!alive || st.modified === last) return;
        if (last === -1) await ipc.mediaAllow(path);
        last = st.modified;
        const url = convertFileSrc(path);
        setFile({ src: `${url}${url.includes("?") ? "&" : "?"}v=${st.modified}`, size: st.size, modified: st.modified });
        setError(null);
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    void load();
    const t = active ? setInterval(() => !document.hidden && void load(), 2000) : undefined;
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path, active]);

  return { file, error };
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Ctrl+wheel zoom. Needs a native non-passive listener so the webview itself doesn't zoom. */
export function useCtrlWheel(ref: React.RefObject<HTMLElement | null>, onStep: (dir: 1 | -1) => void) {
  const cb = useRef(onStep);
  cb.current = onStep;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      cb.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [ref]);
}
