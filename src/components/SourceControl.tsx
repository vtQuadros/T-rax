import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUp, Check, ExternalLink, Minus, Plus, RefreshCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Commit, type FileChange, type GitStatus, basename, ipc, joinPath } from "@/lib/ipc";
import { LANE_COLORS, layoutGraph } from "@/lib/graph";
import { newId, useWorkspace } from "@/lib/store";
import { IconBtn, PanelHeader } from "./Explorer";
import { FileIcon } from "./FileIcon";
import { Button, inputCls } from "./ui";

const STATUS_COLOR: Record<string, string> = { M: "text-yellow", A: "text-green", "?": "text-green", D: "text-red", R: "text-blue", U: "text-magenta" };

export function SourceControl() {
  const root = useWorkspace((s) => s.root);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const bumpFs = useWorkspace((s) => s.bumpFs);
  const openTab = useWorkspace((s) => s.openTab);
  const [status, setStatus] = useState<GitStatus | null | undefined>(undefined);
  const [view, setView] = useState<"changes" | "history">("changes");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (root) ipc.gitStatus(root).then(setStatus).catch((e) => setError(String(e)));
  }, [root]);
  useEffect(refresh, [refresh, fsVersion]);
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      bumpFs();
    }
  };

  if (status === undefined) return <PanelHeader title="Source Control" />;
  if (status === null)
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Source Control" />
        <div className="p-4 text-[12px] text-muted">
          Not a git repository.
          <Button className="mt-3 w-full" onClick={() => run(() => ipc.run("git init", root))}>
            Initialize Repository
          </Button>
        </div>
      </div>
    );

  const staged = status.changes.filter((c) => c.staged);
  const unstaged = status.changes.filter((c) => !c.staged);
  const commit = () =>
    msg.trim() &&
    run(async () => {
      await ipc.gitCommit(status.root, msg.trim(), staged.length === 0);
      setMsg("");
    });

  const openDiff = (c: FileChange) => {
    const abs = joinPath(status.root, c.path);
    if (c.status === "?" || c.status === "D") return useWorkspace.getState().openFile(abs);
    const existing = useWorkspace.getState().tabs.find((t) => t.kind === "diff" && t.path === c.path && t.staged === c.staged);
    if (existing) return useWorkspace.getState().setActive(existing.id);
    openTab({ id: newId("d"), kind: "diff", title: `${basename(c.path)} (${c.staged ? "staged" : "diff"})`, root: status.root, path: c.path, staged: c.staged });
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Source Control">
        <IconBtn title="Refresh" onClick={refresh}>
          <RefreshCw size={13} />
        </IconBtn>
      </PanelHeader>
      <div className="flex border-b border-border text-[12px]">
        {(["changes", "history"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1.5 capitalize ${view === v ? "border-b border-accent text-fg" : "text-muted hover:text-fg"}`}
          >
            {v}
            {v === "changes" && status.changes.length > 0 && <span className="ml-1 text-muted">{status.changes.length}</span>}
          </button>
        ))}
      </div>
      {view === "history" ? (
        <History root={status.root} />
      ) : (
        <>
          <div className="space-y-1.5 border-b border-border p-2">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void commit();
                }
              }}
              placeholder={`Message (Ctrl+Enter to commit on ${status.branch})`}
              rows={3}
              className={`${inputCls} h-auto resize-none py-1.5`}
            />
            <div className="flex gap-1.5">
              <Button variant="primary" className="flex-1" disabled={busy || !msg.trim() || !status.changes.length} onClick={commit}>
                <Check size={13} /> Commit{staged.length === 0 ? " All" : ""}
              </Button>
              <Button
                title={status.upstream ? `Push to ${status.upstream}` : "Publish branch"}
                disabled={busy}
                onClick={() => run(() => ipc.gitPush(status.root))}
              >
                <ArrowUp size={13} />
                {status.ahead > 0 ? status.ahead : status.upstream ? "" : "Publish"}
              </Button>
            </div>
            {error && <div className="selectable max-h-24 overflow-auto text-[11px] whitespace-pre-wrap text-red">{error}</div>}
          </div>
          <div className="flex-1 overflow-auto">
            <ChangeGroup
              title="Staged Changes"
              changes={staged}
              onOpen={openDiff}
              actions={(c) => (
                <IconBtn title="Unstage" onClick={() => run(() => ipc.gitUnstage(status.root, [c.path]))}>
                  <Minus size={13} />
                </IconBtn>
              )}
              groupAction={
                <IconBtn title="Unstage all" onClick={() => run(() => ipc.gitUnstage(status.root, staged.map((c) => c.path)))}>
                  <Minus size={13} />
                </IconBtn>
              }
            />
            <ChangeGroup
              title="Changes"
              changes={unstaged}
              onOpen={openDiff}
              actions={(c) => (
                <>
                  <IconBtn
                    title="Discard"
                    onClick={() => confirm(`Discard changes to ${c.path}?`) && run(() => ipc.gitDiscard(status.root, c.path, c.status === "?"))}
                  >
                    <Undo2 size={13} />
                  </IconBtn>
                  <IconBtn title="Stage" onClick={() => run(() => ipc.gitStage(status.root, [c.path]))}>
                    <Plus size={13} />
                  </IconBtn>
                </>
              )}
              groupAction={
                <IconBtn title="Stage all" onClick={() => run(() => ipc.gitStage(status.root, unstaged.map((c) => c.path)))}>
                  <Plus size={13} />
                </IconBtn>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChangeGroup({
  title,
  changes,
  onOpen,
  actions,
  groupAction,
}: {
  title: string;
  changes: FileChange[];
  onOpen: (c: FileChange) => void;
  actions: (c: FileChange) => React.ReactNode;
  groupAction: React.ReactNode;
}) {
  if (!changes.length) return null;
  return (
    <div className="py-1">
      <div className="group flex h-6 items-center justify-between px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        <span>
          {title} <span className="font-normal">{changes.length}</span>
        </span>
        <div className="hidden group-hover:flex">{groupAction}</div>
      </div>
      {changes.map((c) => (
        <div key={c.path + c.staged} onClick={() => onOpen(c)} className="group flex h-6 cursor-pointer items-center gap-1.5 px-2 hover:bg-hover">
          <FileIcon name={basename(c.path)} size={14} />
          <span className="truncate text-[12.5px]">{basename(c.path)}</span>
          <span className="flex-1 truncate text-[11px] text-muted">{c.path.includes("/") ? c.path.replace(/\/[^/]*$/, "") : ""}</span>
          <div className="hidden group-hover:flex" onClick={(e) => e.stopPropagation()}>
            {actions(c)}
          </div>
          <span className={`w-3 text-center font-mono text-[11px] ${STATUS_COLOR[c.status] ?? "text-muted"}`}>{c.status === "?" ? "U" : c.status}</span>
        </div>
      ))}
    </div>
  );
}

const LANE = 12;
const ROW = 26;

function History({ root }: { root: string }) {
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const openTab = useWorkspace((s) => s.openTab);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => ipc.gitLog(root, q).then(setCommits).catch(() => setCommits([])), 150);
    return () => clearTimeout(t);
  }, [root, q, fsVersion]);

  useEffect(() => {
    ipc.run("git remote get-url origin", root).then((r) => {
      const url = r.stdout.trim().replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "");
      setRemote(r.code === 0 && url.startsWith("http") ? url : null);
    });
  }, [root]);

  const rows = useMemo(() => layoutGraph(commits), [commits]);
  const x = (lane: number) => LANE / 2 + 4 + lane * LANE;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commits" className={inputCls} />
      </div>
      <div className="flex-1 overflow-auto">
        {rows.map((r) => {
          const w = x(r.width) + 2;
          const color = (l: number) => LANE_COLORS[l % LANE_COLORS.length];
          return (
            <div
              key={r.commit.hash}
              onClick={() =>
                openTab({ id: newId("c"), kind: "commit", title: r.commit.hash.slice(0, 7), root, hash: r.commit.hash })
              }
              className="group flex cursor-pointer items-center pr-2 hover:bg-hover"
              style={{ height: ROW }}
              title={`${r.commit.hash.slice(0, 10)} · ${r.commit.author} · ${new Date(r.commit.date * 1000).toLocaleString()}`}
            >
              <svg width={w} height={ROW} className="shrink-0">
                {r.top.map(([a, b], i) => (
                  <path key={`t${i}`} d={`M${x(a)} 0 C${x(a)} ${ROW / 4} ${x(b)} ${ROW / 4} ${x(b)} ${ROW / 2}`} stroke={color(a)} fill="none" strokeWidth={1.5} />
                ))}
                {r.bottom.map(([a, b], i) => (
                  <path key={`b${i}`} d={`M${x(a)} ${ROW / 2} C${x(a)} ${(ROW * 3) / 4} ${x(b)} ${(ROW * 3) / 4} ${x(b)} ${ROW}`} stroke={color(b)} fill="none" strokeWidth={1.5} />
                ))}
                <circle cx={x(r.col)} cy={ROW / 2} r={r.commit.parents.length > 1 ? 3 : 4} fill={r.commit.parents.length > 1 ? "var(--c-bg)" : color(r.col)} stroke={color(r.col)} strokeWidth={1.5} />
              </svg>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px]">
                {r.commit.refs.map((ref) => (
                  <span
                    key={ref}
                    className={`shrink-0 rounded px-1 text-[10px] ${ref.startsWith("HEAD") ? "bg-accent text-accent-fg" : ref.startsWith("tag:") ? "bg-yellow/20 text-yellow" : "bg-blue/20 text-blue"}`}
                  >
                    {ref.replace("HEAD -> ", "")}
                  </span>
                ))}
                <span className="truncate">{r.commit.subject}</span>
              </div>
              {remote && (
                <button
                  title="Open on remote"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openUrl(`${remote}/commit/${r.commit.hash}`);
                  }}
                  className="ml-1 hidden text-muted group-hover:block hover:text-fg"
                >
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          );
        })}
        {!rows.length && <div className="p-4 text-[12px] text-muted">No commits.</div>}
      </div>
    </div>
  );
}
