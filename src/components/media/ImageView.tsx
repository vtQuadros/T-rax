import { Code2, ExternalLink, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ipc } from "@/lib/ipc";
import { useWorkspace } from "@/lib/store";
import { IconBtn } from "../Explorer";
import { formatBytes, useCtrlWheel, useMediaFile } from "./useMediaFile";

const STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];

export function ImageView({ path, active }: { path: string; active: boolean }) {
  const { file, error } = useMediaFile(path, active);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const ext = path.split(".").pop()?.toUpperCase() ?? "";

  // Scale that makes the whole image visible (never upscaled past 100%).
  useEffect(() => {
    const el = box.current;
    if (!el || !natural) return;
    const update = () => setFitScale(Math.min(1, (el.clientWidth - 48) / natural.w, (el.clientHeight - 48) / natural.h));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  const scale = zoom === "fit" ? fitScale : zoom;
  const step = (dir: 1 | -1) =>
    setZoom(dir > 0 ? (STEPS.find((s) => s > scale + 0.001) ?? 8) : ([...STEPS].reverse().find((s) => s < scale - 0.001) ?? 0.1));

  useCtrlWheel(box, step);

  // Drag to pan when the image is larger than the view.
  const onPointerDown = (e: React.PointerEvent) => {
    const el = box.current!;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    box.current!.scrollLeft = d.left - (e.clientX - d.x);
    box.current!.scrollTop = d.top - (e.clientY - d.y);
  };

  return (
    <div className="flex h-full flex-col">
      <MediaToolbar
        path={path}
        info={[natural ? `${natural.w} × ${natural.h}` : null, file ? formatBytes(file.size) : null, ext].filter(Boolean).join(" · ")}
      >
        <IconBtn title="Zoom out (Ctrl+scroll)" onClick={() => step(-1)}>
          <Minus size={14} strokeWidth={1.8} />
        </IconBtn>
        <button
          onClick={() => setZoom(1)}
          title="Actual size"
          className="h-7 w-14 rounded-md text-center font-mono text-[12px] text-fg-soft hover:bg-hover hover:text-fg"
        >
          {Math.round(scale * 100)}%
        </button>
        <IconBtn title="Zoom in (Ctrl+scroll)" onClick={() => step(1)}>
          <Plus size={14} strokeWidth={1.8} />
        </IconBtn>
        <IconBtn title="Fit to view" active={zoom === "fit"} onClick={() => setZoom("fit")}>
          <Maximize size={13} strokeWidth={1.8} />
        </IconBtn>
        {ext === "SVG" && (
          <IconBtn title="View source" onClick={() => useWorkspace.getState().openFile(path, undefined, true)}>
            <Code2 size={14} strokeWidth={1.8} />
          </IconBtn>
        )}
      </MediaToolbar>
      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        className="flex min-h-0 flex-1 overflow-auto"
        style={{ cursor: drag.current ? "grabbing" : "default" }}
      >
        {(error || loadError) && (
          <div className="m-auto font-mono text-[12px] text-red">{error ?? "This image could not be displayed."}</div>
        )}
        {file && (
          <img
            src={file.src}
            alt={path.split("/").pop()}
            draggable={false}
            onLoad={(e) => {
              setLoadError(false);
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h) setNatural({ w, h });
              else void svgSize(file.src).then(setNatural);
            }}
            onError={() => setLoadError(true)}
            className="checkerboard m-auto max-w-none shrink-0 select-none"
            style={natural ? { width: natural.w * scale, height: natural.h * scale } : { visibility: "hidden" }}
          />
        )}
      </div>
    </div>
  );
}

/** Shared 40px toolbar for media tabs: file name and info, then controls. */
export function MediaToolbar({ path, info, children }: { path: string; info: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border py-1 pr-2 pl-6">
      <div className="flex min-w-0 items-baseline gap-2 font-mono text-[12px]">
        <span className="truncate text-fg">{path.split("/").pop()}</span>
        <span className="truncate text-muted">{info}</span>
      </div>
      <div className="flex items-center gap-0.5">
        {children}
        <span className="mx-1 h-4 w-px bg-border" />
        <IconBtn title="Open in system app" onClick={() => void ipc.openDefault(path)}>
          <ExternalLink size={13} strokeWidth={1.8} />
        </IconBtn>
      </div>
    </div>
  );
}

/** SVGs with only a viewBox have no intrinsic size; derive one from the viewBox. */
async function svgSize(src: string): Promise<{ w: number; h: number }> {
  try {
    const text = await (await fetch(src)).text();
    const vb = text.match(/viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (vb) {
      const w = Number(vb[1]);
      const h = Number(vb[2]);
      const k = 512 / Math.max(w, h);
      return { w: Math.round(w * k), h: Math.round(h * k) };
    }
  } catch {}
  return { w: 512, h: 512 };
}
