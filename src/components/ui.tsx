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
      className="fixed z-50 min-w-48 rounded-lg border border-border-strong bg-elevated p-1"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => {
            onClose();
            it.run();
          }}
          className={`flex h-8 w-full items-center justify-between gap-6 rounded-md px-2.5 text-left text-[13px] hover:bg-hover ${
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
        className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-border-strong bg-panel"
        style={{ width: `min(${width}px, 94vw)` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-[15px] font-semibold">{title}</span>
          <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg">
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
    default: "border border-border-strong text-fg hover:bg-hover",
    primary: "bg-accent font-semibold text-accent-fg hover:opacity-90",
    ghost: "text-fg-soft hover:bg-hover hover:text-fg",
    danger: "border border-red/45 text-red hover:bg-red-soft",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  "h-9 w-full rounded-lg border border-border-strong bg-elevated px-3 text-[13px] outline-none placeholder:text-dim focus:border-accent/60";

export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <kbd key={k} className="rounded border border-border-strong px-1.5 py-px font-mono text-[11px] text-muted">
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** The T-rax mark: a dino head with a terminal prompt on its cheek. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg role="img" aria-label="T-rax" width={size} height={size} viewBox="0 0 1024 1024" className={className}>
      <path
        fill="var(--c-accent)"
        d="M196 610C186 470 250 330 390 268C500 220 650 224 760 262C836 288 872 330 872 386L872 452C872 478 852 494 826 494L560 494L548 524L800 552C834 556 850 576 846 604L842 640C838 674 812 690 778 690L520 690C470 690 446 716 440 760L432 820L250 820C214 760 198 690 196 610Z"
      />
      <circle cx="610" cy="352" r="40" fill="var(--c-bg)" />
      <path d="M286 560L346 610L286 660" fill="none" stroke="var(--c-bg)" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
