"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
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

      <div className="phead">
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.6px" }}>
          Alert feed
        </h2>
        <span className="tag t-info">{alerts.length}</span>
        <div className="sp" />
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
          icon="check"
          onClick={markAll}
          loading={busy === "all"}
          disabled={unread.length === 0}
        >
          Mark all as read
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardBody>
            <Skeleton lines={7} height={18} />
          </CardBody>
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="bell"
            title="Nothing to report"
            desc="When an agent is blocked, held, or nears its budget, you will see it here."
          />
        </Card>
      ) : (
        <div>
          {shown.map((a) => {
            const tone =
              a.severity === "HIGH"
                ? { bg: "var(--bad-bg)", fg: "var(--bad)", icon: "warn" }
                : a.severity === "MEDIUM"
                ? { bg: "var(--warn-bg)", fg: "var(--warn)", icon: "shield" }
                : { bg: "var(--b-100)", fg: "var(--b-600)", icon: "bell" };
            return (
              <article className={`arow${a.isRead ? " read" : ""}`} key={a.id}>
                <span className="ai" style={{ background: tone.bg }}>
                  <Icon name={tone.icon} style={{ stroke: tone.fg }} />
                </span>

                <div className="tx">
                  <b>{a.title}</b>
                  <p>{a.description}</p>
                  <div className="mt-r">
                    <span>{ago(a.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="code">{humanizeCode(a.type)}</span>
                  </div>
                </div>

                <div className="rt">
                  <span className={severityTagClass(a.severity)}>{a.severity}</span>
                  {!a.isRead ? (
                    <Button
                      variant="s"
                      sm
                      loading={busy === a.id}
                      onClick={() => markRead(a)}
                    >
                      Mark read
                    </Button>
                  ) : (
                    <span className="fs-meta">read</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

    </AppShell>
  );
}
