import { Download, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { PROVIDER_PRESETS } from "@/ai/providers";
import { useSettings, useWorkspace } from "@/lib/store";
import { APP_THEMES, type AppTheme, EDITOR_THEMES, findTheme } from "@/lib/themes";
import { Button, inputCls, Modal } from "./ui";

type Section = "ai" | "appearance" | "editor" | "snippets";

export function SettingsModal() {
  const open = useWorkspace((s) => s.settingsOpen);
  const [section, setSection] = useState<Section>("ai");
  if (!open) return null;
  return (
    <Modal title="Settings" width={780} onClose={() => useWorkspace.getState().set({ settingsOpen: false })}>
      <div className="flex min-h-[460px]">
        <nav className="w-40 shrink-0 space-y-0.5 border-r border-border p-2">
          {(
            [
              ["ai", "AI Providers"],
              ["appearance", "Themes"],
              ["editor", "Editor & Terminal"],
              ["snippets", "Snippets & Skills"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] ${section === id ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex-1 space-y-5 p-5">
          {section === "ai" && <AiSection />}
          {section === "appearance" && <ThemeSection />}
          {section === "editor" && <EditorSection />}
          {section === "snippets" && <SnippetSection />}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[12px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function AiSection() {
  const ai = useSettings((s) => s.ai);
  const setAi = useSettings((s) => s.setAi);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_PRESETS.map((p) => (
          <Button
            key={p.label}
            variant={ai.baseUrl === p.baseUrl ? "primary" : "default"}
            onClick={() => setAi({ provider: p.provider, baseUrl: p.baseUrl, model: p.model })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="API format">
          <select value={ai.provider} onChange={(e) => setAi({ provider: e.target.value as "openai" | "anthropic" })} className={inputCls}>
            <option value="openai">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </Field>
        <Field label="Model">
          <input value={ai.model} onChange={(e) => setAi({ model: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <Field label="Base URL" hint="LM Studio and Ollama run fully local: your code never leaves the machine.">
        <input value={ai.baseUrl} onChange={(e) => setAi({ baseUrl: e.target.value })} className={inputCls} />
      </Field>
      <Field label="API key" hint="Bring your own key. Stored locally in this app's storage; not needed for local models.">
        <input type="password" value={ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value })} className={inputCls} placeholder="sk-…" />
      </Field>
      <div className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={ai.autocomplete} onChange={(e) => setAi({ autocomplete: e.target.checked })} />
          AI autocomplete in the editor (Tab to accept)
        </label>
        <Field label="Autocomplete model" hint="Leave empty to use the chat model. A small, fast model works best.">
          <input value={ai.autocompleteModel} onChange={(e) => setAi({ autocompleteModel: e.target.value })} className={inputCls} />
        </Field>
      </div>
    </>
  );
}

function ThemeSection() {
  const s = useSettings();
  const all = [...APP_THEMES, ...s.customThemes];
  const current = findTheme(s.appTheme, s.customThemes);

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${current.id}.json`;
    a.click();
  };
  const importTheme = (file: File) =>
    file.text().then((t) => {
      try {
        const theme = JSON.parse(t) as AppTheme;
        if (!theme.id || !theme.colors?.bg) throw new Error("missing id/colors");
        const id = APP_THEMES.some((x) => x.id === theme.id) ? `${theme.id}-custom` : theme.id;
        s.set({ customThemes: [...s.customThemes.filter((x) => x.id !== id), { ...theme, id }], appTheme: id });
      } catch (e) {
        alert(`Invalid theme: ${e}`);
      }
    });
  const duplicate = () => {
    const id = `custom-${Date.now().toString(36)}`;
    s.set({ customThemes: [...s.customThemes, { ...current, id, name: `${current.name} (custom)` }], appTheme: id });
  };
  const isCustom = s.customThemes.some((t) => t.id === current.id);
  const setColor = (k: keyof AppTheme["colors"], v: string) =>
    s.set({ customThemes: s.customThemes.map((t) => (t.id === current.id ? { ...t, colors: { ...t.colors, [k]: v } } : t)) });

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {all.map((t) => (
          <button
            key={t.id}
            onClick={() => s.set({ appTheme: t.id })}
            className={`overflow-hidden rounded-lg border text-left ${s.appTheme === t.id ? "border-accent" : "border-border hover:border-muted"}`}
          >
            <div className="flex h-10" style={{ background: t.colors.bg }}>
              {(["accent", "red", "green", "yellow", "blue", "magenta"] as const).map((k) => (
                <span key={k} className="m-auto h-3 w-3 rounded-full" style={{ background: t.colors[k] }} />
              ))}
            </div>
            <div className="px-2 py-1 text-[11.5px]">{t.name}</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={duplicate}>Customize current</Button>
        <Button onClick={exportTheme}>
          <Download size={12} /> Export JSON
        </Button>
        <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 text-[12.5px] font-medium hover:bg-hover">
          <Upload size={12} /> Import JSON
          <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importTheme(e.target.files[0])} />
        </label>
        {isCustom && (
          <Button variant="danger" onClick={() => s.set({ customThemes: s.customThemes.filter((t) => t.id !== current.id), appTheme: "t-rax-default" })}>
            <Trash2 size={12} /> Delete
          </Button>
        )}
      </div>
      {isCustom && (
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(current.colors) as (keyof AppTheme["colors"])[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-[11px] text-muted">
              <input type="color" value={current.colors[k]} onChange={(e) => setColor(k, e.target.value)} className="h-6 w-6 cursor-pointer bg-transparent" />
              {k}
            </label>
          ))}
        </div>
      )}
      <Field label="Background image URL" hint="Shown behind the workspace with adjustable opacity and blur.">
        <input value={s.bgImage} onChange={(e) => s.set({ bgImage: e.target.value })} className={inputCls} placeholder="https://… or file path" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Opacity ${Math.round(s.bgOpacity * 100)}%`}>
          <input type="range" min={0} max={1} step={0.01} value={s.bgOpacity} onChange={(e) => s.set({ bgOpacity: +e.target.value })} className="w-full" />
        </Field>
        <Field label={`Blur ${s.bgBlur}px`}>
          <input type="range" min={0} max={40} value={s.bgBlur} onChange={(e) => s.set({ bgBlur: +e.target.value })} className="w-full" />
        </Field>
      </div>
    </>
  );
}

function EditorSection() {
  const s = useSettings();
  return (
    <>
      <Field label="Editor theme" hint="Picks independently from the app theme; Auto follows it.">
        <select value={s.editorTheme} onChange={(e) => s.set({ editorTheme: e.target.value })} className={inputCls}>
          <option value="auto">Auto</option>
          {EDITOR_THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Font size ${s.fontSize}px`}>
        <input type="range" min={10} max={22} value={s.fontSize} onChange={(e) => s.set({ fontSize: +e.target.value })} className="w-full" />
      </Field>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={s.vim} onChange={(e) => s.set({ vim: e.target.checked })} /> Vim mode (motions, registers, marks)
      </label>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={s.showHidden} onChange={(e) => s.set({ showHidden: e.target.checked })} /> Show hidden files in the explorer
      </label>
    </>
  );
}

function SnippetSection() {
  const snippets = useSettings((s) => s.snippets);
  const set = useSettings((s) => s.set);
  const update = (i: number, patch: Partial<(typeof snippets)[number]>) => set({ snippets: snippets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <>
      <p className="text-[12px] text-muted">
        Reusable prompts you call by name in the agent chat with <code>/name</code>. Put per-project instructions and memory in a <code>TRAX.md</code> at the
        project root; the agent reads it on every turn.
      </p>
      {snippets.map((s, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border p-2.5">
          <div className="flex gap-1.5">
            <input value={s.name} onChange={(e) => update(i, { name: e.target.value.replace(/\s/g, "-") })} className={`${inputCls} w-40 font-mono`} />
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => set({ snippets: snippets.filter((_, j) => j !== i) })}>
              <Trash2 size={12} />
            </Button>
          </div>
          <textarea value={s.prompt} onChange={(e) => update(i, { prompt: e.target.value })} rows={2} className={`${inputCls} h-auto py-1.5`} />
        </div>
      ))}
      <Button onClick={() => set({ snippets: [...snippets, { name: `snippet-${snippets.length + 1}`, prompt: "" }] })}>Add snippet</Button>
    </>
  );
}
