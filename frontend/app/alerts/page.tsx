"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chips,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { ago, humanizeCode, severityTagClass } from "@/lib/format";
import type { Alert, Severity } from "@/lib/types";
import toast from "react-hot-toast";

type Filter = "all" | "HIGH" | "MEDIUM" | "LOW";

export default function AlertsPage() {
  const { data, loading, error, reload } = useApi<Alert[]>("/v1/alerts");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const alerts = useMemo(
    () => (Array.isArray(data) ? data.filter((a) => !a.isDismissed) : []),
    [data]
  );

  const bySev = (s: Severity) => alerts.filter((a) => a.severity === s);
  const unread = alerts.filter((a) => !a.isRead);
  const shown = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
  const oldestUnread = unread.length > 0 ? unread[unread.length - 1] : null;

  async function markRead(a: Alert) {
    setBusy(a.id);
    try {
      await apiSend("patch", `/v1/alerts/${a.id}/read`, {});
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not update the alert");
    } finally {
      setBusy(null);
    }
  }

  async function markAll() {
    setBusy("all");
    try {
      await Promise.all(
        unread.map((a) => apiSend("patch", `/v1/alerts/${a.id}/read`, {}).catch(() => null))
      );
      toast.success("All alerts marked read");
      reload();
    } catch {
      toast.error("Some alerts could not be updated");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Alerts" sub="What PolicyPay wants you to know">
      <div className="stats" style={{ marginBottom: 20 }}>
        <StatCard
          icon="warn"
          iconBg="var(--bad-bg)"
          label="High"
          value={bySev("HIGH").length}
          loading={loading}
          foot={`${bySev("HIGH").filter((a) => !a.isRead).length} unread`}
        />
        <StatCard
          icon="bell"
          iconBg="var(--warn-bg)"
          label="Medium"
          value={bySev("MEDIUM").length}
          loading={loading}
          foot={`${bySev("MEDIUM").filter((a) => !a.isRead).length} unread`}
        />
        <StatCard
          icon="file"
          label="Low"
          value={bySev("LOW").length}
          loading={loading}
          foot={`${bySev("LOW").filter((a) => !a.isRead).length} unread`}
        />
        <StatCard
          icon="clock"
          iconBg="var(--ok-bg)"
          label="Oldest unread"
          value={oldestUnread ? ago(oldestUnread.createdAt).replace(" ago", "") : "—"}
          loading={loading}
          foot={oldestUnread ? oldestUnread.title : "nothing unread"}
        />
      </div>

      <Card>
        <CardHeader
          title="Alert feed"
          sub={`${alerts.length} alerts · ${unread.length} unread`}
          right={
            <>
              <Chips<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "HIGH", label: "High" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "LOW", label: "Low" },
                ]}
              />
              <Button
                variant="s"
                sm
                icon="check"
                onClick={markAll}
                loading={busy === "all"}
                disabled={unread.length === 0}
              >
                Mark all read
              </Button>
            </>
          }
        />

        {loading ? (
          <CardBody>
            <Skeleton lines={7} height={18} />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nothing to report"
            desc="When an agent is blocked, held, or nears its budget, you will see it here."
          />
        ) : (
          <div>
            {shown.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "17px 20px",
                  borderBottom: "1px solid var(--line)",
                  opacity: a.isRead ? 0.62 : 1,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: a.isRead ? "transparent" : "var(--b-500)",
                    flex: "none",
                    marginTop: 6,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span className={severityTagClass(a.severity)}>{a.severity}</span>
                    <b className="fs-base fw-black">{a.title}</b>
                    <span
                      className="fs-mono-xs"
                      style={{
                        marginLeft: "auto",
                        color: "var(--ink-3)",
                      }}
                    >
                      {ago(a.createdAt)}
                    </span>
                  </div>
                  <p className="fs-body-sm" style={{ color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 }}>
                    {a.description}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                    <span className="code">{humanizeCode(a.type)}</span>
                    {!a.isRead ? (
                      <Button variant="s" sm loading={busy === a.id} onClick={() => markRead(a)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
