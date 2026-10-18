import type { ITheme } from "@xterm/xterm";

export type Palette = {
  bg: string; // window background
  panel: string; // sidebar / tab strip
  elevated: string; // popovers, inputs
  hover: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  accentFg: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
};

export type AppTheme = { id: string; name: string; editorTheme: string; colors: Palette };

export const APP_THEMES: AppTheme[] = [
  {
    id: "t-rax-default",
    name: "T-rax Default",
    editorTheme: "github-dark",
    colors: {
      bg: "#0d0d0f", panel: "#121214", elevated: "#1a1a1d", hover: "#202024", border: "#26262b",
      fg: "#e6e6e8", muted: "#8b8b93", accent: "#fafafa", accentFg: "#0d0d0f",
      red: "#ff6b6b", green: "#5ee38a", yellow: "#f5d76e", blue: "#6aa8ff", magenta: "#c792ea", cyan: "#5fd7d7",
    },
  },
  {
    id: "nord",
    name: "Nord",
    editorTheme: "nord",
    colors: {
      bg: "#2e3440", panel: "#2b303b", elevated: "#3b4252", hover: "#434c5e", border: "#3b4252",
      fg: "#eceff4", muted: "#9aa5b8", accent: "#88c0d0", accentFg: "#2e3440",
      red: "#bf616a", green: "#a3be8c", yellow: "#ebcb8b", blue: "#81a1c1", magenta: "#b48ead", cyan: "#8fbcbb",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    editorTheme: "tokyo-night",
    colors: {
      bg: "#1a1b26", panel: "#16161e", elevated: "#24283b", hover: "#292e42", border: "#292e42",
      fg: "#c0caf5", muted: "#7982a9", accent: "#7aa2f7", accentFg: "#1a1b26",
      red: "#f7768e", green: "#9ece6a", yellow: "#e0af68", blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    editorTheme: "aura",
    colors: {
      bg: "#1e1e2e", panel: "#181825", elevated: "#313244", hover: "#313244", border: "#313244",
      fg: "#cdd6f4", muted: "#9399b2", accent: "#cba6f7", accentFg: "#1e1e2e",
      red: "#f38ba8", green: "#a6e3a1", yellow: "#f9e2af", blue: "#89b4fa", magenta: "#f5c2e7", cyan: "#94e2d5",
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    editorTheme: "gruvbox-dark",
    colors: {
      bg: "#282828", panel: "#1d2021", elevated: "#3c3836", hover: "#3c3836", border: "#3c3836",
      fg: "#ebdbb2", muted: "#a89984", accent: "#fabd2f", accentFg: "#282828",
      red: "#fb4934", green: "#b8bb26", yellow: "#fabd2f", blue: "#83a598", magenta: "#d3869b", cyan: "#8ec07c",
    },
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    editorTheme: "dracula",
    colors: {
      bg: "#191724", panel: "#1f1d2e", elevated: "#26233a", hover: "#2a2740", border: "#26233a",
      fg: "#e0def4", muted: "#908caa", accent: "#ebbcba", accentFg: "#191724",
      red: "#eb6f92", green: "#31748f", yellow: "#f6c177", blue: "#9ccfd8", magenta: "#c4a7e7", cyan: "#9ccfd8",
    },
  },
  {
    id: "sage",
    name: "Sage",
    editorTheme: "atomone",
    colors: {
      bg: "#1b1f1c", panel: "#171a18", elevated: "#252b27", hover: "#2b322d", border: "#2b322d",
      fg: "#dfe7df", muted: "#93a596", accent: "#9cc5a1", accentFg: "#1b1f1c",
      red: "#e07a7a", green: "#9cc5a1", yellow: "#d9c27e", blue: "#7fb0c9", magenta: "#c49ac9", cyan: "#86c5bd",
    },
  },
  {
    id: "caffeine",
    name: "Caffeine",
    editorTheme: "gruvbox-dark",
    colors: {
      bg: "#1f1a17", panel: "#1a1613", elevated: "#2a231f", hover: "#332a24", border: "#332a24",
      fg: "#efe3d6", muted: "#a8968a", accent: "#d9a066", accentFg: "#1f1a17",
      red: "#e06c5e", green: "#a7c080", yellow: "#d9a066", blue: "#8fa9c4", magenta: "#c9a0c4", cyan: "#83b5a9",
    },
  },
  {
    id: "claude",
    name: "Claude",
    editorTheme: "github-dark",
    colors: {
      bg: "#262624", panel: "#1f1e1d", elevated: "#30302e", hover: "#3a3936", border: "#3a3936",
      fg: "#f0eee6", muted: "#a6a39a", accent: "#d97757", accentFg: "#1f1e1d",
      red: "#e5675c", green: "#8fbc7a", yellow: "#e0b765", blue: "#7aa5d6", magenta: "#c38fd0", cyan: "#7bc0b8",
    },
  },
  {
    id: "tide",
    name: "Tide",
    editorTheme: "tokyo-night",
    colors: {
      bg: "#0f1a21", panel: "#0c151b", elevated: "#16242d", hover: "#1c2e39", border: "#1c2e39",
      fg: "#d6e7ef", muted: "#87a3b1", accent: "#4fc3d9", accentFg: "#0f1a21",
      red: "#f2777a", green: "#7fd1a0", yellow: "#f2c66d", blue: "#64a8e8", magenta: "#b39ae0", cyan: "#4fc3d9",
    },
  },
];

export function findTheme(id: string, custom: AppTheme[] = []): AppTheme {
  return [...APP_THEMES, ...custom].find((t) => t.id === id) ?? APP_THEMES[0];
}

export function applyTheme(t: AppTheme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.colors)) {
    root.style.setProperty(`--c-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v);
  }
}

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function terminalTheme(t: AppTheme): ITheme {
  const c = t.colors;
  return {
    background: "#00000000",
    foreground: c.fg,
    cursor: c.fg,
    cursorAccent: c.bg,
    selectionBackground: mix(c.bg, c.accent, 0.3),
    black: mix(c.bg, c.fg, 0.15),
    red: c.red,
    green: c.green,
    yellow: c.yellow,
    blue: c.blue,
    magenta: c.magenta,
    cyan: c.cyan,
    white: mix(c.fg, c.bg, 0.15),
    brightBlack: c.muted,
    brightRed: mix(c.red, "#ffffff", 0.2),
    brightGreen: mix(c.green, "#ffffff", 0.2),
    brightYellow: mix(c.yellow, "#ffffff", 0.2),
    brightBlue: mix(c.blue, "#ffffff", 0.2),
    brightMagenta: mix(c.magenta, "#ffffff", 0.2),
    brightCyan: mix(c.cyan, "#ffffff", 0.2),
    brightWhite: "#ffffff",
  };
}

export const EDITOR_THEMES = [
  "github-dark",
  "github-light",
  "tokyo-night",
  "nord",
  "gruvbox-dark",
  "atomone",
  "dracula",
  "aura",
] as const;
