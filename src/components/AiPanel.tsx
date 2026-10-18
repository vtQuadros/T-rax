import { ArrowUp, Bot, Check, ChevronRight, FileDiff, Plus, Settings2, Square, Terminal, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ChatItem, type ToolRun, useChat } from "@/ai/store";
import { relPath } from "@/lib/ipc";
import { newId, useSettings, useWorkspace } from "@/lib/store";
import { IconBtn } from "./Explorer";
import { Button } from "./ui";

marked.setOptions({ gfm: true, breaks: true });

export function AiPanel() {
  const items = useChat((s) => s.items);
  const running = useChat((s) => s.running);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const reset = useChat((s) => s.reset);
  const autoApprove = useChat((s) => s.autoApprove);
  const ai = useSettings((s) => s.ai);
  const snippets = useSettings((s) => s.snippets);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const configured = ai.apiKey || (ai.provider === "openai" && /localhost|127\.0\.0\.1/.test(ai.baseUrl));

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [items]);

  const submit = () => {
    if (!text.trim() || running) return;
    void send(text);
    setText("");
  };

  const slash = text.startsWith("/") && !text.includes(" ") ? snippets.filter((s) => s.name.startsWith(text.slice(1))) : [];

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-[12px]">
          <Bot size={14} className="text-muted" />
          <span className="font-medium">Agent</span>
          <span className="truncate text-[11px] text-muted">{ai.model}</span>
        </div>
        <div className="flex">
          <IconBtn title="New chat" onClick={reset}>
            <Plus size={14} />
          </IconBtn>
          <IconBtn title="AI settings" onClick={() => useWorkspace.getState().set({ settingsOpen: true })}>
            <Settings2 size={13} />
          </IconBtn>
        </div>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-auto p-3">
        {!items.length && (
          <div className="mt-8 space-y-3 px-2 text-center text-[12px] text-muted">
            <Bot size={28} className="mx-auto opacity-60" />
            <p>Ask the agent to read, plan and change your project. Every edit lands in a reviewable diff first.</p>
            {!configured && (
              <Button onClick={() => useWorkspace.getState().set({ settingsOpen: true })}>Configure a provider</Button>
            )}
            <p className="text-[11px]">
              Snippets: {snippets.map((s) => `/${s.name}`).join("  ")}
            </p>
          </div>
        )}
        {items.map((it) => (
          <Item key={it.id} item={it} />
        ))}
        {running && <div className="animate-pulse text-[12px] text-muted">Working…</div>}
      </div>

      <div className="relative border-t border-border p-2">
        {slash.length > 0 && (
          <div className="absolute right-2 bottom-full left-2 mb-1 rounded-md border border-border bg-elevated p-1 shadow-lg">
            {slash.map((s) => (
              <button
                key={s.name}
                onClick={() => setText(`/${s.name} `)}
                className="block w-full truncate rounded px-2 py-1 text-left text-[12px] hover:bg-hover"
              >
                <span className="font-mono">/{s.name}</span> <span className="text-muted">{s.prompt}</span>
              </button>
            ))}
          </div>
        )}
        <div className="rounded-lg border border-border bg-elevated focus-within:border-accent/50">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Ask anything, / for snippets"
            className="block w-full resize-none bg-transparent px-2.5 pt-2 text-[12.5px] outline-none placeholder:text-muted"
          />
          <div className="flex items-center justify-between px-2 pb-1.5">
            <label className="flex items-center gap-1 text-[11px] text-muted">
              <input type="checkbox" checked={autoApprove} onChange={(e) => useChat.getState().set({ autoApprove: e.target.checked })} />
              Auto-run commands
            </label>
            {running ? (
              <button onClick={stop} className="grid h-6 w-6 place-items-center rounded-md bg-fg text-bg" title="Stop">
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-fg disabled:opacity-30"
                title="Send"
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ item }: { item: ChatItem }) {
  const html = useMemo(() => (item.kind === "assistant" ? DOMPurify.sanitize(marked.parse(item.text) as string) : ""), [item]);
  if (item.kind === "user")
    return <div className="selectable ml-6 rounded-lg bg-elevated px-3 py-2 text-[12.5px] whitespace-pre-wrap">{item.text}</div>;
  if (item.kind === "assistant")
    return (
      <div
        className="prose-ai selectable text-[12.5px] leading-relaxed"
        // Links open in the system browser instead of navigating the app webview.
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest("a");
          if (a) {
            e.preventDefault();
            if (/^https?:/.test(a.href)) void openUrl(a.href);
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  if (item.kind === "error") return <div className="selectable rounded-md border border-red/30 bg-red/10 px-3 py-2 text-[12px] text-red">{item.text}</div>;
  return <ToolItem run={item.run} />;
}

const TOOL_LABEL: Record<string, string> = {
  read_file: "Read",
  list_dir: "List",
  grep: "Grep",
  find_files: "Find",
  write_file: "Write",
  edit_file: "Edit",
  run_command: "Run",
  update_tasks: "Update tasks",
  spawn_subagent: "Sub-agent",
};

function ToolItem({ run }: { run: ToolRun }) {
  const [open, setOpen] = useState(false);
  const root = useWorkspace((s) => s.root);
  const edit = useChat((s) => (run.editId ? s.edits[run.editId] : undefined));
  const approval = useChat((s) => (run.approvalId ? s.approvals[run.approvalId] : undefined));
  const resolveEdit = useChat((s) => s.resolveEdit);
  const resolveApproval = useChat((s) => s.resolveApproval);
  let args: any = {};
  try {
    args = JSON.parse(run.call.args || "{}");
  } catch {}
  const subject = args.path ?? args.command ?? args.query ?? args.task ?? (args.tasks ? `${args.tasks.length} tasks` : "");

  const openReview = () => {
    if (!edit) return;
    const ws = useWorkspace.getState();
    const existing = ws.tabs.find((t) => t.kind === "aiDiff" && t.editId === edit.id);
    if (existing) ws.setActive(existing.id);
    else ws.openTab({ id: newId("ad"), kind: "aiDiff", title: `Δ ${relPath(root, edit.path).split("/").pop()}`, editId: edit.id });
  };

  const stats = edit ? diffStats(edit.before, edit.after) : null;

  return (
    <div className="rounded-md border border-border bg-bg/40 text-[12px]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left">
        <ChevronRight size={12} className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
        {run.call.name === "run_command" ? <Terminal size={12} className="text-muted" /> : edit ? <FileDiff size={12} className="text-muted" /> : null}
        <span className="font-medium">{TOOL_LABEL[run.call.name] ?? run.call.name}</span>
        <span className="truncate font-mono text-[11px] text-muted">{subject}</span>
        {stats && (
          <span className="ml-auto shrink-0 font-mono text-[11px]">
            <span className="text-green">+{stats.add}</span> <span className="text-red">-{stats.del}</span>
          </span>
        )}
        {!run.result && !edit && !approval && <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-muted" />}
      </button>
      {approval?.status === "pending" && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <code className="truncate text-[11px]">{approval.command}</code>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" onClick={() => resolveApproval(approval.id, false)}>
              Deny
            </Button>
            <Button variant="primary" onClick={() => resolveApproval(approval.id, true)}>
              Run
            </Button>
          </div>
        </div>
      )}
      {edit && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <button onClick={openReview} className="text-[11px] text-blue hover:underline">
            Review diff
          </button>
          {edit.status === "pending" ? (
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => resolveEdit(edit.id, false)}>
                <X size={12} /> Reject
              </Button>
              <Button variant="primary" onClick={() => resolveEdit(edit.id, true)}>
                <Check size={12} /> Accept
              </Button>
            </div>
          ) : (
            <span className={`text-[11px] ${edit.status === "accepted" ? "text-green" : "text-red"}`}>{edit.status}</span>
          )}
        </div>
      )}
      {open && run.result && (
        <pre className="selectable max-h-64 overflow-auto border-t border-border px-2 py-1.5 font-mono text-[11px] whitespace-pre-wrap text-fg/75">
          {run.result}
        </pre>
      )}
    </div>
  );
}

function diffStats(a: string, b: string) {
  const A = a.split("\n");
  const B = b.split("\n");
  // Multiset line diff; good enough for a +/- summary.
  const count = new Map<string, number>();
  for (const l of A) count.set(l, (count.get(l) ?? 0) + 1);
  let add = 0;
  for (const l of B) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else add++;
  }
  const del = [...count.values()].reduce((x, y) => x + y, 0) - (a === "" ? 1 : 0);
  return { add, del: Math.max(0, del) };
}
