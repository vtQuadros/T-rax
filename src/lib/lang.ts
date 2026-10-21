import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import type { Extension } from "@codemirror/state";

export function languageFor(path: string): Extension[] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
      return [javascript({ typescript: true })];
    case "tsx":
      return [javascript({ typescript: true, jsx: true })];
    case "js":
    case "mjs":
    case "cjs":
      return [javascript()];
    case "jsx":
      return [javascript({ jsx: true })];
    case "json":
    case "jsonc":
      return [json()];
    case "rs":
      return [rust()];
    case "py":
      return [python()];
    case "go":
      return [go()];
    case "css":
    case "scss":
      return [css()];
    case "html":
    case "htm":
    case "vue":
    case "svelte":
      return [html()];
    case "md":
    case "mdx":
      return [markdown()];
    default:
      return [];
  }
}

export function languageName(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const names: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript JSX", js: "JavaScript", jsx: "JavaScript JSX", json: "JSON",
    rs: "Rust", py: "Python", go: "Go", css: "CSS", scss: "SCSS", html: "HTML", md: "Markdown",
    toml: "TOML", yaml: "YAML", yml: "YAML", sh: "Shell", lock: "Lockfile",
  };
  return names[ext] ?? "Plain Text";
}
