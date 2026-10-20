import { Bot, FileDiff, GitCommit, Globe, PanelRight, Plus, SquareTerminal, X } from "lucide-react";
import { useState } from "react";
import { type Tab, useWorkspace } from "@/lib/store";
import { FileIcon } from "./FileIcon";
import { ContextMenu, type MenuItem } from "./ui";

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab.kind) {
    case "terminal":
      return <SquareTerminal size={14} strokeWidth={1.8} />;
    case "editor":
      return <FileIcon name={tab.title} size={14} />;
    case "preview":
      return <Globe size={14} strokeWidth={1.8} />;
    case "diff":
      return <FileDiff size={14} strokeWidth={1.8} />;
    case "commit":
      return <GitCommit size={14} strokeWidth={1.8} />;
    case "aiDiff":
      return <Bot size={14} strokeWidth={1.8} />;
  }
}

export function TabBar() {
  const tabs = useWorkspace((s) => s.tabs);
  const activeId = useWorkspace((s) => s.activeId);
  const setActive = useWorkspace((s) => s.setActive);
  const closeTab = useWorkspace((s) => s.closeTab);
  const openTerminal = useWorkspace((s) => s.openTerminal);
  const aiOpen = useWorkspace((s) => s.aiOpen);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const renamingId = useWorkspace((s) => s.renamingId);
  const updateTab = useWorkspace((s) => s.updateTab);
  const startRename = (id: string) => useWorkspace.getState().set({ renamingId: id });
  const finishRename = (t: Tab, value: string | null) => {
    useWorkspace.getState().set({ renamingId: null });
    if (value == null) return;
    const name = value.trim();
    // An empty name restores the default one.
    updateTab(t.id, { title: name || defaultTitle(t) });
  };

  const tabMenu = (e: React.MouseEvent, t: Tab) => {
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Rename", hint: "Double-click", run: () => startRename(t.id) },
        { label: "Close", hint: "Ctrl+Shift+W", run: () => closeTab(t.id) },
        { label: "Close Others", run: () => tabs.filter((x) => x.id !== t.id).forEach((x) => closeTab(x.id)) },
      ],
    });
  };

  const newMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: r.left,
      y: r.bottom + 4,
      items: [
        { label: "Terminal", hint: "Ctrl+Shift+T", run: () => openTerminal() },
        { label: "Open File…", hint: "Ctrl+P", run: () => useWorkspace.getState().set({ paletteOpen: true, paletteInitial: "" }) },
        {
          label: "Web Preview",
          run: () => useWorkspace.getState().openPreview(useWorkspace.getState().detectedUrls[0] ?? "http://localhost:5173"),
        },
      ],
    });
  };

  return (
    <div className="flex h-11 shrink-0 items-stretch border-b border-border">
      <div role="tablist" aria-label="Open tabs" className="no-scrollbar flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto px-3">
        {tabs.map((t) => {
          const active = t.id === activeId;
          const dirty = t.kind === "editor" && t.dirty;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setActive(t.id);
                if (e.key === "F2") startRename(t.id);
              }}
              onContextMenu={(e) => tabMenu(e, t)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(t.id);
                } else setActive(t.id);
              }}
              title={"path" in t ? t.path : "url" in t ? t.url : t.title}
              className={`group flex max-w-56 min-w-0 shrink-0 cursor-pointer items-center gap-2 border-b-2 pr-1.5 pl-3 text-[13px] font-medium ${
                active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              <span className={active ? "text-fg-soft" : "text-dim"}>
                <TabIcon tab={t} />
              </span>
              {renamingId === t.id ? (
                <RenameInput initial={t.title} onDone={(v) => finishRename(t, v)} />
              ) : (
                <span className="truncate" onDoubleClick={() => startRename(t.id)} title="Double-click to rename">
                  {t.title}
                </span>
              )}
              <button
                aria-label={`Close ${t.title}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => closeTab(t.id)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-hover"
              >
                {dirty && <span className="h-1.5 w-1.5 rounded-full bg-fg group-hover:hidden" />}
                <X size={12} className={dirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"} />
              </button>
            </div>
          );
        })}
        <button
          onClick={newMenu}
          aria-label="New tab"
          className="grid h-7 w-7 shrink-0 place-items-center self-center rounded-md text-muted hover:bg-hover hover:text-fg"
        >
          <Plus size={14} strokeWidth={1.8} />
        </button>
      </div>
      <button
        onClick={() => useWorkspace.getState().set({ aiOpen: !aiOpen })}
        aria-pressed={aiOpen}
        className={`mr-2 flex shrink-0 items-center gap-2 self-center rounded-md px-2.5 py-1.5 text-[12.5px] font-medium ${
          aiOpen ? "text-fg" : "text-muted hover:bg-hover hover:text-fg"
        }`}
        title="Toggle agent panel (Ctrl+I)"
      >
        <PanelRight size={14} strokeWidth={1.8} /> Agent
      </button>
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function defaultTitle(t: Tab) {
  if (t.kind === "terminal") return t.cwd.split("/").pop() || "Terminal";
  if (t.kind === "editor") return t.path.split("/").pop() || t.title;
  if (t.kind === "preview") return t.url.replace(/^https?:\/\//, "");
  return t.title;
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  return (
    <input
      autoFocus
      aria-label="Tab name"
      value={v}
      size={Math.max(6, v.length + 1)}
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.target.select()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onDone(v);
        if (e.key === "Escape") onDone(null);
      }}
      onBlur={() => onDone(v)}
      className="h-6 max-w-44 min-w-0 rounded-md border border-accent/60 bg-elevated px-1.5 text-[13px] font-medium text-fg outline-none"
    />
  );
}
