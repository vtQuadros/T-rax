import type { Extension } from "@codemirror/state";
import { atomone } from "@uiw/codemirror-theme-atomone";
import { aura } from "@uiw/codemirror-theme-aura";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { gruvboxDark } from "@uiw/codemirror-theme-gruvbox-dark";
import { nord } from "@uiw/codemirror-theme-nord";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "@uiw/codemirror-themes";
import { useSettings } from "./store";
import { findTheme } from "./themes";

/** Matches the T-rax Default palette: near-black ground, one green accent. */
const trax = createTheme({
  theme: "dark",
  settings: {
    background: "#0b0d0c",
    foreground: "#e7ece9",
    caret: "#4ade80",
    selection: "#4ade8033",
    selectionMatch: "#4ade801f",
    lineHighlight: "#121614",
    gutterBackground: "#0b0d0c",
    gutterForeground: "#7a837e",
    gutterActiveForeground: "#c9d1cc",
    gutterBorder: "transparent",
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  styles: [
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#7a837e", fontStyle: "italic" },
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#c084fc" },
    { tag: [t.string, t.special(t.string), t.regexp], color: "#fcd34d" },
    { tag: [t.number, t.bool, t.null, t.atom], color: "#fdba74" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#86efac" },
    { tag: [t.typeName, t.className, t.namespace], color: "#93c5fd" },
    { tag: [t.propertyName, t.attributeName], color: "#c9d1cc" },
    { tag: [t.tagName], color: "#4ade80" },
    { tag: [t.operator, t.punctuation, t.bracket], color: "#8b948f" },
    { tag: [t.definition(t.variableName)], color: "#e7ece9" },
    { tag: [t.heading], color: "#4ade80", fontWeight: "600" },
    { tag: [t.link, t.url], color: "#60a5fa", textDecoration: "underline" },
    { tag: [t.invalid], color: "#f87171" },
  ],
});

const MAP: Record<string, Extension> = {
  "t-rax": trax,
  "github-dark": githubDark,
  "github-light": githubLight,
  "tokyo-night": tokyoNight,
  nord,
  "gruvbox-dark": gruvboxDark,
  atomone,
  dracula,
  aura,
};

/** Editor theme picks independently from the app theme unless set to "auto". */
export function useEditorTheme(): Extension {
  const editorTheme = useSettings((s) => s.editorTheme);
  const appTheme = useSettings((s) => s.appTheme);
  const custom = useSettings((s) => s.customThemes);
  const id = editorTheme === "auto" ? findTheme(appTheme, custom).editorTheme : editorTheme;
  return MAP[id] ?? githubDark;
}
