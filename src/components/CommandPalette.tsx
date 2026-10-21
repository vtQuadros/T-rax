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
    <div className="fixed inset-0 z-40 bg-[#050706]/70 px-6 pt-[120px]" onMouseDown={close}>
      <Command
        shouldFilter={commandMode}
        filter={(value, search) => (value.toLowerCase().includes(search.slice(1).trim().toLowerCase()) ? 1 : 0)}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        label="Command palette"
        className="mx-auto w-full max-w-[600px] overflow-hidden rounded-xl border border-border-strong bg-panel"
      >
        <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-4">
          <span aria-hidden className="font-mono text-[15px] font-semibold text-accent">›</span>
          <Command.Input
            autoFocus
            value={q}
            onValueChange={setQ}
            placeholder="Search files, or type > for commands"
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim focus-visible:outline-none"
          />
          <kbd className="rounded border border-border-strong px-1.5 py-px font-mono text-[11px] text-muted">esc</kbd>
        </div>
        <Command.List className="max-h-[50vh] overflow-auto p-1.5">
          <Command.Empty className="p-4 text-center text-[13px] text-muted">No results.</Command.Empty>
          {commandMode
            ? [...commands, ...themeCmds].map((c) => (
                <Command.Item
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    close();
                    c.run();
                  }}
                  className="flex h-[38px] cursor-pointer items-center justify-between rounded-lg px-3 text-[13.5px] text-fg-soft data-[selected=true]:text-fg"
                >
                  {c.label}
                  {c.hint && <span className="font-mono text-[11px] text-dim">{c.hint}</span>}
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
                  className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13.5px] text-fg-soft data-[selected=true]:text-fg"
                >
                  <FileIcon name={basename(f)} size={14} />
                  <span>{basename(f)}</span>
                  <span className="truncate font-mono text-[11.5px] text-dim">{relPath(root, f)}</span>
                </Command.Item>
              ))}
        </Command.List>
        <div className="flex gap-4 border-t border-border px-4 py-2.5 font-mono text-[11px] text-dim">
          <span>↑↓ navigate</span>
          <span>⏎ open</span>
          <span>{commandMode ? "commands" : "> for commands"}</span>
        </div>
      </Command>
    </div>
  );
}
