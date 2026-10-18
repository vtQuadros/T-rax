import { useCallback, useEffect, useState } from "react";
import { hunkPatch, parseDiff, type ParsedDiff } from "@/lib/diff";
import { ipc } from "@/lib/ipc";
import { useWorkspace } from "@/lib/store";
import { Button } from "./ui";

/** Unified diff of one file with hunk-level stage / unstage / discard. */
export function DiffView({ root, path, staged }: { root: string; path: string; staged: boolean }) {
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const bumpFs = useWorkspace((s) => s.bumpFs);
  const [diff, setDiff] = useState<ParsedDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .gitDiff(root, path, staged)
      .then((t) => setDiff(parseDiff(t)))
      .catch((e) => setError(String(e)));
  }, [root, path, staged]);

  useEffect(load, [load, fsVersion]);

  const apply = async (patch: string, cached: boolean, reverse: boolean) => {
    try {
      await ipc.gitApply(root, patch, cached, reverse);
      bumpFs();
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <div className="p-6 text-red">{error}</div>;
  if (!diff) return <div className="p-6 text-muted">Loading…</div>;
  if (!diff.hunks.length)
    return <div className="p-6 text-muted">No {staged ? "staged" : "unstaged"} changes in {path}.</div>;

  return (
    <div className="h-full overflow-auto p-4 font-mono text-[12px] selectable">
      <div className="mb-3 font-sans text-[12px] text-muted">
        {path} · {staged ? "Staged" : "Working tree"}
      </div>
      {diff.hunks.map((h) => (
        <div key={h.header} className="mb-4 overflow-hidden rounded-md border border-border">
          <div className="flex items-center justify-between bg-elevated px-3 py-1 font-sans">
            <span className="font-mono text-[11px] text-cyan">{h.header}</span>
            <div className="flex gap-1">
              {staged ? (
                <Button variant="ghost" onClick={() => apply(hunkPatch(diff, h), true, true)}>
                  Unstage hunk
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => confirm("Discard this hunk?") && apply(hunkPatch(diff, h), false, true)}>
                    Discard
                  </Button>
                  <Button variant="ghost" onClick={() => apply(hunkPatch(diff, h), true, false)}>
                    Stage hunk
                  </Button>
                </>
              )}
            </div>
          </div>
          {h.lines.map((l, i) => (
            <div
              key={i}
              className={`whitespace-pre px-3 ${
                l[0] === "+" ? "bg-green/10 text-green" : l[0] === "-" ? "bg-red/10 text-red" : "text-fg/75"
              }`}
            >
              {l || " "}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CommitView({ root, hash }: { root: string; hash: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    ipc.gitShow(root, hash).then(setText).catch((e) => setText(String(e)));
  }, [root, hash]);
  return (
    <pre className="selectable h-full overflow-auto p-4 font-mono text-[12px]">
      {text.split("\n").map((l, i) => (
        <div
          key={i}
          className={
            l.startsWith("+") && !l.startsWith("+++")
              ? "text-green"
              : l.startsWith("-") && !l.startsWith("---")
                ? "text-red"
                : l.startsWith("@@")
                  ? "text-cyan"
                  : l.startsWith("diff --git")
                    ? "mt-3 font-semibold text-fg"
                    : "text-fg/80"
          }
        >
          {l || " "}
        </div>
      ))}
    </pre>
  );
}
