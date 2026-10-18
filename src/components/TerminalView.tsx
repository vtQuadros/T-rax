import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef } from "react";
import { ipc } from "@/lib/ipc";
import { useSettings, useWorkspace } from "@/lib/store";
import { findTheme, terminalTheme } from "@/lib/themes";

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)/g;
const DEV_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{2,5}\/?[^\s'"]*/g;

/** Live PTY handles, so other modules (AI, palette) can write into a terminal. */
export const terminals = new Map<string, { write: (s: string) => void; term: Terminal }>();

export function TerminalView({ tabId, cwd, active }: { tabId: string; cwd: string; active: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const themeId = useSettings((s) => s.appTheme);
  const custom = useSettings((s) => s.customThemes);
  const fontSize = useSettings((s) => s.fontSize);

  useEffect(() => {
    const s = useSettings.getState();
    const term = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: s.fontSize,
      lineHeight: 1.2,
      scrollback: 10000,
      theme: terminalTheme(findTheme(s.appTheme, s.customThemes)),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_e, uri) => void openUrl(uri)));
    term.open(host.current!);
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Falls back to the DOM renderer when WebGL is unavailable.
    }
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let ptyId: number | null = null;
    let disposed = false;
    const pending: string[] = [];
    const write = (d: string) => (ptyId == null ? pending.push(d) : void ipc.ptyWrite(ptyId, d));

    ipc
      .ptyOpen(term.cols, term.rows, cwd, (e) => {
        if (e.type === "data") {
          term.write(e.data);
          const plain = e.data.replace(ANSI, "");
          for (const m of plain.matchAll(DEV_URL)) {
            useWorkspace.getState().addDetectedUrl(m[0].replace("0.0.0.0", "localhost").replace(/[.,)]+$/, ""));
          }
        } else {
          term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
        }
      })
      .then((id) => {
        if (disposed) return void ipc.ptyClose(id);
        ptyId = id;
        for (const d of pending.splice(0)) void ipc.ptyWrite(id, d);
      })
      .catch((err) => term.write(`\x1b[31mFailed to start shell: ${err}\x1b[0m\r\n`));

    const sub = term.onData(write);
    const resize = term.onResize(({ cols, rows }) => ptyId != null && void ipc.ptyResize(ptyId, cols, rows));
    const ro = new ResizeObserver(() => {
      if (host.current?.offsetParent) fit.fit();
    });
    ro.observe(host.current!);
    terminals.set(tabId, { write, term });

    return () => {
      disposed = true;
      terminals.delete(tabId);
      ro.disconnect();
      sub.dispose();
      resize.dispose();
      if (ptyId != null) void ipc.ptyClose(ptyId);
      term.dispose();
    };
    // The PTY lives for the lifetime of the tab; cwd is only the starting dir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalTheme(findTheme(themeId, custom));
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [themeId, custom, fontSize]);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
        termRef.current?.focus();
      });
    }
  }, [active]);

  return <div ref={host} className="h-full w-full" onClick={() => termRef.current?.focus()} />;
}
