import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Bot, Files, FolderOpen, GitBranch, ListTodo, Search, SlidersHorizontal, SquareTerminal } from "lucide-react";
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
import { UpdateToast } from "./components/UpdateToast";
import { Kbd, Logo } from "./components/ui";
import { basename, ipc } from "./lib/ipc";
import { type SidebarPanel, type Tab, useSettings, useWorkspace } from "./lib/store";
import { applyTheme, findTheme } from "./lib/themes";
import { checkForUpdate, initUpdater } from "./lib/updater";

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
    void initUpdater();
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

function RailButton({ label, active, onClick, badge, children }: { label: string; active?: boolean; onClick: () => void; badge?: number; children: React.ReactNode }) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg"}`}
    >
      {active && <span className="absolute top-[9px] -left-2 h-[18px] w-0.5 rounded bg-accent" />}
      {children}
      {!!badge && (
        <span className="absolute top-1 right-0.5 h-3.5 min-w-3.5 rounded-full bg-accent px-[3px] text-center font-mono text-[9px] leading-[14px] font-semibold text-accent-fg">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function Rail() {
  const sidebar = useWorkspace((s) => s.sidebar);
  const toggle = useWorkspace((s) => s.toggleSidebar);
  const changes = useWorkspace((s) => s.git?.changes.length ?? 0);
  return (
    <nav aria-label="Panels" className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-border bg-bg py-3">
      <Logo size={28} className="mb-3.5" />
      {RAIL.map(({ id, icon: Icon, label }) => (
        <RailButton key={id} label={label} active={sidebar === id} onClick={() => toggle(id)} badge={id === "git" ? changes : 0}>
          <Icon size={18} strokeWidth={1.6} />
        </RailButton>
      ))}
      <div className="flex-1" />
      <RailButton label="Open Folder (Ctrl+O)" onClick={pickFolder}>
        <FolderOpen size={18} strokeWidth={1.6} />
      </RailButton>
      <RailButton label="Settings (Ctrl+,)" onClick={() => useWorkspace.getState().set({ settingsOpen: true })}>
        <SlidersHorizontal size={18} strokeWidth={1.6} />
      </RailButton>
    </nav>
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
    <div className="flex h-full items-center justify-center overflow-auto px-6 py-16">
      <div className="flex w-full max-w-[420px] flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Logo size={56} />
          <div>
            <h1 className="m-0 font-mono text-[32px] leading-tight font-bold tracking-tight">t-rax</h1>
            <p className="mt-2 text-[14px] leading-normal text-muted">Terminal, editor, git and agents. One window, no bloat.</p>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <WelcomeAction icon={SquareTerminal} label="New terminal" keys={["Ctrl", "⇧", "T"]} run={() => useWorkspace.getState().openTerminal()} />
          <WelcomeAction icon={Search} label="Go to file" keys={["Ctrl", "P"]} run={() => useWorkspace.getState().set({ paletteOpen: true, paletteInitial: "" })} />
          <WelcomeAction icon={FolderOpen} label="Open folder" keys={["Ctrl", "O"]} run={pickFolder} />
          <WelcomeAction icon={Bot} label="Ask the agent" keys={["Ctrl", "I"]} run={() => useWorkspace.getState().set({ aiOpen: true })} />
        </div>
        {recent.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="label px-3 pb-1">Recent</span>
            {recent.slice(0, 5).map((r) => (
              <button
                key={r}
                onClick={() => switchWorkspace(r)}
                className="flex justify-between gap-3 px-3 py-1 text-left text-fg-soft hover:text-fg"
              >
                <span className="truncate">{basename(r)}</span>
                <span className="truncate font-mono text-[12px] text-dim">{r.replace(/^\/home\/[^/]+/, "~").replace(/\/[^/]*$/, "")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeAction({ icon: Icon, label, keys, run }: { icon: typeof Bot; label: string; keys: string[]; run: () => void }) {
  return (
    <button onClick={run} className="flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[13.5px] font-medium hover:bg-elevated">
      <Icon size={16} strokeWidth={1.8} className="text-muted" />
      <span className="flex-1">{label}</span>
      <Kbd keys={keys} />
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
      { id: "update", label: "Check for Updates", run: () => void checkForUpdate(true) },
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
              <Panel id="side" defaultSize={260} minSize={200} maxSize={520} className="bg-panel/95">
                {sidePanel}
              </Panel>
              <Separator />
            </>
          )}
          <Panel id="main" minSize={300}>
            <div className="flex h-full flex-col bg-bg/85">
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
              <Panel id="ai" defaultSize={360} minSize={300} maxSize={720}>
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
      <UpdateToast />
      <SettingsModal />
    </div>
  );
}
