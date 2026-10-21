import { ChevronRight, FilePlus, FolderPlus, Link2, Link2Off, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { basename, type DirEntry, dirname, ipc, joinPath } from "@/lib/ipc";
import { useSettings, useWorkspace } from "@/lib/store";
import { FileIcon } from "./FileIcon";
import { ContextMenu, type MenuItem } from "./ui";

type Row = { entry: DirEntry; depth: number };
type Draft = { kind: "file" | "dir" | "rename"; parent: string; target?: string };

export function Explorer() {
  // Follows the active terminal's directory (see TerminalView); falls back to the project.
  const root = useWorkspace((s) => s.explorerRoot || s.root);
  const follow = useSettings((s) => s.followTerminal);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const openFile = useWorkspace((s) => s.openFile);
  const openTerminal = useWorkspace((s) => s.openTerminal);
  const bumpFs = useWorkspace((s) => s.bumpFs);
  const showHidden = useSettings((s) => s.showHidden);
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (dir: string) => {
      try {
        const entries = await ipc.readDir(dir, showHidden);
        setChildren((c) => ({ ...c, [dir]: entries }));
      } catch {
        setChildren((c) => ({ ...c, [dir]: [] }));
      }
    },
    [showHidden],
  );

  useEffect(() => {
    setExpanded(new Set());
    setChildren({});
  }, [root]);

  // Refresh root and every expanded folder on fs changes.
  useEffect(() => {
    if (!root) return;
    void load(root);
    for (const d of expanded) void load(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, fsVersion, load]);

  // Cheap polling keeps the tree in sync with changes made from the terminal.
  useEffect(() => {
    if (!root) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      void load(root);
      for (const d of expanded) void load(d);
    }, 3000);
    return () => clearInterval(t);
  }, [root, expanded, load]);

  // Git status per absolute path; folders get a dot when anything inside changed.
  const git = useWorkspace((s) => s.git);
  const gitMarks = useMemo(() => {
    const files = new Map<string, string>();
    const dirs = new Set<string>();
    for (const c of git?.changes ?? []) {
      const abs = `${git!.root}/${c.path}`;
      if (!files.has(abs) || !c.staged) files.set(abs, c.status === "?" ? "U" : c.status);
      for (let d = dirname(abs); d.length > git!.root.length; d = dirname(d)) dirs.add(d);
    }
    return { files, dirs };
  }, [git]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (dir: string, depth: number) => {
      for (const e of children[dir] ?? []) {
        out.push({ entry: e, depth });
        if (e.isDir && expanded.has(e.path)) walk(e.path, depth + 1);
      }
    };
    walk(root, 0);
    return out;
  }, [children, expanded, root]);

  const toggle = (path: string, open?: boolean) => {
    setExpanded((s) => {
      const n = new Set(s);
      const willOpen = open ?? !n.has(path);
      if (willOpen) {
        n.add(path);
        void load(path);
      } else n.delete(path);
      return n;
    });
  };

  const activate = (e: DirEntry) => {
    setSelected(e.path);
    if (e.isDir) toggle(e.path);
    else openFile(e.path);
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (draft) return;
    const i = rows.findIndex((r) => r.entry.path === selected);
    const cur = rows[i]?.entry;
    if (ev.key === "ArrowDown") setSelected(rows[Math.min(rows.length - 1, i + 1)]?.entry.path ?? null);
    else if (ev.key === "ArrowUp") setSelected(rows[Math.max(0, i - 1)]?.entry.path ?? null);
    else if (ev.key === "ArrowRight" && cur?.isDir) toggle(cur.path, true);
    else if (ev.key === "ArrowLeft" && cur) {
      if (cur.isDir && expanded.has(cur.path)) toggle(cur.path, false);
      else if (dirname(cur.path) !== root) setSelected(dirname(cur.path));
    } else if (ev.key === "Enter" && cur) activate(cur);
    else if (ev.key === "F2" && cur) setDraft({ kind: "rename", parent: dirname(cur.path), target: cur.path });
    else if (ev.key === "Delete" && cur) void remove(cur.path);
    else return;
    ev.preventDefault();
  };

  const remove = async (path: string) => {
    if (!confirm(`Delete ${basename(path)}?`)) return;
    await ipc.remove(path);
    bumpFs();
  };

  const commitDraft = async (name: string) => {
    const d = draft;
    setDraft(null);
    if (!d || !name.trim()) return;
    const target = joinPath(d.parent, name.trim());
    try {
      if (d.kind === "file") {
        await ipc.createFile(target);
        openFile(target);
      } else if (d.kind === "dir") await ipc.createDir(target);
      else if (d.target && d.target !== target) await ipc.rename(d.target, target);
      if (d.parent !== root) toggle(d.parent, true);
      setSelected(target);
      bumpFs();
    } catch (e) {
      alert(String(e));
    }
  };

  const contextMenu = (ev: React.MouseEvent, e?: DirEntry) => {
    ev.preventDefault();
    const dir = e ? (e.isDir ? e.path : dirname(e.path)) : root;
    const items: MenuItem[] = [
      { label: "New File", run: () => setDraft({ kind: "file", parent: dir }) },
      { label: "New Folder", run: () => setDraft({ kind: "dir", parent: dir }) },
      { label: "Open Terminal Here", run: () => openTerminal(dir) },
    ];
    if (e) {
      items.push(
        { label: "Rename", hint: "F2", run: () => setDraft({ kind: "rename", parent: dirname(e.path), target: e.path }) },
        { label: "Copy Path", run: () => void navigator.clipboard.writeText(e.path) },
        { label: "Open in System App", run: () => void ipc.openDefault(e.path) },
        { label: "Delete", hint: "Del", danger: true, run: () => void remove(e.path) },
      );
    }
    setMenu({ x: ev.clientX, y: ev.clientY, items });
  };

  useEffect(() => {
    if (selected) listRef.current?.querySelector(`[data-path="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const draftRow = (parent: string, depth: number) =>
    draft && draft.kind !== "rename" && draft.parent === parent ? (
      <DraftInput depth={depth} isDir={draft.kind === "dir"} initial="" onDone={commitDraft} />
    ) : null;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={basename(root) || "/"} tooltip={root}>
        <IconBtn
          title={follow ? "Following the terminal (click to pin this folder)" : "Pinned (click to follow the terminal)"}
          active={follow}
          onClick={() => useSettings.getState().set({ followTerminal: !follow })}
        >
          {follow ? <Link2 size={14} strokeWidth={1.8} /> : <Link2Off size={14} strokeWidth={1.8} />}
        </IconBtn>
        <IconBtn title="New File" onClick={() => setDraft({ kind: "file", parent: root })}>
          <FilePlus size={14} strokeWidth={1.8} />
        </IconBtn>
        <IconBtn title="New Folder" onClick={() => setDraft({ kind: "dir", parent: root })}>
          <FolderPlus size={14} strokeWidth={1.8} />
        </IconBtn>
        <IconBtn title="Refresh" onClick={bumpFs}>
          <RefreshCw size={13} strokeWidth={1.8} />
        </IconBtn>
      </PanelHeader>
      <div
        ref={listRef}
        tabIndex={0}
        onKeyDown={onKey}
        onContextMenu={(e) => contextMenu(e)}
        aria-label="Files"
        className="flex-1 overflow-auto px-2 py-0.5 outline-none"
      >
        {draftRow(root, 0)}
        {rows.map(({ entry, depth }) =>
          draft?.kind === "rename" && draft.target === entry.path ? (
            <DraftInput key={entry.path} depth={depth} isDir={entry.isDir} initial={entry.name} onDone={commitDraft} />
          ) : (
            <div key={entry.path}>
              <div
                data-path={entry.path}
                onClick={() => activate(entry)}
                onContextMenu={(ev) => {
                  ev.stopPropagation();
                  setSelected(entry.path);
                  contextMenu(ev, entry);
                }}
                className={`row flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px] ${
                  selected === entry.path ? "bg-hover text-fg" : "text-fg-soft hover:bg-elevated"
                }`}
                style={{ paddingLeft: 8 + depth * 16 }}
              >
                <ChevronRight
                  size={12}
                  strokeWidth={2}
                  className={`shrink-0 text-dim transition-transform ${entry.isDir ? "" : "invisible"} ${
                    expanded.has(entry.path) ? "rotate-90" : ""
                  }`}
                />
                <FileIcon name={entry.name} isDir={entry.isDir} open={expanded.has(entry.path)} size={15} />
                <span className="flex-1 truncate">{entry.name}</span>
                <GitMark status={entry.isDir ? (gitMarks.dirs.has(entry.path) ? "dir" : undefined) : gitMarks.files.get(entry.path)} />
              </div>
              {entry.isDir && expanded.has(entry.path) && draftRow(entry.path, depth + 1)}
            </div>
          ),
        )}
      </div>
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function DraftInput({ depth, isDir, initial, onDone }: { depth: number; isDir: boolean; initial: string; onDone: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex h-7 items-center gap-1.5 pr-2" style={{ paddingLeft: 26 + depth * 16 }}>
      <FileIcon name={v || "file"} isDir={isDir} />
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.setSelectionRange(0, initial.lastIndexOf(".") > 0 ? initial.lastIndexOf(".") : initial.length)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onDone(v);
          if (e.key === "Escape") onDone("");
          e.stopPropagation();
        }}
        onBlur={() => onDone(v)}
        className="h-6 flex-1 rounded-md border border-accent/60 bg-elevated px-1.5 text-[13px] outline-none"
      />
    </div>
  );
}

export const STATUS_COLOR: Record<string, string> = {
  M: "text-yellow",
  A: "text-accent",
  U: "text-accent",
  "?": "text-accent",
  D: "text-red",
  R: "text-blue",
};

/** Git status as a letter (never colour alone); folders get a quiet dot. */
function GitMark({ status }: { status?: string }) {
  if (!status) return null;
  if (status === "dir") return <span aria-label="contains changes" className="h-1.5 w-1.5 shrink-0 rounded-full bg-dim" />;
  return <span className={`shrink-0 font-mono text-[11px] font-medium ${STATUS_COLOR[status] ?? "text-muted"}`}>{status}</span>;
}

export function PanelHeader({ title, tooltip, children }: { title: string; tooltip?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between pr-2 pl-4">
      <span className="label truncate" title={tooltip}>
        {title}
      </span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export function IconBtn({ title, onClick, children, active }: { title: string; onClick?: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg ${active ? "bg-hover text-fg" : ""}`}
    >
      {children}
    </button>
  );
}
