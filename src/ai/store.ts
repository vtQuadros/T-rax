import { create } from "zustand";
import { editors } from "@/components/EditorView";
import { ipc, joinPath, relPath } from "@/lib/ipc";
import { newId, useSettings, useTasks, useWorkspace } from "@/lib/store";
import { chat, type Msg, type ToolCall } from "./providers";
import { type Approval, executeTool, type PendingEdit, READ_TOOLS, WRITE_TOOLS } from "./tools";

export type ToolRun = { call: ToolCall; result?: string; editId?: string; approvalId?: string };

/** Display items; `messages` holds the raw provider transcript. */
export type ChatItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "tool"; run: ToolRun }
  | { id: string; kind: "error"; text: string };

type ChatState = {
  items: ChatItem[];
  messages: Msg[];
  running: boolean;
  edits: Record<string, PendingEdit>;
  approvals: Record<string, Approval>;
  autoApprove: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  resolveEdit: (id: string, accept: boolean) => Promise<void>;
  resolveApproval: (id: string, allow: boolean) => void;
  set: (p: Partial<ChatState>) => void;
};

const editWaiters = new Map<string, (ok: boolean) => void>();
const approvalWaiters = new Map<string, (ok: boolean) => void>();
let controller: AbortController | null = null;

async function systemPrompt(sub = false) {
  const root = useWorkspace.getState().root;
  // TRAX.md is the project memory; TERAX.md is read too for projects made with Terax.
  const memory = await ipc
    .readFile(joinPath(root, "TRAX.md"))
    .catch(() => ipc.readFile(joinPath(root, "TERAX.md")))
    .catch(() => "");
  const tasks = useTasks.getState().byRoot[root] ?? [];
  const parts = [
    sub
      ? "You are a research sub-agent inside a terminal-first dev workspace. Investigate with the read-only tools and reply with a concise, factual answer for the parent agent."
      : "You are a coding agent inside T-rax, a terminal-first dev workspace with an editor, git and live preview. You can read the project, propose file edits (the user reviews each diff), run shell commands (with approval), keep a task plan with update_tasks, and delegate research to sub-agents. Plan multi-step work with update_tasks and keep it current. Be concise.",
    `Project root: ${root}`,
    `OS: Linux. Paths in tool calls are relative to the project root.`,
  ];
  if (memory) parts.push(`Project memory (TRAX.md):\n${memory.slice(0, 12000)}`);
  if (!sub && tasks.length) parts.push(`Current tasks:\n${tasks.map((t) => `- [${t.status}] ${t.text}`).join("\n")}`);
  return parts.join("\n\n");
}

/** Context about what the user is looking at, attached to each user turn. */
function editorContext() {
  const { tabs, activeId, root } = useWorkspace.getState();
  const tab = tabs.find((t) => t.id === activeId);
  if (tab?.kind !== "editor") return "";
  const view = editors.get(tab.path);
  const sel = view?.state.selection.main;
  const selected = view && sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : "";
  let ctx = `\n\n<context>Open file: ${relPath(root, tab.path)}`;
  if (view && sel) ctx += ` (cursor at line ${view.state.doc.lineAt(sel.head).number})`;
  if (selected) ctx += `\nSelected text:\n\`\`\`\n${selected.slice(0, 8000)}\n\`\`\``;
  return `${ctx}</context>`;
}

function expandSnippet(text: string) {
  const m = text.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!m) return text;
  const snip = useSettings.getState().snippets.find((s) => s.name === m[1]);
  return snip ? `${snip.prompt}${m[2] ? `\n\n${m[2]}` : ""}` : text;
}

