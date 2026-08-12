"use client";

import React from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { riskColor } from "@/lib/format";

/* ── Button ───────────────────────────────── */
type BtnVariant = "p" | "s" | "d" | "ok";
export function Button({
  variant = "s",
  sm,
  icon,
  loading,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  sm?: boolean;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <button
      className={`btn btn-${variant}${sm ? " btn-sm" : ""} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="spin" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/* ── Card ─────────────────────────────────── */
export function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  right,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="card-h">
      <div>
        <h3>{title}</h3>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? <div className="r">{right}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card-b ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ── Tag ──────────────────────────────────── */
export function Tag({
  cls,
  children,
}: {
  cls: string;
  children: React.ReactNode;
}) {
  return <span className={cls}>{children}</span>;
}

/* ── Switch ───────────────────────────────── */
export function Switch({
  checked,
  onChange,
  danger,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <span
      className={`sw${danger ? " danger" : ""}${checked ? " on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    />
  );
}

export function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  danger,
  disabled,
  right,
}: {
  title: string;
  desc: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="swrow">
      <div className="tx">
        <b>{title}</b>
        <span>{desc}</span>
      </div>
      {right ??
        (onChange ? (
          <Switch
            checked={!!checked}
            onChange={onChange}
            danger={danger}
            label={title}
            disabled={disabled}
          />
        ) : null)}
    </div>
  );
}

/* ── Field ────────────────────────────────── */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fld">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/* ── Chips ────────────────────────────────── */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip${o.value === value ? " on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── KV row ───────────────────────────────── */
export function KV({
  k,
  children,
  style,
}: {
  k: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="kv" style={style}>
      <span>{k}</span>
      <b>{children}</b>
    </div>
  );
}

/* ── Risk bar + gauge ─────────────────────── */
export function RiskBar({ score }: { score: number }) {
  const c = riskColor(score);
  return (
    <div className="risk">
      <div className="bar">
        <i style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: c }} />
      </div>
      <b style={{ color: c }}>{score}</b>
    </div>
  );
}

export function RiskGauge({
  score,
  size = 180,
  label = "of 100",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const c = riskColor(score);
  const circ = 2 * Math.PI * 50;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#EFF1F7" strokeWidth="14" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={c}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="mid">
        <div>
          <b className={size < 150 ? "fs-xl" : ""} style={{ color: c }}>{score}</b>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Banner ───────────────────────────────── */
export function Banner({
  crit,
  icon = "warn",
  title,
  desc,
  right,
}: {
  crit?: boolean;
  icon?: string;
  title: string;
  desc: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={`banner${crit ? " crit" : ""}`}>
      <Icon name={icon} />
      <div className="tx">
        <b>{title}</b>
        <span>{desc}</span>
      </div>
      {right}
    </div>
  );
}

/* ── Empty / error / loading ──────────────── */
export function EmptyState({
  icon = "inbox",
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ic">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {desc ? <p>{desc}</p> : null}
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="warn"
      title="Could not load this"
      desc={message}
      action={
        onRetry ? (
          <Button variant="s" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function Skeleton({
  lines = 3,
  height = 12,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="sk sk-line"
          style={{ height, width: i === 0 ? "100%" : i === lines - 1 ? "40%" : "85%" }}
        />
      ))}
    </div>
  );
}

/* ── Timeline ─────────────────────────────── */
export function Timeline({ children }: { children: React.ReactNode }) {
  return <div className="timeline">{children}</div>;
}

export function TimelineItem({
  tone,
  title,
  desc,
  time,
}: {
  tone?: "ok" | "no" | "hold";
  title: string;
  desc?: string;
  time?: string;
}) {
  return (
    <div className={`tl${tone ? " " + tone : ""}`}>
      <h4>{title}</h4>
      {desc ? <p>{desc}</p> : null}
      {time ? <time>{time}</time> : null}
    </div>
  );
}

/* ── Pagination ───────────────────────────── */
export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const list: (number | "…")[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) list.push(i);
  } else {
    list.push(1);
    if (page > 3) list.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++)
      list.push(i);
    if (page < pages - 2) list.push("…");
    list.push(pages);
  }

  return (
    <div className="pag">
      <span>
        Rows {from}–{to} of <b style={{ color: "var(--ink)" }}>{total}</b>
      </span>
      <div className="r">
        <button
          className="pg"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        {list.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="pg" style={{ border: "none", cursor: "default" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              className={`pg${p === page ? " on" : ""}`}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          className="pg"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/* ── Terminal ─────────────────────────────── */
export function Terminal({
  title,
  children,
  height = 290,
  flush,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
  flush?: boolean;
}) {
  return (
    <div
      className="term"
      style={
        flush
          ? { borderRadius: "0 0 var(--r-lg) var(--r-lg)", border: "none" }
          : undefined
      }
    >
      <div className="term-b">
        <i style={{ background: "#FF5F57" }} />
        <i style={{ background: "#FEBC2E" }} />
        <i style={{ background: "#28C840" }} />
        <span>{title}</span>
      </div>
      <div className="term-t" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────── */
export function StatCard({
  icon,
  iconBg,
  label,
  value,
  unit,
  foot,
  accent,
  loading,
}: {
  icon: string;
  iconBg?: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  foot?: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`stat${accent ? " accent" : ""}`}>
      <div className="ic" style={iconBg && !accent ? { background: iconBg } : undefined}>
        <Icon name={icon} />
      </div>
      <div className="lb">{label}</div>
      {loading ? (
        <div className="sk" style={{ height: 30, width: "62%", marginTop: 7 }} />
      ) : (
        <div className="vl">
          {value}
          {unit ? (
            <span className="fs-md" style={{ letterSpacing: 0 }}> {unit}</span>
          ) : null}
        </div>
      )}
      {foot ? <div className="dl">{foot}</div> : null}
    </div>
  );
}

/* ── Sheet ────────────────────────────────────
   A glass panel that rises over the page when a row's View button is
   pressed. Desktop: centred, side by side. Mobile: full width, stacked
   and scrollable. Escape closes it, and so does the backdrop.
   ─────────────────────────────────────────── */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [shown, setShown] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // the sheet renders into <body> so no ancestor can trap it
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    // one frame later so the transition actually runs
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`sheet-wrap${shown ? " in" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`sheet${wide ? " wide" : ""}`}>
        <div className="sheet-h">
          <div className="t">
            <b>{title}</b>
            {sub ? <span>{sub}</span> : null}
          </div>
          <button className="sheet-x" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-b">{children}</div>
      </div>
    </div>,
    document.body
  );
}
