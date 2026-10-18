import { ipc, joinPath, relPath } from "@/lib/ipc";
import { newId, type TaskItem, useTasks, useWorkspace } from "@/lib/store";
import type { ToolDef } from "./providers";

const obj = (properties: Record<string, unknown>, required: string[] = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
});
const str = (description: string) => ({ type: "string", description });

export const READ_TOOLS: ToolDef[] = [
  { name: "read_file", description: "Read a text file. Paths are relative to the project root.", parameters: obj({ path: str("File path") }) },
  { name: "list_dir", description: "List a directory (relative to the project root; '.' for root).", parameters: obj({ path: str("Directory path") }) },
  {
    name: "grep",
    description: "Search file contents across the project (gitignore-aware). Returns path:line: text.",
    parameters: obj({ query: str("Literal text or regex"), regex: { type: "boolean", description: "Treat query as regex" } }, ["query"]),
  },
  { name: "find_files", description: "Fuzzy-find files by name.", parameters: obj({ query: str("Part of a file name or path") }) },
];

export const WRITE_TOOLS: ToolDef[] = [
  {
    name: "write_file",
    description: "Create or overwrite a file with full content. The user reviews the diff before it is written to disk.",
    parameters: obj({ path: str("File path"), content: str("Complete new file content") }),
  },
  {
    name: "edit_file",
    description:
      "Replace an exact, unique snippet in a file. old_string must match exactly once. The user reviews the diff before it lands.",
    parameters: obj({ path: str("File path"), old_string: str("Exact existing text"), new_string: str("Replacement text") }),
  },
  {
    name: "run_command",
    description: "Run a non-interactive shell command in the project root (the user approves it first). Returns stdout/stderr/exit code.",
    parameters: obj({ command: str("Shell command") }),
  },
  {
    name: "update_tasks",
    description:
      "Replace the project's plan/task list shown in the Tasks panel. Use it to plan multi-step work and to mark progress as you go.",
    parameters: obj({
      tasks: {
        type: "array",
        items: obj({ text: str("Task"), status: { type: "string", enum: ["pending", "in_progress", "done"] } }),
      },
    }),
  },
  {
    name: "spawn_subagent",
    description:
      "Delegate a self-contained research question to a sub-agent with read-only tools. Returns its final answer. Use for parallelizable investigation.",
    parameters: obj({ task: str("What the sub-agent should find out") }),
  },
];

export type PendingEdit = {
  id: string;
  path: string;
  before: string;
  after: string;
  status: "pending" | "accepted" | "rejected";
};

export type Approval = { id: string; command: string; status: "pending" | "allowed" | "denied" };

type Hooks = {
  proposeEdit: (e: PendingEdit) => Promise<boolean>;
  approveCommand: (command: string) => Promise<boolean>;
  runSubagent: (task: string) => Promise<string>;
};

const abs = (p: string) => joinPath(useWorkspace.getState().root, p || ".");

export async function executeTool(name: string, rawArgs: string, hooks: Hooks): Promise<string> {
  let a: any;
  try {
    a = JSON.parse(rawArgs || "{}");
  } catch {
    return `Error: arguments are not valid JSON: ${rawArgs.slice(0, 200)}`;
  }
  const root = useWorkspace.getState().root;
  try {
    switch (name) {
      case "read_file": {
        const text = await ipc.readFile(abs(a.path));
        const lines = text.split("\n");
        const body = lines.slice(0, 2000).map((l, i) => `${String(i + 1).padStart(5)}\t${l}`).join("\n");
        return lines.length > 2000 ? `${body}\n… (${lines.length - 2000} more lines)` : body;
      }
      case "list_dir": {
        const entries = await ipc.readDir(abs(a.path), true);
        return entries.map((e) => `${e.name}${e.isDir ? "/" : ""}`).join("\n") || "(empty)";
      }
      case "grep": {
        const r = await ipc.grep(root, a.query, { regex: !!a.regex, limit: 200 });
        return r.map((m) => `${relPath(root, m.path)}:${m.line}: ${m.text}`).join("\n") || "No matches.";
      }
      case "find_files": {
        const r = await ipc.searchFiles(root, a.query, 40);
        return r.map((p) => relPath(root, p)).join("\n") || "No files.";
      }
      case "write_file":
      case "edit_file": {
        const path = abs(a.path);
        const before = await ipc.readFile(path).catch(() => "");
        let after: string;
        if (name === "write_file") after = a.content ?? "";
        else {
          const count = before.split(a.old_string).length - 1;
          if (!a.old_string || count === 0) return "Error: old_string not found in file. Read the file and retry with exact text.";
          if (count > 1) return `Error: old_string matches ${count} times; include more context so it is unique.`;
          after = before.replace(a.old_string, () => a.new_string);
        }
        if (after === before) return "No changes.";
        const ok = await hooks.proposeEdit({ id: newId("edit"), path, before, after, status: "pending" });
        return ok ? `Applied edit to ${a.path}.` : `The user rejected the edit to ${a.path}. Ask them what to change.`;
      }
      case "run_command": {
        const ok = await hooks.approveCommand(a.command);
        if (!ok) return "The user denied running this command.";
        const r = await ipc.run(a.command, root, 300);
        useWorkspace.getState().bumpFs();
        return [`exit code: ${r.code ?? "none"}${r.timedOut ? " (timed out)" : ""}`, r.stdout && `stdout:\n${r.stdout}`, r.stderr && `stderr:\n${r.stderr}`]
          .filter(Boolean)
          .join("\n");
      }
      case "update_tasks": {
        const tasks: TaskItem[] = (a.tasks ?? []).map((t: any) => ({
          id: newId("task"),
          text: String(t.text),
          status: ["pending", "in_progress", "done"].includes(t.status) ? t.status : "pending",
        }));
        useTasks.getState().setTasks(root, tasks);
        return `Task list updated (${tasks.length} tasks).`;
      }
      case "spawn_subagent":
        return await hooks.runSubagent(a.task);
      default:
        return `Error: unknown tool ${name}`;
    }
  } catch (e) {
    return `Error: ${e}`;
  }
}