export const useChat = create<ChatState>((set, get) => {
  const addItem = (item: ChatItem) => set((s) => ({ items: [...s.items, item] }));
  const patchItem = (id: string, fn: (i: ChatItem) => ChatItem) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? fn(i) : i)) }));

  async function runSubagent(task: string): Promise<string> {
    const settings = useSettings.getState().ai;
    const messages: Msg[] = [{ role: "system", content: await systemPrompt(true) }, { role: "user", content: task }];
    for (let step = 0; step < 12; step++) {
      const res = await chat({ settings, messages, tools: READ_TOOLS, signal: controller?.signal });
      messages.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls });
      if (!res.toolCalls.length) return res.text || "(no answer)";
      for (const c of res.toolCalls) {
        const result = await executeTool(c.name, c.args, hooksFor(null));
        messages.push({ role: "tool", toolCallId: c.id, name: c.name, content: result });
      }
    }
    return "Sub-agent stopped after 12 steps without a final answer.";
  }

  const hooksFor = (itemId: string | null) => ({
    proposeEdit: (e: PendingEdit) => {
      set((s) => ({ edits: { ...s.edits, [e.id]: e } }));
      if (itemId) patchItem(itemId, (i) => (i.kind === "tool" ? { ...i, run: { ...i.run, editId: e.id } } : i));
      return new Promise<boolean>((resolve) => editWaiters.set(e.id, resolve));
    },
    approveCommand: (command: string) => {
      if (get().autoApprove) return Promise.resolve(true);
      const id = newId("ap");
      set((s) => ({ approvals: { ...s.approvals, [id]: { id, command, status: "pending" } } }));
      if (itemId) patchItem(itemId, (i) => (i.kind === "tool" ? { ...i, run: { ...i.run, approvalId: id } } : i));
      return new Promise<boolean>((resolve) => approvalWaiters.set(id, resolve));
    },
    runSubagent,
  });

  return {
    items: [],
    messages: [],
    running: false,
    edits: {},
    approvals: {},
    autoApprove: false,
    set: (p) => set(p),

    async send(raw) {
      const text = expandSnippet(raw.trim());
      if (!text || get().running) return;
      const settings = useSettings.getState().ai;
      addItem({ id: newId("u"), kind: "user", text: raw.trim() });
      const messages: Msg[] = [...get().messages, { role: "user", content: text + editorContext() }];
      set({ messages, running: true });
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const tools = [...READ_TOOLS, ...WRITE_TOOLS];
        for (let step = 0; step < 40; step++) {
          const sys: Msg = { role: "system", content: await systemPrompt() };
          const itemId = newId("a");
          let streamed = "";
          const res = await chat({
            settings,
            messages: [sys, ...get().messages],
            tools,
            signal,
            onText: (d) => {
              if (!streamed) addItem({ id: itemId, kind: "assistant", text: "" });
              streamed += d;
              patchItem(itemId, (i) => ({ ...i, text: streamed }) as ChatItem);
            },
          });
          set((s) => ({ messages: [...s.messages, { role: "assistant", content: res.text, toolCalls: res.toolCalls }] }));
          if (!res.toolCalls.length) break;
          for (const call of res.toolCalls) {
            const toolItem = newId("tool");
            addItem({ id: toolItem, kind: "tool", run: { call } });
            const result = signal.aborted ? "Cancelled." : await executeTool(call.name, call.args, hooksFor(toolItem));
            patchItem(toolItem, (i) => (i.kind === "tool" ? { ...i, run: { ...i.run, result } } : i));
            set((s) => ({ messages: [...s.messages, { role: "tool", toolCallId: call.id, name: call.name, content: result }] }));
          }
          if (signal.aborted) break;
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") addItem({ id: newId("err"), kind: "error", text: String((e as Error).message ?? e) });
      } finally {
        set({ running: false });
        controller = null;
      }
    },

    stop() {
      controller?.abort();
      for (const [id, w] of editWaiters) {
        w(false);
        editWaiters.delete(id);
      }
      for (const [id, w] of approvalWaiters) {
        w(false);
        approvalWaiters.delete(id);
      }
    },

    reset() {
      get().stop();
      set({ items: [], messages: [], edits: {}, approvals: {} });
    },

    async resolveEdit(id, accept) {
      const e = get().edits[id];
      if (!e || e.status !== "pending") return;
      if (accept) {
        await ipc.writeFile(e.path, e.after);
        useWorkspace.getState().bumpFs();
      }
      set((s) => ({ edits: { ...s.edits, [id]: { ...e, status: accept ? "accepted" : "rejected" } } }));
      editWaiters.get(id)?.(accept);
      editWaiters.delete(id);
    },

    resolveApproval(id, allow) {
      set((s) => ({ approvals: { ...s.approvals, [id]: { ...s.approvals[id], status: allow ? "allowed" : "denied" } } }));
      approvalWaiters.get(id)?.(allow);
      approvalWaiters.delete(id);
    },
  };
});
