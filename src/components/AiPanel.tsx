import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ArrowUp, Bot, Check, FileCode, FileText, Image as ImageIcon, PanelRightClose, Paperclip, Plus, Settings2, Square, Terminal, X } from "lucide-react";
import { formatSize } from "@/ai/attachments";
import { openUrl } from "@tauri-apps/plugin-opener";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ChatItem, type ToolRun, useChat } from "@/ai/store";
import { ipc, relPath, toPosix } from "@/lib/ipc";
import { NO_TASKS, newId, useSettings, useTasks, useWorkspace } from "@/lib/store";
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
  const hasMemory = useHasMemory();
  const attachments = useChat((s) => s.attachments);
  const dropping = useWorkspace((s) => s.dropTarget === "agent");
  const pickFiles = async () => {
    const picked = await openDialog({ multiple: true, directory: false });
    if (picked) void useChat.getState().addAttachments((Array.isArray(picked) ? picked : [picked]).map(toPosix));
  };

  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [items]);

  const submit = () => {
    if ((!text.trim() && !useChat.getState().attachments.length) || running) return;
    void send(text);
    setText("");
  };

  const slash = text.startsWith("/") && !text.includes(" ") ? snippets.filter((s) => s.name.startsWith(text.slice(1))) : [];

  return (
    <section aria-label="Agent" data-drop="agent" className="relative flex h-full flex-col bg-panel">
      {dropping && (
        <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent-soft">
          <span className="flex items-center gap-2 font-mono text-[12px] text-accent">
            <Paperclip size={14} /> Drop to attach
          </span>
        </div>
      )}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border pr-2 pl-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-semibold">Agent</span>
          <span className="truncate font-mono text-[12px] text-muted">{ai.model}</span>
        </div>
        <div className="flex">
          <IconBtn title="New chat" onClick={reset}>
            <Plus size={14} strokeWidth={1.8} />
          </IconBtn>
          <IconBtn title="AI settings" onClick={() => useWorkspace.getState().set({ settingsOpen: true })}>
            <Settings2 size={14} strokeWidth={1.8} />
          </IconBtn>
          <IconBtn title="Minimize" onClick={() => useSettings.getState().set({ agentPanel: "minimized" })}>
            <PanelRightClose size={14} strokeWidth={1.8} />
          </IconBtn>
          <IconBtn title="Close (Ctrl+I reopens)" onClick={() => useSettings.getState().set({ agentPanel: "closed" })}>
            <X size={14} strokeWidth={1.8} />
          </IconBtn>
        </div>
      </div>

      <div ref={scroller} className="flex flex-1 flex-col gap-3.5 overflow-auto p-4">
        {!items.length && (
          <div className="mt-10 flex flex-col items-center gap-3 px-2 text-center text-[13px] leading-relaxed text-muted">
            <Bot size={28} strokeWidth={1.5} className="text-dim" />
            <p className="m-0 max-w-64">Ask the agent to read, plan and change your project. Every edit lands in a diff you review first.</p>
            {!configured && <Button onClick={() => useWorkspace.getState().set({ settingsOpen: true })}>Configure a provider</Button>}
            <p className="m-0 font-mono text-[11px] text-dim">{snippets.map((s) => `/${s.name}`).join("  ")}</p>
          </div>
        )}
        {items.map((it) => (
          <Item key={it.id} item={it} />
        ))}
        {running && (
          <div className="flex items-center gap-2 font-mono text-[12px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> working
          </div>
        )}
        {items.length > 0 && <PlanCard />}
      </div>

      <div className="relative p-3">
        {slash.length > 0 && (
          <div className="absolute right-3 bottom-full left-3 mb-1 rounded-lg border border-border-strong bg-elevated p-1">
            {slash.map((s) => (
              <button
                key={s.name}
                onClick={() => setText(`/${s.name} `)}
                className="block h-8 w-full truncate rounded-md px-2.5 text-left text-[12.5px] hover:bg-hover"
              >
                <span className="font-mono text-accent">/{s.name}</span> <span className="text-muted">{s.prompt}</span>
              </button>
            ))}
          </div>
        )}
        <div className="rounded-[10px] border border-border-strong bg-elevated focus-within:border-accent/50">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
              {attachments.map((a) => (
                <span key={a.id} className="flex max-w-full items-center gap-1.5 rounded-md bg-hover py-1 pr-1 pl-2 text-[12px]" title={a.path}>
                  {a.kind === "image" ? <ImageIcon size={12} /> : a.kind === "pdf" ? <FileText size={12} /> : <FileCode size={12} />}
                  <span className="truncate">{a.name}</span>
                  <span className="font-mono text-[10.5px] text-dim">{formatSize(a.size)}</span>
                  <button
                    aria-label={`Remove ${a.name}`}
                    onClick={() => useChat.getState().removeAttachment(a.id)}
                    className="grid h-4 w-4 place-items-center rounded text-muted hover:bg-border hover:text-fg"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <label htmlFor="agent-input" className="sr-only">
            Message the agent
          </label>
          <textarea
            id="agent-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask the agent · / for snippets"
            className="block w-full resize-none bg-transparent px-3 pt-3 pb-1 text-[13px] leading-normal outline-none placeholder:text-dim"
          />
          <div className="flex items-center justify-between gap-2 pt-1 pr-2 pb-2 pl-3">
            <div className="flex min-w-0 items-center gap-3 font-mono text-[11px] text-dim">
              <button onClick={() => void pickFiles()} title="Attach files (or drag them here)" aria-label="Attach files" className="text-muted hover:text-fg">
                <Paperclip size={14} />
              </button>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={autoApprove} onChange={(e) => useChat.getState().set({ autoApprove: e.target.checked })} />
                auto-run
              </label>
              {hasMemory && <span className="truncate">TRAX.md loaded</span>}
            </div>
            {running ? (
              <button onClick={stop} className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-fg text-bg" aria-label="Stop">
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim() && !attachments.length}
                className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent text-accent-fg disabled:opacity-30"
                aria-label="Send"
              >
                <ArrowUp size={15} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The minimized agent: a thin strip on the right; a click brings the panel back. */
export function AgentStrip() {
  const running = useChat((s) => s.running);
  const pendingReview = useChat((s) => Object.values(s.edits).some((e) => e.status === "pending") || Object.values(s.approvals).some((a) => a.status === "pending"));
  return (
    <button
      onClick={() => useSettings.getState().set({ agentPanel: "open" })}
      title="Open agent (Ctrl+I)"
      aria-label="Open agent"
      className="flex w-10 shrink-0 flex-col items-center gap-3 border-l border-border bg-panel py-3 text-muted hover:bg-elevated hover:text-fg"
    >
      <span className="relative">
        <Bot size={17} strokeWidth={1.6} />
        {(running || pendingReview) && (
          <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${pendingReview ? "bg-yellow" : "animate-pulse bg-accent"}`} />
        )}
      </span>
      <span className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase [writing-mode:vertical-rl]">Agent</span>
    </button>
  );
}

/** Whether the project has a memory file the agent reads every turn. */
function useHasMemory() {
  const root = useWorkspace((s) => s.root);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!root) return;
    ipc
      .readFile(`${root}/TRAX.md`)
      .catch(() => ipc.readFile(`${root}/TERAX.md`))
      .then(
        () => setHas(true),
        () => setHas(false),
      );
  }, [root, fsVersion]);
  return has;
}

function PlanCard() {
  const root = useWorkspace((s) => s.root);
  const tasks = useTasks((s) => s.byRoot[root] ?? NO_TASKS);
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-elevated p-3 text-[13px]">
      <span className="label">
        Plan · {done}/{tasks.length}
      </span>
      {tasks.map((t) => (
        <div key={t.id} className={`flex gap-2 ${t.status === "done" ? "text-dim line-through" : t.status === "in_progress" ? "text-fg" : "text-fg-soft"}`}>
          <span aria-hidden className={t.status === "done" ? "text-accent" : t.status === "in_progress" ? "text-yellow" : "text-dim"}>
            {t.status === "done" ? "●" : t.status === "in_progress" ? "◐" : "○"}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Item({ item }: { item: ChatItem }) {
  const html = useMemo(() => (item.kind === "assistant" ? DOMPurify.sanitize(marked.parse(item.text) as string) : ""), [item]);
  if (item.kind === "user")
    return (
      <div className="selectable max-w-[85%] self-end rounded-[10px] bg-hover px-3 py-2.5 text-[13px] leading-normal whitespace-pre-wrap">
        {item.text}
        {item.files?.length ? (
          <div className={`flex flex-wrap gap-1 font-mono text-[11px] text-muted ${item.text ? "mt-2" : ""}`}>
            {item.files.map((f) => (
              <span key={f} className="flex items-center gap-1 rounded bg-border px-1.5 py-0.5">
                <Paperclip size={10} /> {f}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  if (item.kind === "assistant")
    return (
      <div
        className="prose-ai selectable text-[13px] leading-relaxed text-fg-soft"
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
  if (item.kind === "error")
    return <div className="selectable rounded-[10px] border border-red/35 bg-red-soft px-3 py-2 text-[12.5px] text-red">{item.text}</div>;
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

  const label = TOOL_LABEL[run.call.name] ?? run.call.name;

  // File edits: a card with a preview of the change and the review buttons.
  if (edit) {
    const preview = changedLines(edit.before, edit.after);
    return (
      <div className="overflow-hidden rounded-[10px] border border-border-strong">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <button onClick={openReview} className="truncate font-mono text-[12px] font-medium hover:underline" title="Open full diff">
            {relPath(root, edit.path)}
          </button>
          <span className="shrink-0 font-mono text-[12px]">
            <span className="text-accent">+{stats!.add}</span> <span className="text-red">−{stats!.del}</span>
          </span>
        </div>
        <div className="selectable bg-bg py-2 font-mono text-[12px] leading-[1.7]">
          {preview.map((l, i) => (
            <div
              key={i}
              className={`truncate px-3 whitespace-pre ${l.kind === "+" ? "bg-accent-soft text-green-200" : "bg-red-soft text-red-300"}`}
            >
              {l.kind === "+" ? "+ " : "− "}
              {l.text}
            </div>
          ))}
          {!preview.length && <div className="px-3 text-dim">no line changes</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          {edit.status === "pending" ? (
            <>
              <Button onClick={() => resolveEdit(edit.id, false)}>Reject</Button>
              <Button variant="primary" onClick={() => resolveEdit(edit.id, true)}>
                Accept
              </Button>
            </>
          ) : (
            <span className={`font-mono text-[11.5px] ${edit.status === "accepted" ? "text-accent" : "text-red"}`}>{edit.status}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-[12px]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-muted hover:text-fg" aria-expanded={open}>
        {run.result ? (
          <Check size={12} strokeWidth={2.4} className="shrink-0 text-accent" />
        ) : (
          <span className="mx-[3px] h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-muted" />
        )}
        {run.call.name === "run_command" && <Terminal size={12} className="shrink-0" />}
        <span className="shrink-0">{label}</span>
        <span className="truncate text-fg-soft">{subject}</span>
      </button>
      {approval?.status === "pending" && (
        <div className="mt-2 flex flex-col gap-2 rounded-[10px] border border-border-strong p-3">
          <code className="selectable text-[12px] break-all text-fg">{approval.command}</code>
          <div className="flex justify-end gap-2 font-sans">
            <Button onClick={() => resolveApproval(approval.id, false)}>Deny</Button>
            <Button variant="primary" onClick={() => resolveApproval(approval.id, true)}>
              Run
            </Button>
          </div>
        </div>
      )}
      {open && run.result && (
        <pre className="selectable mt-1.5 max-h-64 overflow-auto rounded-lg bg-bg px-3 py-2 text-[11.5px] whitespace-pre-wrap text-fg-soft">
          {run.result}
        </pre>
      )}
    </div>
  );
}

/** First few removed/added lines of an edit, for the inline card. */
function changedLines(a: string, b: string, max = 8) {
  const A = a.split("\n");
  const B = b.split("\n");
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
    endA--;
    endB--;
  }
  const out = [
    ...A.slice(start, endA).map((text) => ({ kind: "-" as const, text })),
    ...B.slice(start, endB).map((text) => ({ kind: "+" as const, text })),
  ];
  return out.slice(0, max);
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
