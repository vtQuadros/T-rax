import { CaseSensitive, Regex } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { basename, type GrepMatch, ipc, relPath } from "@/lib/ipc";
import { useWorkspace } from "@/lib/store";
import { IconBtn, PanelHeader } from "./Explorer";
import { FileIcon } from "./FileIcon";
import { inputCls } from "./ui";

export function SearchPanel() {
  const root = useWorkspace((s) => s.root);
  const openFile = useWorkspace((s) => s.openFile);
  const [q, setQ] = useState("");
  const [regex, setRegex] = useState(false);
  const [cs, setCs] = useState(false);
  const [results, setResults] = useState<GrepMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim() || !root) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setBusy(true);
      ipc
        .grep(root, q, { regex, caseSensitive: cs })
        .then((r) => !cancelled && (setResults(r), setError(null)))
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && setBusy(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, regex, cs, root]);

  const grouped = useMemo(() => {
    const m = new Map<string, GrepMatch[]>();
    for (const r of results) m.set(r.path, [...(m.get(r.path) ?? []), r]);
    return [...m.entries()];
  }, [results]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Search" />
      <div className="flex flex-col gap-2 px-3 pb-3">
        <div className="relative">
          <label htmlFor="grep-q" className="sr-only">
            Search in files
          </label>
          <input id="grep-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in files" className={`${inputCls} pr-16`} />
          <div className="absolute top-1 right-1 flex">
            <IconBtn title="Match case" active={cs} onClick={() => setCs(!cs)}>
              <CaseSensitive size={14} />
            </IconBtn>
            <IconBtn title="Regex" active={regex} onClick={() => setRegex(!regex)}>
              <Regex size={13} />
            </IconBtn>
          </div>
        </div>
        <div className="px-0.5 font-mono text-[11px] text-dim">
          {error ? <span className="text-red">{error}</span> : busy ? "Searching…" : q && `${results.length} results in ${grouped.length} files`}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {grouped.map(([path, matches]) => (
          <div key={path} className="mb-2">
            <div className="flex h-7 items-center gap-2 px-2 text-[13px]" title={path}>
              <FileIcon name={basename(path)} size={14} />
              <span className="truncate font-medium">{basename(path)}</span>
              <span className="truncate font-mono text-[11px] text-dim">{relPath(root, path)}</span>
            </div>
            {matches.map((m) => (
              <button
                key={m.line}
                onClick={() => openFile(m.path, m.line)}
                className="row flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-6 text-left font-mono text-[12px] text-fg-soft hover:bg-elevated"
              >
                <span className="w-8 shrink-0 text-right text-dim">{m.line}</span>
                <span className="truncate">{m.text}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
