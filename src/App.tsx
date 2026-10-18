import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Bot, Files, FolderOpen, GitBranch, ListTodo, Search, Settings, SquareTerminal } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useChat } from "./ai/store";
import { AiDiffView } from "./components/AiDiffView";
import { AiPanel } from "./components/AiPanel";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { CommitView, DiffView } from "./components/DiffView";
import { EditorPane } from "./components/EditorView";
import { Explorer } from "./components/Explorer";
import { PreviewView } from "./components/PreviewView";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsModal } from "./components/SettingsModal";
import { SourceControl } from "./components/SourceControl";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { TasksPanel } from "./components/TasksPanel";
import { TerminalView } from "./components/TerminalView";
import { basename, ipc } from "./lib/ipc";
import { type SidebarPanel, type Tab, useSettings, useWorkspace } from "./lib/store";
import { applyTheme, findTheme } from "./lib/themes";

async function pickFolder() {
  const dir = await openDialog({ directory: true, multiple: false });
  if (typeof dir === "string") switchWorkspace(dir);
}

function switchWorkspace(dir: string) {
  const ws = useWorkspace.getState();
  if (dir === ws.root) return;
  useChat.getState().reset();
  ws.set({ tabs: [], activeId: null });
  ws.setRoot(dir);
  ws.openTerminal(dir);
}

let booted = false;
function useBoot() {
  useEffect(() => {
    if (booted) return;
    booted = true;
    (async () => {
      const launch = await ipc.launchDir().catch(() => null);
      const recent = useSettings.getState().recentWorkspaces[0];
      const dir = launch ?? recent ?? (await ipc.home());
      const ok = await ipc.readDir(dir).then(() => true, () => false);
      switchWorkspace(ok ? dir : await ipc.home());
    })();
  }, []);
}

function useThemeSync() {
  const themeId = useSettings((s) => s.appTheme);
  const custom = useSettings((s) => s.customThemes);
  useEffect(() => applyTheme(findTheme(themeId, custom)), [themeId, custom]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ws = useWorkspace.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Inside the terminal only Ctrl+Shift chords are ours; plain Ctrl keys belong to the shell.
      const inTerminal = !!(document.activeElement as HTMLElement | null)?.closest(".xterm");
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      if (e.shiftKey) {
        if (k === "p") return run(() => ws.set({ paletteOpen: true, paletteInitial: ">" }));
        if (k === "t") return run(() => ws.openTerminal());
        if (k === "w") return run(() => ws.activeId && ws.closeTab(ws.activeId));
        if (k === "f") return run(() => ws.setSidebar("search"));
        if (k === "g") return run(() => ws.setSidebar("git"));
        if (k === "e") return run(() => ws.setSidebar("explorer"));
        if (k === "k") return run(() => ws.setSidebar("tasks"));
        if (k === "i") return run(() => ws.set({ aiOpen: !ws.aiOpen }));
        return;
      }
      if (e.key === "Tab") {
        return run(() => {
          const i = ws.tabs.findIndex((t) => t.id === ws.activeId);
          const n = ws.tabs.length;
          if (n) ws.setActive(ws.tabs[(i + (e.shiftKey ? n - 1 : 1)) % n].id);
        });
      }
      if (inTerminal) return;
      if (k === "p") return run(() => ws.set({ paletteOpen: true, paletteInitial: "" }));
      if (k === "b") return run(() => ws.set({ sidebar: ws.sidebar ? null : "explorer" }));
      if (k === "i") return run(() => ws.set({ aiOpen: !ws.aiOpen }));
      if (k === ",") return run(() => ws.set({ settingsOpen: true }));
      if (k === "o") return run(() => void pickFolder());
      if (/^[1-9]$/.test(k)) return run(() => ws.tabs[+k - 1] && ws.setActive(ws.tabs[+k - 1].id));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

const RAIL: { id: Exclude<SidebarPanel, null>; icon: typeof Files; label: string }[] = [
  { id: "explorer", icon: Files, label: "Explorer (Ctrl+Shift+E)" },
  { id: "search", icon: Search, label: "Search (Ctrl+Shift+F)" },
  { id: "git", icon: GitBranch, label: "Source Control (Ctrl+Shift+G)" },
  { id: "tasks", icon: ListTodo, label: "Plans & Tasks (Ctrl+Shift+K)" },
];

function Rail() {
  const sidebar = useWorkspace((s) => s.sidebar);
  const toggle = useWorkspace((s) => s.toggleSidebar);
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-2">
      {RAIL.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => toggle(id)}
          className={`relative grid h-9 w-9 place-items-center rounded-md ${sidebar === id ? "text-fg" : "text-muted hover:text-fg"}`}
        >
          {sidebar === id && <span className="absolute top-2 bottom-2 -left-1 w-0.5 rounded bg-accent" />}
          <Icon size={18} strokeWidth={1.6} />
        </button>
      ))}
      <div className="flex-1" />
      <button title="Open Folder (Ctrl+O)" onClick={pickFolder} className="grid h-9 w-9 place-items-center text-muted hover:text-fg">
        <FolderOpen size={17} strokeWidth={1.6} />
      </button>
      <button
        title="Settings (Ctrl+,)"
        onClick={() => useWorkspace.getState().set({ settingsOpen: true })}
        className="grid h-9 w-9 place-items-center text-muted hover:text-fg"
      >
        <Settings size={17} strokeWidth={1.6} />
      </button>
    </div>
  );
}

