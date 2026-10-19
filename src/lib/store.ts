import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppTheme } from "./themes";
import { basename, type GitStatus } from "./ipc";

export type ProviderKind = "openai" | "anthropic";

export type AiSettings = {
  provider: ProviderKind;
  /** OpenAI-compatible base URL: OpenAI, LM Studio, Groq, OpenRouter, Ollama… */
  baseUrl: string;
  apiKey: string;
  model: string;
  autocomplete: boolean;
  autocompleteModel: string;
};

export type Snippet = { name: string; prompt: string };

export type Settings = {
  appTheme: string;
  editorTheme: string; // "auto" follows the app theme
  customThemes: AppTheme[];
  fontSize: number;
  vim: boolean;
  showHidden: boolean;
  coloredIcons: boolean;
  autoUpdateCheck: boolean;
  skippedVersion: string;
  bgImage: string;
  bgOpacity: number;
  bgBlur: number;
  ai: AiSettings;
  snippets: Snippet[];
  recentWorkspaces: string[];
};

const DEFAULT_SETTINGS: Settings = {
  appTheme: "t-rax-default",
  editorTheme: "auto",
  customThemes: [],
  fontSize: 13,
  vim: false,
  showHidden: false,
  coloredIcons: false,
  autoUpdateCheck: true,
  skippedVersion: "",
  bgImage: "",
  bgOpacity: 0.15,
  bgBlur: 8,
  ai: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    autocomplete: false,
    autocompleteModel: "",
  },
  snippets: [
    { name: "explain", prompt: "Explain what the currently open file does, section by section." },
    { name: "review", prompt: "Review the uncommitted git changes in this project and point out bugs." },
    { name: "tests", prompt: "Write tests for the currently open file, following the project's conventions." },
  ],
  recentWorkspaces: [],
};

export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void; setAi: (p: Partial<AiSettings>) => void }>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (p) => set(p),
      setAi: (p) => set((s) => ({ ai: { ...s.ai, ...p } })),
    }),
    {
      name: "t-rax:settings",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, ai: { ...current.ai, ...(p.ai ?? {}) } };
      },
    },
  ),
);

export type Tab =
  | { id: string; kind: "terminal"; title: string; cwd: string }
  | { id: string; kind: "editor"; title: string; path: string; dirty?: boolean; line?: number }
  | { id: string; kind: "preview"; title: string; url: string }
  | { id: string; kind: "diff"; title: string; root: string; path: string; staged: boolean }
  | { id: string; kind: "commit"; title: string; root: string; hash: string }
  | { id: string; kind: "aiDiff"; title: string; editId: string };

let seq = 0;
export const newId = (p = "t") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export type SidebarPanel = "explorer" | "search" | "git" | "tasks" | null;

type Workspace = {
  root: string;
  tabs: Tab[];
  activeId: string | null;
  sidebar: SidebarPanel;
  aiOpen: boolean;
  paletteOpen: boolean;
  paletteInitial: string;
  settingsOpen: boolean;
  detectedUrls: string[];
  /** Bumped to make the explorer / git panels refresh. */
  fsVersion: number;
  /** Latest `git status` of the workspace, shared by the rail, explorer and status bar. */
  git: GitStatus | null;
  setRoot: (root: string) => void;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;
  openFile: (path: string, line?: number) => void;
  openTerminal: (cwd?: string) => void;
  openPreview: (url: string) => void;
  setSidebar: (p: SidebarPanel) => void;
  toggleSidebar: (p: Exclude<SidebarPanel, null>) => void;
  set: (p: Partial<Workspace>) => void;
  addDetectedUrl: (url: string) => void;
  bumpFs: () => void;
};

export const useWorkspace = create<Workspace>((set, get) => ({
  root: "",
  tabs: [],
  activeId: null,
  sidebar: "explorer",
  aiOpen: true,
  paletteOpen: false,
  paletteInitial: "",
  settingsOpen: false,
  detectedUrls: [],
  fsVersion: 0,
  git: null,
  setRoot: (root) => {
    set({ root, detectedUrls: [], git: null });
    const s = useSettings.getState();
    s.set({ recentWorkspaces: [root, ...s.recentWorkspaces.filter((r) => r !== root)].slice(0, 10) });
  },
  openTab: (tab) => set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id })),
  closeTab: (id) =>
    set((s) => {
      const i = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeId = s.activeId === id ? (tabs[Math.min(i, tabs.length - 1)]?.id ?? null) : s.activeId;
      return { tabs, activeId };
    }),
  setActive: (id) => set({ activeId: id }),
  updateTab: (id, patch) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? ({ ...t, ...patch } as Tab) : t)) })),
  openFile: (path, line) => {
    const existing = get().tabs.find((t) => t.kind === "editor" && t.path === path);
    if (existing) {
      set({ activeId: existing.id });
      if (line) get().updateTab(existing.id, { line } as Partial<Tab>);
      return;
    }
    get().openTab({ id: newId("e"), kind: "editor", title: basename(path), path, line });
  },
  openTerminal: (cwd) => {
    const n = get().tabs.filter((t) => t.kind === "terminal").length + 1;
    get().openTab({ id: newId("term"), kind: "terminal", title: `Terminal ${n}`, cwd: cwd ?? get().root });
  },
  openPreview: (url) => {
    const existing = get().tabs.find((t) => t.kind === "preview" && t.url === url);
    if (existing) return set({ activeId: existing.id });
    get().openTab({ id: newId("p"), kind: "preview", title: url.replace(/^https?:\/\//, ""), url });
  },
  setSidebar: (sidebar) => set({ sidebar }),
  toggleSidebar: (p) => set((s) => ({ sidebar: s.sidebar === p ? null : p })),
  set: (p) => set(p),
  addDetectedUrl: (url) => set((s) => (s.detectedUrls.includes(url) ? s : { detectedUrls: [url, ...s.detectedUrls].slice(0, 5) })),
  bumpFs: () => set((s) => ({ fsVersion: s.fsVersion + 1 })),
}));

export const NO_TASKS: TaskItem[] = [];

export type TaskItem = { id: string; text: string; status: "pending" | "in_progress" | "done" };

/** Plans & tasks, per workspace root. Agents read and update the same list. */
export const useTasks = create<{
  byRoot: Record<string, TaskItem[]>;
  setTasks: (root: string, items: TaskItem[]) => void;
}>()(
  persist(
    (set) => ({
      byRoot: {},
      setTasks: (root, items) => set((s) => ({ byRoot: { ...s.byRoot, [root]: items } })),
    }),
    { name: "t-rax:tasks" },
  ),
);
