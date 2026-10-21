import { openUrl } from "@tauri-apps/plugin-opener";
import { X } from "lucide-react";
import { useEffect } from "react";
import { checkForUpdate, debUrl, installUpdate, releaseUrl, selfUpdating, skipVersion, useUpdate } from "@/lib/updater";
import { Button } from "./ui";

export function UpdateToast() {
  const u = useUpdate();

  // "Up to date" is a confirmation, not something to dismiss by hand.
  useEffect(() => {
    if (u.status !== "uptodate") return;
    const t = setTimeout(() => useUpdate.setState({ status: "idle" }), 4000);
    return () => clearTimeout(t);
  }, [u.status]);

  if (u.status === "idle" || u.status === "checking" || u.dismissed) return null;
  const close = () => (u.status === "available" ? useUpdate.setState({ dismissed: true }) : useUpdate.setState({ status: "idle" }));

  return (
    <div role="status" aria-live="polite" className="fixed right-4 bottom-10 z-30 w-[340px] rounded-xl border border-border-strong bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {u.status === "uptodate" && <div className="text-[13px] font-semibold">You're on the latest version</div>}
          {u.status === "error" && <div className="text-[13px] font-semibold">Couldn't check for updates</div>}
          {(u.status === "available" || u.status === "downloading" || u.status === "ready") && (
            <div className="text-[13px] font-semibold">T-rax {u.version} is available</div>
          )}
          <div className="mt-0.5 font-mono text-[11.5px] text-muted">
            {u.status === "error" ? <span className="text-red">{u.error?.slice(0, 160)}</span> : `installed ${u.current}`}
          </div>
        </div>
        {u.status !== "downloading" && (
          <button onClick={close} aria-label="Close" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg">
            <X size={13} />
          </button>
        )}
      </div>

      {u.status === "available" && u.notes && (
        <p className="mt-3 line-clamp-4 text-[12.5px] leading-relaxed whitespace-pre-line text-fg-soft">{u.notes.replace(/^#+\s*/gm, "")}</p>
      )}

      {u.status === "available" && u.kind === "deb" && (
        <div className="mt-3 rounded-lg bg-bg px-3 py-2 font-mono text-[11.5px] text-fg-soft select-text">sudo apt install ./T-rax_{u.version}_amd64.deb</div>
      )}

      {(u.status === "downloading" || u.status === "ready") && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded bg-hover">
            <div className="h-full bg-accent" style={{ width: `${Math.round(u.progress * 100)}%` }} />
          </div>
          <span className="w-16 text-right font-mono text-[11px] text-muted">
            {u.status === "ready" ? "restarting" : `${Math.round(u.progress * 100)}%`}
          </span>
        </div>
      )}

      {u.status === "available" && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={skipVersion}>
            Skip
          </Button>
          <Button onClick={() => void openUrl(releaseUrl(u.version!))}>Notes</Button>
          {selfUpdating(u.kind) ? (
            <Button variant="primary" onClick={() => void installUpdate()}>
              Update &amp; restart
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void openUrl(u.kind === "deb" ? debUrl(u.version!) : releaseUrl(u.version!))}>
              Download{u.kind === "deb" ? " .deb" : ""}
            </Button>
          )}
        </div>
      )}

      {u.status === "error" && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void checkForUpdate(true)}>Retry</Button>
        </div>
      )}
    </div>
  );
}
