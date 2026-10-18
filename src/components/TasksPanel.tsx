import { Circle, CircleCheck, CircleDot, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useChat } from "@/ai/store";
import { NO_TASKS, newId, type TaskItem, useTasks, useWorkspace } from "@/lib/store";
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
      <div className="border-b border-border p-2">
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
          className={inputCls}
        />
        {tasks.length > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded bg-hover">
            <div className="h-full bg-green transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto py-1">
        {tasks.map((t) => (
          <div key={t.id} className="group flex items-start gap-2 px-2 py-1 hover:bg-hover/60">
            <button
              className="mt-0.5 shrink-0"
              title="Toggle status"
              onClick={() => update(tasks.map((x) => (x.id === t.id ? { ...x, status: NEXT[x.status] } : x)))}
            >
              {t.status === "done" ? (
                <CircleCheck size={14} className="text-green" />
              ) : t.status === "in_progress" ? (
                <CircleDot size={14} className="text-yellow" />
              ) : (
                <Circle size={14} className="text-muted" />
              )}
            </button>
            <span className={`flex-1 text-[12.5px] ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.text}</span>
            <button className="hidden text-muted group-hover:block hover:text-red" onClick={() => update(tasks.filter((x) => x.id !== t.id))}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {!tasks.length && <div className="p-4 text-[12px] text-muted">No tasks yet. Add one, or ask the agent to plan the work.</div>}
      </div>
      {tasks.some((t) => t.status !== "done") && (
        <div className="border-t border-border p-2">
          <Button
            className="w-full"
            disabled={running}
            onClick={() => {
              useWorkspace.getState().set({ aiOpen: true });
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
