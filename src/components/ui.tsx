import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem = { label: string; hint?: string; danger?: boolean; run: () => void };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);
  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-44 rounded-md border border-border bg-elevated p-1 shadow-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => {
            onClose();
            it.run();
          }}
          className={`flex w-full items-center justify-between gap-6 rounded px-2 py-1 text-left text-[12.5px] hover:bg-hover ${
            it.danger ? "text-red" : ""
          }`}
        >
          {it.label}
          {it.hint && <span className="text-[11px] text-muted">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 640 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
        style={{ width: `min(${width}px, 94vw)` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="font-medium">{title}</span>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-hover hover:text-fg">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    default: "border border-border bg-elevated hover:bg-hover",
    primary: "bg-accent text-accent-fg hover:opacity-90",
    ghost: "text-muted hover:bg-hover hover:text-fg",
    danger: "border border-red/40 text-red hover:bg-red/10",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  "h-8 w-full rounded-md border border-border bg-elevated px-2.5 text-[12.5px] outline-none placeholder:text-muted focus:border-accent/60";
