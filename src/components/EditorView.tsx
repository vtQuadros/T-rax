import { EditorSelection } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiAutocomplete } from "@/ai/autocomplete";
import { useEditorTheme } from "@/lib/editorTheme";
import { ipc } from "@/lib/ipc";
import { languageFor } from "@/lib/lang";
import { useSettings, useWorkspace } from "@/lib/store";

/** Open editor views by path, so the AI can read the active file/selection. */
export const editors = new Map<string, EditorView>();

export function EditorView_({ tabId, path, line, active }: { tabId: string; path: string; line?: number; active: boolean }) {
  const [doc, setDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef("");
  const cm = useRef<ReactCodeMirrorRef>(null);
  const theme = useEditorTheme();
  const vimMode = useSettings((s) => s.vim);
  const fontSize = useSettings((s) => s.fontSize);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const updateTab = useWorkspace((s) => s.updateTab);

  // Load, and reload when files change on disk (e.g. an applied AI edit) unless dirty.
  useEffect(() => {
    let cancelled = false;
    ipc
      .readFile(path)
      .then((text) => {
        if (cancelled) return;
        const view = cm.current?.view;
        const current = view?.state.doc.toString();
        if (current != null && current !== saved.current) return; // unsaved edits win
        saved.current = text;
        if (view && current !== text) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
        setDoc((d) => d ?? text);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [path, fsVersion]);

  const save = async (view: EditorView) => {
    const text = view.state.doc.toString();
    await ipc.writeFile(path, text);
    saved.current = text;
    updateTab(tabId, { dirty: false });
    useWorkspace.getState().bumpFs();
    return true;
  };

  const extensions = useMemo(
    () => [
      ...(vimMode ? [vim()] : []),
      ...languageFor(path),
      aiAutocomplete(path),
      keymap.of([{ key: "Mod-s", run: (v) => (void save(v), true) }]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) updateTab(tabId, { dirty: u.state.doc.toString() !== saved.current });
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, vimMode, tabId],
  );

  // Jump to a line (from search results / AI references).
  useEffect(() => {
    const view = cm.current?.view;
    if (!view || !line || doc == null) return;
    const l = view.state.doc.line(Math.min(line, view.state.doc.lines));
    view.dispatch({ selection: EditorSelection.cursor(l.from), effects: EditorView.scrollIntoView(l.from, { y: "center" }) });
    view.focus();
  }, [line, doc]);

  useEffect(() => {
    if (active) requestAnimationFrame(() => cm.current?.view?.focus());
  }, [active]);

  useEffect(() => () => void editors.delete(path), [path]);

  if (error) return <div className="p-6 text-muted">Cannot open {path}: {error}</div>;
  if (doc == null) return <div className="p-6 text-muted">Loading…</div>;

  return (
    <div className="h-full" style={{ ["--editor-font-size" as string]: `${fontSize}px` }}>
      <CodeMirror
        ref={cm}
        value={doc}
        height="100%"
        theme={theme}
        extensions={extensions}
        onCreateEditor={(view) => editors.set(path, view)}
        basicSetup={{ highlightActiveLine: true, foldGutter: true, tabSize: 2 }}
        className="h-full"
      />
    </div>
  );
}

export { EditorView_ as EditorPane };
