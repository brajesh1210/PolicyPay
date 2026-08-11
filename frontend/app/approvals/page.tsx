"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  KV,
  Skeleton,
  Timeline,
  TimelineItem,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { ago, istDateTime, shortId } from "@/lib/format";
import { useMoney } from "@/lib/currency";
import type { Approval } from "@/lib/types";
import toast from "react-hot-toast";

function toneFor(s: string): "ok" | "no" | "hold" {
  if (s === "APPROVED") return "ok";
  if (s === "REJECTED") return "no";
  return "hold";
}

export default function ApprovalsPage() {
  const money = useMoney();
  const { data, loading, error, reload } = useApi<Approval[]>("/v1/approvals");
  const [busy, setBusy] = useState<string | null>(null);

  const all = Array.isArray(data) ? data : [];
  const pending = all.filter((a) => a.status === "PENDING");
  const decided = all.filter((a) => a.status !== "PENDING").slice(0, 8);

  async function act(id: string, kind: "approve" | "reject") {
    setBusy(id + kind);
    try {
      await apiSend("post", `/v1/approvals/${id}/${kind}`, {
        note: kind === "approve" ? "Approved from the dashboard" : "Rejected from the dashboard",
      });
      toast.success(kind === "approve" ? "Payment approved" : "Payment rejected");
      reload();
    } catch (e: any) {
      toast.error(e?.message || `Could not ${kind} this payment`);
    } finally {
      setBusy(null);
    }
  }

  const initials = (n?: string | null) => {
    const src = (n || "AG").trim();
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  };

  const riskTone = (n: number) =>
    n >= 70 ? "t-no" : n >= 40 ? "t-hold" : "t-ok";

  return (
    <AppShell title="Approvals" sub="Payments that need a human">
      <div className="phead">
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.6px" }}>
          Pending Approvals ({pending.length})
        </h2>
        <div className="sp" />
        <Button variant="s" icon="refresh" onClick={reload}>
          Refresh
        </Button>
      </div>

      <div className="split" style={{ gridTemplateColumns: "minmax(0,2.1fr) minmax(0,1fr)" }}>
        <div>
          {loading ? (
            <Card>
              <CardBody>
                <Skeleton lines={6} height={18} />
              </CardBody>
            </Card>
          ) : error ? (
            <Card>
              <ErrorState message={error} onRetry={reload} />
            </Card>
          ) : pending.length === 0 ? (
            <Card>
              <EmptyState
                icon="check"
                title="Nothing is waiting on you"
                desc="When a payment crosses the approval threshold, it will appear here and the agent will pause until you answer."
              />
            </Card>
          ) : (
            <div className="apg" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(370px,100%),1fr))" }}>
              {pending.map((a) => {
                const tx = a.transaction;
                const score = tx?.riskScore ?? 0;
                return (
                  <article className="apc" key={a.id}>
                    <div className="who-r">
                      <span className="av">{initials(a.agent?.name)}</span>
                      <span className="t">
                        <b>{a.agent?.name ?? "Unknown agent"}</b>
                        <span>{a.agentId ?? shortId(a.id)}</span>
                      </span>
                      <span className={`tag ${riskTone(score)}`}>
                        <Icon name="warn" style={{ width: 12, height: 12 }} />
                        Risk Score: {score}
                      </span>
                    </div>

                    <div className="mrow">
                      <span className="mi">
                        <Icon name="store" />
                      </span>
                      <span className="t">
                        <b>{tx?.merchantDomain ?? "—"}</b>
                        <span>{a.agent?.name ?? "agent"} wants to pay this merchant</span>
                      </span>
                    </div>

                    <div className="amt">
                      <b>{money(tx?.amountUsd ?? 0)}</b>
                      <span style={{ flex: 1 }} />
                      <span className="tag t-info">
                        <Icon name="coin" style={{ width: 12, height: 12 }} />
                        USDC
                      </span>
                    </div>

                    <div className="why">
                      <Icon name="info" />
                      <span>
                        <b>Reason</b>
                        <span>{a.reason}</span>
                      </span>
                    </div>

                    {(tx?.reasonCodes ?? []).length ? (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                        {(tx?.reasonCodes ?? []).map((c) => (
                          <span className="code" key={c}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="when">
                      <Icon name="clock" />
                      Requested {ago(a.createdAt)} · expires {istDateTime(a.expiresAt)} IST
                    </div>

                    <div className="acts">
                      <button
                        className="btn btn-rej"
                        disabled={!!busy}
                        onClick={() => act(a.id, "reject")}
                      >
                        {busy === a.id + "reject" ? (
                          <span className="spin" />
                        ) : (
                          <Icon name="x" />
                        )}
                        Reject
                      </button>
                      <button
                        className="btn btn-app"
                        disabled={!!busy}
                        onClick={() => act(a.id, "approve")}
                      >
                        {busy === a.id + "approve" ? (
                          <span className="spin" />
                        ) : (
                          <Icon name="check" />
                        )}
                        Approve
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <Card>
          <CardHeader title="Already decided" sub="Most recent first" />
          <CardBody>
            {loading ? (
              <Skeleton lines={5} />
            ) : decided.length === 0 ? (
              <EmptyState title="No history yet" desc="Decisions you make show up here." />
            ) : (
              <Timeline>
                {decided.map((a) => (
                  <TimelineItem
                    key={a.id}
                    tone={toneFor(a.status)}
                    title={`${a.status.charAt(0) + a.status.slice(1).toLowerCase()} · ${money(
                      a.transaction?.amountUsd ?? 0
                    )}`}
                    desc={`${a.agent?.name ?? "Agent"} → ${a.transaction?.merchantDomain ?? "—"}`}
                    time={istDateTime(a.decidedAt ?? a.createdAt) + " IST"}
                  />
                ))}
              </Timeline>
            )}

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <KV k="Pending right now">{pending.length}</KV>
              <KV k="Decided (shown)">{decided.length}</KV>
              <KV k="Auto-expiry">30 minutes</KV>
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
