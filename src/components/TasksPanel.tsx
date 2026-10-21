import { Circle, CircleCheck, CircleDot, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useChat } from "@/ai/store";
import { NO_TASKS, newId, openAgent, type TaskItem, useTasks, useWorkspace } from "@/lib/store";
import { IconBtn, PanelHeader } from "./Explorer";
import { Button, inputCls } from "./ui";

const NEXT: Record<TaskItem["status"], TaskItem["status"]> = { pending: "in_progress", in_progress: "done", done: "pending" };

/** Plans & tasks for the workspace; agents read and update the same list. */
export function TasksPanel() {
  const root = useWorkspace((s) => s.root);
  const tasks = useTasks((s) => s.byRoot[root] ?? NO_TASKS);
  const setTasks = useTasks((s) => s.setTasks);
  const running = useChat((s) => s.running);
  const [text, setText] = useState("");
  const update = (items: TaskItem[]) => setTasks(root, items);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Plans & Tasks">
        {tasks.length > 0 && (
          <IconBtn title="Clear finished" onClick={() => update(tasks.filter((t) => t.status !== "done"))}>
            <Trash2 size={13} />
          </IconBtn>
        )}
      </PanelHeader>
      <div className="px-3 pb-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              update([...tasks, { id: newId("task"), text: text.trim(), status: "pending" }]);
              setText("");
            }
          }}
          placeholder="Add a task and press Enter"
          aria-label="New task"
          className={inputCls}
        />
        {tasks.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded bg-hover">
              <div className="h-full bg-accent" style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            <span className="font-mono text-[11px] text-muted">
              {done}/{tasks.length}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto px-2">
        {tasks.map((t) => (
          <div key={t.id} className="row group flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-elevated">
            <button
              className="mt-0.5 shrink-0 rounded"
              aria-label={`Status: ${t.status.replace("_", " ")}`}
              title="Toggle status"
              onClick={() => update(tasks.map((x) => (x.id === t.id ? { ...x, status: NEXT[x.status] } : x)))}
            >
              {t.status === "done" ? (
                <CircleCheck size={15} strokeWidth={1.8} className="text-accent" />
              ) : t.status === "in_progress" ? (
                <CircleDot size={15} strokeWidth={1.8} className="text-yellow" />
              ) : (
                <Circle size={15} strokeWidth={1.8} className="text-dim" />
              )}
            </button>
            <span className={`flex-1 text-[13px] leading-normal ${t.status === "done" ? "text-dim line-through" : t.status === "in_progress" ? "text-fg" : "text-fg-soft"}`}>{t.text}</span>
            <button className="hidden text-muted group-hover:block hover:text-red" onClick={() => update(tasks.filter((x) => x.id !== t.id))}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {!tasks.length && <div className="px-2 py-4 text-[13px] leading-relaxed text-muted">No tasks yet. Add one, or ask the agent to plan the work.</div>}
      </div>
      {tasks.some((t) => t.status !== "done") && (
        <div className="p-3">
          <Button
            className="w-full"
            disabled={running}
            onClick={() => {
              openAgent();
              void useChat.getState().send("Continue working through the task list. Pick up where we left off and keep the list updated.");
            }}
          >
            <Play size={12} /> Agent: continue tasks
          </Button>
        </div>
      )}
    </div>
  );
}
