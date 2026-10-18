import { Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { useSettings } from "@/lib/store";
import { chat } from "./providers";

const setGhost = StateEffect.define<{ pos: number; text: string } | null>();

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghost";
    span.textContent = this.text;
    return span;
  }
  eq(o: GhostWidget) {
    return o.text === this.text;
  }
}

const ghostField = StateField.define<{ pos: number; text: string } | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    // Any edit or cursor move invalidates the suggestion.
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (g): DecorationSet =>
      g ? Decoration.set([Decoration.widget({ widget: new GhostWidget(g.text), side: 1 }).range(g.pos)]) : Decoration.none,
    ),
});

/** Context-aware inline AI completion: ghost text after a pause, Tab to accept. */
export function aiAutocomplete(path: string) {
  const plugin = ViewPlugin.fromClass(
    class {
      timer = 0;
      ctrl: AbortController | null = null;
      constructor(readonly view: EditorView) {}
      update(u: ViewUpdate) {
        if (!u.docChanged) return;
        this.cancel();
        const { ai } = useSettings.getState();
        if (!ai.autocomplete || (!ai.apiKey && ai.provider === "anthropic")) return;
        this.timer = window.setTimeout(() => this.request(), 650);
      }
      cancel() {
        clearTimeout(this.timer);
        this.ctrl?.abort();
        this.ctrl = null;
      }
      async request() {
        const state = this.view.state;
        const pos = state.selection.main.head;
        const line = state.doc.lineAt(pos);
        // Only complete at the end of a line (ignoring trailing closers).
        if (!/^[\s)\]}>"'`;,]*$/.test(line.text.slice(pos - line.from))) return;
        const prefix = state.doc.sliceString(Math.max(0, pos - 3000), pos);
        const suffix = state.doc.sliceString(pos, Math.min(state.doc.length, pos + 1000));
        const settings = useSettings.getState().ai;
        this.ctrl = new AbortController();
        try {
          const res = await chat({
            settings,
            model: settings.autocompleteModel || settings.model,
            maxTokens: 96,
            signal: this.ctrl.signal,
            messages: [
              {
                role: "system",
                content:
                  "You are a code completion engine. Reply with ONLY the text to insert at <CURSOR>, no explanations, no markdown fences. Keep it short (at most a few lines). Reply with nothing if no completion makes sense.",
              },
              { role: "user", content: `File: ${path}\n\n${prefix}<CURSOR>${suffix}` },
            ],
          });
          const text = res.text.replace(/^```\w*\n?|```$/g, "").replace(/\s+$/, "");
          if (!text || this.view.state.selection.main.head !== pos) return;
          this.view.dispatch({ effects: setGhost.of({ pos, text }) });
        } catch {
          // Autocomplete is best-effort.
        }
      }
      destroy() {
        this.cancel();
      }
    },
  );

  const accept = Prec.highest(
    keymap.of([
      {
        key: "Tab",
        run(view) {
          const g = view.state.field(ghostField);
          if (!g) return false;
          view.dispatch({ changes: { from: g.pos, insert: g.text }, selection: { anchor: g.pos + g.text.length } });
          return true;
        },
      },
      {
        key: "Escape",
        run(view) {
          if (!view.state.field(ghostField)) return false;
          view.dispatch({ effects: setGhost.of(null) });
          return true;
        },
      },
    ]),
  );

  return [ghostField, plugin, accept];
}
