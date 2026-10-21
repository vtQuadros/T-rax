import { ChevronDown, ChevronUp, Minus, MoveHorizontal, Plus, Search, X } from "lucide-react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask, TextLayer } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconBtn } from "../Explorer";
import { MediaToolbar } from "./ImageView";
import { formatBytes, useCtrlWheel, useMediaFile } from "./useMediaFile";

GlobalWorkerOptions.workerSrc = workerUrl;

const STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const GAP = 16;
type Size = { w: number; h: number };

export function PdfView({ path, active }: { path: string; active: boolean }) {
  const { file, error: fileError } = useMediaFile(path, active);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | "width">("width");
  const [boxWidth, setBoxWidth] = useState(800);
  const [visible, setVisible] = useState<Set<number>>(new Set([1]));
  const [current, setCurrent] = useState(1);
  const [search, setSearch] = useState<{ open: boolean; q: string; hits: number[]; i: number }>({ open: false, q: "", hits: [], i: 0 });
  const [rendered, setRendered] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const texts = useRef(new Map<number, string>());
  const bumpRendered = useCallback(() => setRendered((r) => r + 1), []);

  // Load (and reload when the file changes on disk).
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    setError(null);
    (async () => {
      try {
        const data = new Uint8Array(await (await fetch(file.src)).arrayBuffer());
        task = getDocument({ data });
        const loaded = await task.promise;
        if (cancelled) return;
        // Page sizes up front so the scrollbar is right before anything renders.
        const all: Size[] = [];
        for (let n = 1; n <= loaded.numPages; n++) {
          const vp = (await loaded.getPage(n)).getViewport({ scale: 1 });
          all.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        texts.current.clear();
        setSizes(all);
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [file]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // US Letter width until the real page sizes are known.
  const widest = useMemo(() => (sizes.length ? Math.max(...sizes.map((s) => s.w)) : 612), [sizes]);
  const scale = zoom === "width" ? Math.max(0.25, (boxWidth - 48) / widest) : zoom;
  const step = (dir: 1 | -1) =>
    setZoom(dir > 0 ? (STEPS.find((s) => s > scale + 0.001) ?? 3) : ([...STEPS].reverse().find((s) => s < scale - 0.001) ?? 0.5));
  useCtrlWheel(box, step);

  // Which pages are near the viewport (only those render).
  useEffect(() => {
    const el = box.current;
    if (!el || !doc) return;
    const io = new IntersectionObserver(
      (entries) =>
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.page);
            if (e.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        }),
      { root: el, rootMargin: "800px 0px" },
    );
    el.querySelectorAll("[data-page]").forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [doc, sizes]);

  const onScroll = () => {
    const el = box.current!;
    const mark = el.scrollTop + el.clientHeight * 0.3;
    let y = GAP;
    for (let i = 0; i < sizes.length; i++) {
      y += sizes[i].h * scale + GAP;
      if (y > mark) return setCurrent(i + 1);
    }
  };

  const goTo = useCallback(
    (n: number) => {
      const page = box.current?.querySelector(`[data-page="${n}"]`) as HTMLElement | null;
      if (page) box.current!.scrollTo({ top: page.offsetTop - GAP });
    },
    [],
  );

  // Search: find pages whose text contains the query, jump between them.
  const runSearch = async (q: string) => {
    if (!doc || !q.trim()) return setSearch((s) => ({ ...s, q, hits: [], i: 0 }));
    const needle = q.toLowerCase();
    const hits: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      let t = texts.current.get(n);
      if (t == null) {
        const content = await (await doc.getPage(n)).getTextContent();
        t = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").toLowerCase();
        texts.current.set(n, t);
      }
      if (t.includes(needle)) hits.push(n);
    }
    setSearch((s) => ({ ...s, q, hits, i: 0 }));
    if (hits[0]) goTo(hits[0]);
  };
  const jump = (d: 1 | -1) =>
    setSearch((s) => {
      if (!s.hits.length) return s;
      const i = (s.i + d + s.hits.length) % s.hits.length;
      goTo(s.hits[i]);
      return { ...s, i };
    });

  // Ctrl+F while this tab is active.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearch((s) => ({ ...s, open: true }));
        requestAnimationFrame(() => searchInput.current?.select());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Highlight matches inside the rendered text layers (CSS Custom Highlight API).
  useEffect(() => {
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!reg || !HighlightCtor || !box.current) return;
    const q = search.open ? search.q.trim().toLowerCase() : "";
    if (!q) return void reg.delete("pdf-search");
    const ranges: Range[] = [];
    box.current.querySelectorAll<HTMLElement>(".textLayer span").forEach((span) => {
      const node = span.firstChild;
      const text = node?.textContent?.toLowerCase() ?? "";
      for (let at = text.indexOf(q); node && at !== -1; at = text.indexOf(q, at + q.length)) {
        const r = document.createRange();
        r.setStart(node, at);
        r.setEnd(node, at + q.length);
        ranges.push(r);
      }
    });
    reg.set("pdf-search", new HighlightCtor(...ranges));
    return () => void reg.delete("pdf-search");
  }, [search.q, search.open, rendered]);

  const err = fileError ?? error;
  return (
    <div className="flex h-full flex-col">
      <MediaToolbar path={path} info={[doc ? `${doc.numPages} pages` : null, file ? formatBytes(file.size) : null, "PDF"].filter(Boolean).join(" · ")}>
        {doc && <PageInput current={current} total={doc.numPages} onGo={goTo} />}
        <span className="mx-1 h-4 w-px bg-border" />
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
        <IconBtn title="Fit width" active={zoom === "width"} onClick={() => setZoom("width")}>
          <MoveHorizontal size={14} strokeWidth={1.8} />
        </IconBtn>
        <IconBtn
          title="Search (Ctrl+F)"
          active={search.open}
          onClick={() => {
            setSearch((s) => ({ ...s, open: !s.open }));
            requestAnimationFrame(() => searchInput.current?.select());
          }}
        >
          <Search size={13} strokeWidth={1.8} />
        </IconBtn>
      </MediaToolbar>

      {search.open && (
        <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border px-6 py-1">
          <label htmlFor="pdf-q" className="sr-only">
            Search in document
          </label>
          <input
            id="pdf-q"
            ref={searchInput}
            autoFocus
            defaultValue={search.q}
            placeholder="Search in document"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const q = e.currentTarget.value;
                if (q === search.q && search.hits.length) jump(e.shiftKey ? -1 : 1);
                else void runSearch(q);
              }
              if (e.key === "Escape") setSearch((s) => ({ ...s, open: false }));
            }}
            className="h-7 w-64 max-w-full min-w-0 rounded-md border border-border-strong bg-elevated px-2.5 text-[13px] outline-none focus:border-accent/60"
          />
          <span className="font-mono text-[11.5px] text-muted">
            {search.q ? (search.hits.length ? `page ${search.hits[search.i]} · ${search.i + 1}/${search.hits.length}` : "no matches") : "Enter to search"}
          </span>
          <IconBtn title="Previous match (Shift+Enter)" onClick={() => jump(-1)}>
            <ChevronUp size={14} />
          </IconBtn>
          <IconBtn title="Next match (Enter)" onClick={() => jump(1)}>
            <ChevronDown size={14} />
          </IconBtn>
          <IconBtn title="Close search" onClick={() => setSearch((s) => ({ ...s, open: false }))}>
            <X size={13} />
          </IconBtn>
        </div>
      )}

      <div ref={box} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
        {err && <div className="selectable p-6 font-mono text-[12px] text-red">Cannot open PDF: {err}</div>}
        {!doc && !err && <div className="p-6 font-mono text-[12px] text-muted">Loading…</div>}
        {doc && (
          <div className="flex flex-col items-center" style={{ gap: GAP, padding: `${GAP}px 24px` }}>
            {sizes.map((s, i) => (
              <PdfPage
                key={i}
                doc={doc}
                n={i + 1}
                size={s}
                scale={scale}
                visible={visible.has(i + 1)}
                onRendered={bumpRendered}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({ doc, n, size, scale, visible, onRendered }: { doc: PDFDocumentProxy; n: number; size: Size; scale: number; visible: boolean; onRendered: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const textBox = useRef<HTMLDivElement>(null);
  const done = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || done.current === scale) return;
    let task: RenderTask | null = null;
    let text: TextLayer | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const c = canvas.current!;
      c.width = Math.floor(viewport.width * dpr);
      c.height = Math.floor(viewport.height * dpr);
      task = page.render({
        canvas: c,
        canvasContext: c.getContext("2d")!,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await task.promise;
      if (cancelled) return;
      const tb = textBox.current!;
      tb.replaceChildren();
      text = new TextLayer({ textContentSource: page.streamTextContent(), container: tb, viewport });
      await text.render();
      if (cancelled) return;
      done.current = scale;
      onRendered();
    })().catch(() => {
      // Cancelled renders reject; a later pass redraws the page.
    });
    return () => {
      cancelled = true;
      task?.cancel();
      text?.cancel();
    };
  }, [doc, n, scale, visible, onRendered]);

  const w = size.w * scale;
  const h = size.h * scale;
  return (
    <div
      data-page={n}
      aria-label={`Page ${n}`}
      className="relative shrink-0 bg-white"
      style={{ width: w, height: h, ["--scale-factor" as string]: scale, ["--total-scale-factor" as string]: scale }}
    >
      <canvas ref={canvas} className="absolute inset-0" style={{ width: w, height: h }} />
      <div ref={textBox} className="textLayer" />
    </div>
  );
}

function PageInput({ current, total, onGo }: { current: number; total: number; onGo: (n: number) => void }) {
  const [v, setV] = useState(String(current));
  useEffect(() => setV(String(current)), [current]);
  return (
    <span className="flex items-center gap-1.5 font-mono text-[12px] text-muted">
      <label htmlFor="pdf-page" className="sr-only">
        Page
      </label>
      <input
        id="pdf-page"
        value={v}
        inputMode="numeric"
        onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const n = Math.min(total, Math.max(1, Number(v) || 1));
          onGo(n);
          setV(String(n));
        }}
        className="h-7 w-11 rounded-md border border-border-strong bg-elevated text-center text-fg outline-none focus:border-accent/60"
      />
      / {total}
    </span>
  );
}
