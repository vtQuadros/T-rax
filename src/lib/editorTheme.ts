import type { Extension } from "@codemirror/state";
import { atomone } from "@uiw/codemirror-theme-atomone";
import { aura } from "@uiw/codemirror-theme-aura";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { gruvboxDark } from "@uiw/codemirror-theme-gruvbox-dark";
import { nord } from "@uiw/codemirror-theme-nord";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { useSettings } from "./store";
import { findTheme } from "./themes";

const MAP: Record<string, Extension> = {
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
