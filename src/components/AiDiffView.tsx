import { unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { Check, X } from "lucide-react";
import { useMemo } from "react";
import { useChat } from "@/ai/store";
import { useEditorTheme } from "@/lib/editorTheme";
import { relPath } from "@/lib/ipc";
import { languageFor } from "@/lib/lang";
import { useWorkspace } from "@/lib/store";
import { Button } from "./ui";

/** Inline review of an AI-proposed edit before it touches disk. */
export function AiDiffView({ editId }: { editId: string }) {
  const edit = useChat((s) => s.edits[editId]);
  const resolve = useChat((s) => s.resolveEdit);
  const root = useWorkspace((s) => s.root);
  const theme = useEditorTheme();
  const ext = useMemo(
    () =>
      edit
        ? [
            ...languageFor(edit.path),
            unifiedMergeView({ original: edit.before, mergeControls: false, gutter: true }),
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
          ]
        : [],
    [edit?.id],
  );
  if (!edit) return <div className="p-6 text-muted">This edit is no longer available.</div>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="text-[12px]">
          <span className="text-muted">AI edit · </span>
          {relPath(root, edit.path)}
          {edit.before === "" && <span className="ml-2 rounded bg-green/15 px-1 text-[10px] text-green">new file</span>}
        </div>
        {edit.status === "pending" ? (
          <div className="flex gap-1.5">
            <Button variant="danger" onClick={() => resolve(edit.id, false)}>
              <X size={13} /> Reject
            </Button>
            <Button variant="primary" onClick={() => resolve(edit.id, true)}>
              <Check size={13} /> Accept
            </Button>
          </div>
        ) : (
          <span className={`text-[12px] ${edit.status === "accepted" ? "text-green" : "text-red"}`}>{edit.status}</span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <CodeMirror value={edit.after} height="100%" className="h-full" theme={theme} extensions={ext} editable={false} />
      </div>
    </div>
  );
}