function TabContent({ tab, active }: { tab: Tab; active: boolean }) {
  switch (tab.kind) {
    case "terminal":
      return <TerminalView tabId={tab.id} cwd={tab.cwd} active={active} />;
    case "editor":
      return <EditorPane tabId={tab.id} path={tab.path} line={tab.line} active={active} />;
    case "preview":
      return <PreviewView tabId={tab.id} url={tab.url} />;
    case "diff":
      return <DiffView root={tab.root} path={tab.path} staged={tab.staged} />;
    case "commit":
      return <CommitView root={tab.root} hash={tab.hash} />;
    case "aiDiff":
      return <AiDiffView editId={tab.editId} />;
  }
}

function Welcome() {
  const recent = useSettings((s) => s.recentWorkspaces);
  return (
    <div className="grid h-full place-items-center">
      <div className="w-80 space-y-5 text-center">
        <div className="text-2xl font-semibold tracking-tight">T-rax</div>
        <div className="grid gap-1.5 text-left text-[12.5px]">
          <WelcomeAction icon={SquareTerminal} label="New Terminal" hint="Ctrl+Shift+T" run={() => useWorkspace.getState().openTerminal()} />
          <WelcomeAction icon={Search} label="Go to File" hint="Ctrl+P" run={() => useWorkspace.getState().set({ paletteOpen: true, paletteInitial: "" })} />
          <WelcomeAction icon={FolderOpen} label="Open Folder" hint="Ctrl+O" run={pickFolder} />
          <WelcomeAction icon={Bot} label="Ask the Agent" hint="Ctrl+I" run={() => useWorkspace.getState().set({ aiOpen: true })} />
        </div>
        {recent.length > 1 && (
          <div className="space-y-1 text-left">
            <div className="text-[11px] tracking-wider text-muted uppercase">Recent</div>
            {recent.slice(0, 5).map((r) => (
              <button key={r} onClick={() => switchWorkspace(r)} className="block w-full truncate text-left text-[12px] text-blue hover:underline">
                {basename(r)} <span className="text-muted">{r.replace(/^\/home\/[^/]+/, "~")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeAction({ icon: Icon, label, hint, run }: { icon: typeof Bot; label: string; hint: string; run: () => void }) {
  return (
    <button onClick={run} className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-hover">
      <Icon size={15} className="text-muted" />
      {label}
      <span className="ml-auto text-[11px] text-muted">{hint}</span>
    </button>
  );
}

export default function App() {
  useBoot();
  useThemeSync();
  useShortcuts();
  const tabs = useWorkspace((s) => s.tabs);
  const activeId = useWorkspace((s) => s.activeId);
  const sidebar = useWorkspace((s) => s.sidebar);
  const aiOpen = useWorkspace((s) => s.aiOpen);
  const root = useWorkspace((s) => s.root);
  const bg = useSettings(useShallow((s) => ({ image: s.bgImage, opacity: s.bgOpacity, blur: s.bgBlur })));

  useEffect(() => {
    document.title = root ? `${basename(root)} — T-rax` : "T-rax";
  }, [root]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const ws = () => useWorkspace.getState();
    const s = () => useSettings.getState();
    return [
      { id: "term", label: "New Terminal", hint: "Ctrl+Shift+T", run: () => ws().openTerminal() },
      { id: "open", label: "Open Folder…", hint: "Ctrl+O", run: () => void pickFolder() },
      { id: "close", label: "Close Tab", hint: "Ctrl+Shift+W", run: () => ws().activeId && ws().closeTab(ws().activeId!) },
      { id: "preview", label: "Open Web Preview", run: () => ws().openPreview(ws().detectedUrls[0] ?? "http://localhost:5173") },
      { id: "ai", label: "Toggle Agent Panel", hint: "Ctrl+I", run: () => ws().set({ aiOpen: !ws().aiOpen }) },
      { id: "newchat", label: "Agent: New Chat", run: () => useChat.getState().reset() },
      { id: "settings", label: "Settings", hint: "Ctrl+,", run: () => ws().set({ settingsOpen: true }) },
      { id: "vim", label: "Toggle Vim Mode", run: () => s().set({ vim: !s().vim }) },
      { id: "hidden", label: "Toggle Hidden Files", run: () => s().set({ showHidden: !s().showHidden }) },
      { id: "memory", label: "Edit Project Memory (TRAX.md)", run: () => ws().openFile(`${ws().root}/TRAX.md`) },
      { id: "zoomin", label: "Increase Font Size", run: () => s().set({ fontSize: Math.min(22, s().fontSize + 1) }) },
      { id: "zoomout", label: "Decrease Font Size", run: () => s().set({ fontSize: Math.max(10, s().fontSize - 1) }) },
    ];
  }, []);

  const sidePanel =
    sidebar === "explorer" ? <Explorer /> : sidebar === "search" ? <SearchPanel /> : sidebar === "git" ? <SourceControl /> : sidebar === "tasks" ? <TasksPanel /> : null;

  return (
    <div className="relative flex h-full flex-col">
      {bg.image && (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("${bg.image.startsWith("/") ? convertFileSrc(bg.image) : bg.image}")`,
            opacity: bg.opacity,
            filter: `blur(${bg.blur}px)`,
          }}
        />
      )}
      <div className="relative z-10 flex min-h-0 flex-1">
        <Rail />
        <Group orientation="horizontal" className="min-w-0 flex-1">
          {sidePanel && (
            <>
              <Panel id="side" defaultSize={260} minSize={180} maxSize={520} className="bg-panel/95">
                {sidePanel}
              </Panel>
              <Separator />
            </>
          )}
          <Panel id="main" minSize={300}>
            <div className="flex h-full flex-col bg-bg/80">
              <TabBar />
              <div className="relative min-h-0 flex-1">
                {tabs.map((t) => (
                  // Every tab stays mounted so terminals keep their PTY and editors their state.
                  <div key={t.id} className="absolute inset-0" style={{ display: t.id === activeId ? "block" : "none" }}>
                    <TabContent tab={t} active={t.id === activeId} />
                  </div>
                ))}
                {!tabs.length && <Welcome />}
              </div>
            </div>
          </Panel>
          {aiOpen && (
            <>
              <Separator />
              <Panel id="ai" defaultSize={380} minSize={280} maxSize={720}>
                <AiPanel />
              </Panel>
            </>
          )}
        </Group>
      </div>
      <div className="relative z-10">
        <StatusBar />
      </div>
      <CommandPalette commands={commands} />
      <SettingsModal />
    </div>
  );
}
