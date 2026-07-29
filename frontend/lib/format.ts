import type { Decision, Severity } from "./types";

export function money(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return "$" + v.toFixed(2);
}

export function num(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return v.toLocaleString("en-US");
}

/** Short relative time, e.g. "9 min ago". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 0) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** IST clock time, e.g. "18:42:07". */
export function istTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
}

export function istDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function shortId(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return "—";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Green under 30, amber under 70, red at 70+. Matches the risk engine. */
export function riskColor(score: number): string {
  if (score < 30) return "var(--ok)";
  if (score < 70) return "#D97706";
  return "var(--bad)";
}

export function decisionLabel(d: Decision | string): string {
  if (d === "REQUIRE_APPROVAL") return "APPROVAL";
  return d;
}

export function decisionTagClass(d: Decision | string): string {
  if (d === "ALLOW") return "tag t-ok";
  if (d === "DENY") return "tag t-no";
  return "tag t-hold";
}

export function severityTagClass(s: Severity | string): string {
  if (s === "HIGH") return "tag t-no";
  if (s === "MEDIUM") return "tag t-hold";
  return "tag t-info";
}

/** "DAILY_BUDGET_EXCEEDED" → "Daily budget exceeded" */
export function humanizeCode(code: string): string {
  if (!code) return "";
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}
