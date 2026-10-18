import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeft, ExternalLink, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { useWorkspace } from "@/lib/store";
import { IconBtn } from "./Explorer";

export function PreviewView({ tabId, url }: { tabId: string; url: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [draft, setDraft] = useState(url);
  const [key, setKey] = useState(0);
  const updateTab = useWorkspace((s) => s.updateTab);

  const go = (u: string) => {
    const next = /^https?:\/\//.test(u) ? u : `http://${u}`;
    setDraft(next);
    updateTab(tabId, { url: next, title: next.replace(/^https?:\/\//, "") });
    setKey((k) => k + 1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <IconBtn title="Back" onClick={() => {
            try {
              frame.current?.contentWindow?.history.back();
            } catch {
              // Cross-origin frames do not expose history.
            }
          }}>
          <ArrowLeft size={13} />
        </IconBtn>
        <IconBtn title="Reload" onClick={() => setKey((k) => k + 1)}>
          <RotateCw size={13} />
        </IconBtn>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(draft)}
          className="h-6 flex-1 rounded-md border border-border bg-elevated px-2 font-mono text-[11.5px] outline-none focus:border-accent/60"
        />
        <IconBtn title="Open in browser" onClick={() => void openUrl(url)}>
          <ExternalLink size={13} />
        </IconBtn>
      </div>
      <iframe key={key} ref={frame} src={url} className="min-h-0 flex-1 bg-white" title="preview" />
    </div>
  );
}
