import { GitBranch } from "lucide-react";
import { useEffect } from "react";
import { ipc, shortHome } from "@/lib/ipc";
import { languageName } from "@/lib/lang";
import { NO_TASKS, useSettings, useTasks, useWorkspace } from "@/lib/store";
import { useUpdate } from "@/lib/updater";

/** Polls `git status` for the whole app; panels read it from the store. */
function useGitPolling() {
  const root = useWorkspace((s) => s.root);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  useEffect(() => {
    if (!root) return;
    let alive = true;
    const load = () =>
      ipc
        .gitStatus(root)
        .then((git) => alive && useWorkspace.setState({ git }))
        .catch(() => alive && useWorkspace.setState({ git: null }));
    load();
    const t = setInterval(() => !document.hidden && load(), 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [root, fsVersion]);
}

export function StatusBar() {
  useGitPolling();
  const root = useWorkspace((s) => s.root);
  const git = useWorkspace((s) => s.git);
  const tab = useWorkspace((s) => s.tabs.find((t) => t.id === s.activeId));
  const urls = useWorkspace((s) => s.detectedUrls);
  const vim = useSettings((s) => s.vim);
  const tasks = useTasks((s) => s.byRoot[root] ?? NO_TASKS);
  const done = tasks.filter((t) => t.status === "done").length;
  const update = useUpdate((s) => (s.status === "available" && s.dismissed ? s.version : null));

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-border bg-bg px-4 font-mono text-[11.5px] text-muted">
      {git && (
        <button className="flex items-center gap-1.5 hover:text-fg" onClick={() => useWorkspace.getState().setSidebar("git")}>
          <GitBranch size={12} strokeWidth={2} />
          {git.branch}
          {git.ahead > 0 && ` ↑${git.ahead}`}
          {git.behind > 0 && ` ↓${git.behind}`}
        </button>
      )}
      <span className="truncate">{shortHome(root)}</span>
      {tasks.length > 0 && (
        <button className="hover:text-fg" onClick={() => useWorkspace.getState().setSidebar("tasks")}>
          tasks {done}/{tasks.length}
        </button>
      )}
      <span className="flex-1" />
      {urls[0] && (
        <button
          className="flex items-center gap-1.5 text-accent hover:underline"
          title="Dev server detected: open preview"
          onClick={() => useWorkspace.getState().openPreview(urls[0])}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          {urls[0].replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </button>
      )}
      {tab?.kind === "editor" && (
        <>
          {vim && <span className="text-fg-soft">VIM</span>}
          <span>{languageName(tab.path)}</span>
        </>
      )}
      <span>UTF-8</span>
      {update && (
        <button className="text-accent hover:underline" title="Show update" onClick={() => useUpdate.setState({ dismissed: false })}>
          ↑ {update}
        </button>
      )}
    </footer>
  );
}
