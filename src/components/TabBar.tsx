import { Bot, Code2, Columns2, FileDiff, Globe, GitCommit, Plus, SquareTerminal, X } from "lucide-react";
import { useState } from "react";
import { type Tab, useWorkspace } from "@/lib/store";
import { FileIcon } from "./FileIcon";
import { ContextMenu, type MenuItem } from "./ui";

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab.kind) {
    case "terminal":
      return <SquareTerminal size={13} className="text-muted" />;
    case "editor":
      return <FileIcon name={tab.title} size={14} />;
    case "preview":
      return <Globe size={13} className="text-blue" />;
    case "diff":
      return <FileDiff size={13} className="text-yellow" />;
    case "commit":
      return <GitCommit size={13} className="text-magenta" />;
    case "aiDiff":
      return <Bot size={13} className="text-green" />;
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

  const newMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: r.left,
      y: r.bottom + 4,
      items: [
        { label: "Terminal", hint: "Ctrl+T", run: () => openTerminal() },
        { label: "Open File…", hint: "Ctrl+P", run: () => useWorkspace.getState().set({ paletteOpen: true }) },
        {
          label: "Web Preview",
          run: () => useWorkspace.getState().openPreview(useWorkspace.getState().detectedUrls[0] ?? "http://localhost:5173"),
        },
      ],
    });
  };

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-panel">
      <div className="flex min-w-0 flex-1 items-stretch no-scrollbar overflow-x-auto">
        {tabs.map((t) => (
          <div
            key={t.id}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(t.id);
              } else setActive(t.id);
            }}
            title={"path" in t ? t.path : "url" in t ? t.url : t.title}
            className={`group relative flex max-w-52 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border pr-1.5 pl-3 text-[12px] ${
              t.id === activeId ? "bg-bg text-fg" : "text-muted hover:bg-hover/50 hover:text-fg"
            }`}
          >
            {t.id === activeId && <span className="absolute inset-x-0 top-0 h-px bg-accent" />}
            <TabIcon tab={t} />
            <span className="truncate">{t.title}</span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => closeTab(t.id)}
              className="grid h-4 w-4 shrink-0 place-items-center rounded hover:bg-hover"
            >
              {t.kind === "editor" && t.dirty ? (
                <span className="h-2 w-2 rounded-full bg-fg group-hover:hidden" />
              ) : null}
              <X size={12} className={t.kind === "editor" && t.dirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"} />
            </button>
          </div>
        ))}
        <button onClick={newMenu} className="grid w-8 shrink-0 place-items-center text-muted hover:text-fg" title="New tab">
          <Plus size={14} />
        </button>
      </div>
      <button
        onClick={() => useWorkspace.getState().set({ aiOpen: !aiOpen })}
        className={`flex shrink-0 items-center gap-1.5 border-l border-border px-3 text-[12px] ${aiOpen ? "text-fg" : "text-muted hover:text-fg"}`}
        title="Toggle agent panel (Ctrl+I)"
      >
        {aiOpen ? <Columns2 size={13} /> : <Code2 size={13} />} Agent
      </button>
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
