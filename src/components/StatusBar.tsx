import { GitBranch, Globe, Keyboard, ListTodo } from "lucide-react";
import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { languageName } from "@/lib/lang";
import { NO_TASKS, useSettings, useTasks, useWorkspace } from "@/lib/store";

export function StatusBar() {
  const root = useWorkspace((s) => s.root);
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const tab = useWorkspace((s) => s.tabs.find((t) => t.id === s.activeId));
  const urls = useWorkspace((s) => s.detectedUrls);
  const vim = useSettings((s) => s.vim);
  const tasks = useTasks((s) => s.byRoot[root] ?? NO_TASKS);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    const load = () => ipc.gitBranch(root).then(setBranch);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [root, fsVersion]);

  const open = tasks.filter((t) => t.status !== "done").length;
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-panel px-3 text-[11px] text-muted">
      {branch && (
        <button className="flex items-center gap-1 hover:text-fg" onClick={() => useWorkspace.getState().setSidebar("git")}>
          <GitBranch size={11} /> {branch}
        </button>
      )}
      <span className="truncate">{root.replace(/^\/home\/[^/]+/, "~")}</span>
      {tasks.length > 0 && (
        <button className="flex items-center gap-1 hover:text-fg" onClick={() => useWorkspace.getState().setSidebar("tasks")}>
          <ListTodo size={11} /> {tasks.length - open}/{tasks.length}
        </button>
      )}
      <div className="flex-1" />
      {urls[0] && (
        <button
          className="flex items-center gap-1 text-blue hover:underline"
          title="Dev server detected — open preview"
          onClick={() => useWorkspace.getState().openPreview(urls[0])}
        >
          <Globe size={11} /> {urls[0].replace(/^https?:\/\//, "")}
        </button>
      )}
      {tab?.kind === "editor" && (
        <>
          {vim && (
            <span className="flex items-center gap-1">
              <Keyboard size={11} /> VIM
            </span>
          )}
          <span>{languageName(tab.path)}</span>
        </>
      )}
      <span>UTF-8</span>
    </div>
  );
}
