import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { basename, ipc, relPath } from "@/lib/ipc";
import { useSettings, useWorkspace } from "@/lib/store";
import { APP_THEMES } from "@/lib/themes";
import { FileIcon } from "./FileIcon";

export type PaletteCommand = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({ commands }: { commands: PaletteCommand[] }) {
  const open = useWorkspace((s) => s.paletteOpen);
  const root = useWorkspace((s) => s.root);
  const initial = useWorkspace((s) => s.paletteInitial);
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const close = () => useWorkspace.getState().set({ paletteOpen: false });

  useEffect(() => {
    if (open) setQ(initial ?? "");
  }, [open, initial]);

  const commandMode = q.startsWith(">");
  useEffect(() => {
    if (!open || commandMode || !root) return;
    const t = setTimeout(() => ipc.searchFiles(root, q, 50).then(setFiles), 60);
    return () => clearTimeout(t);
  }, [q, open, commandMode, root]);

  const themeCmds = useMemo<PaletteCommand[]>(
    () =>
      [...APP_THEMES, ...useSettings.getState().customThemes].map((t) => ({
        id: `theme-${t.id}`,
        label: `Theme: ${t.name}`,
        run: () => useSettings.getState().set({ appTheme: t.id }),
      })),
    [open],
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/30" onMouseDown={close}>
      <Command
        shouldFilter={commandMode}
        filter={(value, search) => (value.toLowerCase().includes(search.slice(1).trim().toLowerCase()) ? 1 : 0)}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        className="mx-auto mt-[12vh] w-[min(620px,92vw)] overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
      >
        <Command.Input
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Search files by name, or type > for commands"
          className="h-11 w-full border-b border-border bg-transparent px-4 text-[13px] outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-[50vh] overflow-auto p-1">
          <Command.Empty className="p-4 text-center text-[12px] text-muted">No results.</Command.Empty>
          {commandMode
            ? [...commands, ...themeCmds].map((c) => (
                <Command.Item
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    close();
                    c.run();
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-[12.5px]"
                >
                  {c.label}
                  {c.hint && <span className="text-[11px] text-muted">{c.hint}</span>}
                </Command.Item>
              ))
            : files.map((f) => (
                <Command.Item
                  key={f}
                  value={f}
                  onSelect={() => {
                    close();
                    useWorkspace.getState().openFile(f);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[12.5px]"
                >
                  <FileIcon name={basename(f)} size={14} />
                  <span>{basename(f)}</span>
                  <span className="truncate text-[11px] text-muted">{relPath(root, f)}</span>
                </Command.Item>
              ))}
        </Command.List>
      </Command>
    </div>
  );
}
