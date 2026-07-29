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
  RiskGauge,
  Skeleton,
  Timeline,
  TimelineItem,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { ago, istDateTime, money, shortId } from "@/lib/format";
import type { Approval } from "@/lib/types";
import toast from "react-hot-toast";

function toneFor(s: string): "ok" | "no" | "hold" {
  if (s === "APPROVED") return "ok";
  if (s === "REJECTED") return "no";
  return "hold";
}

export default function ApprovalsPage() {
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

  return (
    <AppShell title="Approvals" sub="Payments that need a human">
      {pending.length > 0 ? (
        <div className="banner crit">
          <Icon name="warn" />
          <div className="tx">
            <b>
              {pending.length} request{pending.length > 1 ? "s are" : " is"} holding an
              agent still
            </b>
            <span>Each one waits until you decide. Nothing is signed in the meantime.</span>
          </div>
        </div>
      ) : null}

      <div className="split">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            pending.map((a) => {
              const tx = a.transaction;
              const score = tx?.riskScore ?? 0;
              return (
                <Card key={a.id}>
                  <CardHeader
                    title={`${money(tx?.amountUsd ?? 0)} to ${tx?.merchantDomain ?? "—"}`}
                    sub={`${a.agent?.name ?? "Unknown agent"} · ${ago(a.createdAt)}`}
                    right={<span className="tag t-hold">AWAITING YOU</span>}
                  />
                  <CardBody>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                      <RiskGauge score={score} size={126} label="risk" />
                      <div style={{ flex: 1, minWidth: 230 }}>
                        <KV k="Reason">{a.reason}</KV>
                        <KV k="Reason codes">
                          {(tx?.reasonCodes ?? []).map((c) => (
                            <span key={c} style={{ display: "block" }}>
                              {c}
                            </span>
                          ))}
                        </KV>
                        {tx?.purpose ? <KV k="Purpose">{tx.purpose}</KV> : null}
                        <KV k="Expires">{istDateTime(a.expiresAt)} IST</KV>
                        <KV k="Approval ID">
                          <span className="mono" style={{ fontSize: 12 }}>
                            {a.id}
                          </span>
                        </KV>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                      <Button
                        variant="ok"
                        icon="check"
                        loading={busy === a.id + "approve"}
                        disabled={!!busy}
                        onClick={() => act(a.id, "approve")}
                      >
                        Approve payment
                      </Button>
                      <Button
                        variant="d"
                        icon="x"
                        loading={busy === a.id + "reject"}
                        disabled={!!busy}
                        onClick={() => act(a.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })
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
