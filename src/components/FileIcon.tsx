import catppuccin from "@iconify-json/catppuccin/icons.json";
import { addCollection, Icon } from "@iconify/react";
import { useSettings } from "@/lib/store";

addCollection(catppuccin as Parameters<typeof addCollection>[0]);
const ICONS = new Set(Object.keys(catppuccin.icons));

const BY_NAME: Record<string, string> = {
  "package.json": "package-json",
  "package-lock.json": "npm-lock",
  "cargo.toml": "cargo",
  "cargo.lock": "cargo-lock",
  "tsconfig.json": "typescript-config",
  "vite.config.ts": "vite",
  "vitest.config.ts": "vitest",
  dockerfile: "docker",
  "docker-compose.yml": "docker-compose",
  ".gitignore": "git",
  ".gitattributes": "git",
  ".env": "env",
  "readme.md": "readme",
  license: "license",
  "tailwind.config.js": "tailwind",
  "terax.md": "markdown",
};

const BY_EXT: Record<string, string> = {
  ts: "typescript", mts: "typescript", tsx: "typescript-react", js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "javascript-react", json: "json", md: "markdown", mdx: "markdown-mdx", rs: "rust", py: "python", go: "go",
  css: "css", scss: "sass", html: "html", svg: "svg", png: "image", jpg: "image", jpeg: "image", gif: "image",
  webp: "image", ico: "image", toml: "toml", yml: "yaml", yaml: "yaml", sh: "bash", bash: "bash", zsh: "bash",
  lock: "lock", txt: "text", vue: "vue", svelte: "svelte", java: "java", kt: "kotlin", c: "c", h: "c-header",
  cpp: "cpp", rb: "ruby", php: "php", sql: "database", xml: "xml", zig: "zig", lua: "lua", swift: "swift",
};

function iconFor(name: string, isDir: boolean, open: boolean) {
  const lower = name.toLowerCase();
  if (isDir) {
    const n = `folder-${lower.replace(/^\./, "")}${open ? "-open" : ""}`;
    return ICONS.has(n) ? n : open ? "folder-open" : "folder";
  }
  const byName = BY_NAME[lower];
  if (byName && ICONS.has(byName)) return byName;
  if (/\.test\.[tj]sx?$/.test(lower)) return lower.includes(".ts") ? "typescript-test" : "javascript-test";
  if (lower.endsWith(".d.ts")) return "typescript-def";
  const ext = BY_EXT[lower.split(".").pop() ?? ""];
  return ext && ICONS.has(ext) ? ext : "file";
}

// Monochrome by default: shapes stay distinct, colour is reserved for status.
const MONO = { filter: "grayscale(1) brightness(1.2)", opacity: 0.7 };

export function FileIcon({ name, isDir = false, open = false, size = 16 }: { name: string; isDir?: boolean; open?: boolean; size?: number }) {
  const colored = useSettings((s) => s.coloredIcons);
  return (
    <Icon
      icon={`catppuccin:${iconFor(name, isDir, open)}`}
      width={size}
      height={size}
      className="shrink-0"
      style={colored ? undefined : MONO}
    />
  );
}
