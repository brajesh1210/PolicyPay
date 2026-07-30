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
  KV,
  Pagination,
  RiskBar,
  Skeleton,
  Timeline,
  TimelineItem,
} from "@/components/ui";
import { useApi, useApiList } from "@/lib/hooks";
import { ago, decisionLabel, decisionTagClass, humanizeCode, istTime, shortId } from "@/lib/format";
import { useMoney } from "@/lib/currency";
import type { Agent, Transaction } from "@/lib/types";

const LIMIT = 10;
type StatusFilter = "" | "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export default function TransactionsPage() {
  const money = useMoney();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("");
  const [agentId, setAgentId] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: LIMIT };
    if (status) p.decision = status;
    if (agentId) p.agentId = agentId;
    return p;
  }, [page, status, agentId]);

  const { data, meta, loading, error, reload } = useApiList<Transaction[]>(
    "/v1/transactions",
    params
  );
  const agents = useApi<Agent[]>("/v1/agents");

  const rows = Array.isArray(data) ? data : [];
  const total = meta?.total ?? rows.length;
  const detail = selected ?? rows[0] ?? null;

  function changeFilter(fn: () => void) {
    fn();
    setPage(1);
    setSelected(null);
  }

  return (
    <AppShell title="Transactions" sub="Every payment your agents asked for">
      <Card>
        <CardHeader
          title="All transactions"
          sub={
            loading
              ? "Loading…"
              : `Showing ${rows.length === 0 ? 0 : (page - 1) * LIMIT + 1}–${
                  (page - 1) * LIMIT + rows.length
                } of ${total}`
          }
          right={
            <Button variant="s" sm icon="refresh" onClick={reload}>
              Refresh
            </Button>
          }
        />

        <div
          className="card-b"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--tint)",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Chips<StatusFilter>
              value={status}
              onChange={(v) => changeFilter(() => setStatus(v))}
              options={[
                { value: "", label: "All" },
                { value: "ALLOW", label: "Allowed" },
                { value: "DENY", label: "Denied" },
                { value: "REQUIRE_APPROVAL", label: "Approval" },
              ]}
            />
            <select
              className="in"
              style={{ width: "auto", height: 34, fontSize: 12.5, padding: "0 34px 0 12px" }}
              aria-label="Filter by agent"
              value={agentId}
              onChange={(e) => changeFilter(() => setAgentId(e.target.value))}
            >
              <option value="">Every agent</option>
              {(agents.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <CardBody>
            <Skeleton lines={8} height={18} />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing matches that filter"
            desc="Try a different verdict or agent."
          />
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Agent</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Risk</th>
                    <th>Verdict</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {shortId(t.id)}
                      </td>
                      <td>
                        <b>{t.agent?.name ?? shortId(t.agentId, 6, 3)}</b>
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {t.merchantDomain}
                        {t.purpose ? (
                          <div
                            className="sub"
                            style={{
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.purpose}
                          </div>
                        ) : null}
                      </td>
                      <td className="num">
                        <b>{money(t.amountUsd)}</b>
                      </td>
                      <td>
                        <RiskBar score={t.riskScore} />
                      </td>
                      <td>
                        <span className={decisionTagClass(t.decision)}>
                          {decisionLabel(t.decision)}
                        </span>
                      </td>
                      <td style={{ color: "var(--ink-3)", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {ago(t.createdAt)}
                      </td>
                      <td>
                        <div className="act">
                          <Button variant="s" sm icon="eye" onClick={() => setSelected(t)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>

      {detail ? (
        <div className="split mt">
          <Card>
            <CardHeader
              title="Decision detail"
              sub={`${shortId(detail.id)} · ${
                detail.purpose ? detail.purpose.slice(0, 46) : "no purpose given"
              }`}
              right={
                <span className={decisionTagClass(detail.decision)}>
                  {decisionLabel(detail.decision)}
                </span>
              }
            />
            <CardBody>
              <KV k="Agent">{detail.agent?.name ?? shortId(detail.agentId)}</KV>
              <KV k="Merchant">
                <span className="mono">{detail.merchantDomain}</span>
              </KV>
              <KV k="Amount">
                <span className="num">
                  {money(detail.amountUsd)} {detail.currency}
                </span>
              </KV>
              {detail.purpose ? (
                <KV k="Purpose">
                  <span
                    style={{
                      color: detail.decision === "DENY" ? "var(--bad)" : undefined,
                    }}
                  >
                    {detail.purpose}
                  </span>
                </KV>
              ) : null}
              <KV k="Risk score">
                <span
                  style={{
                    color:
                      detail.riskScore >= 70
                        ? "var(--bad)"
                        : detail.riskScore >= 30
                        ? "#D97706"
                        : "var(--ok)",
                  }}
                >
                  {detail.riskScore} / 100
                </span>
              </KV>
              <KV k="Reason codes">
                {(detail.reasonCodes ?? []).map((c) => (
                  <span key={c} style={{ display: "block" }}>
                    {c}
                  </span>
                ))}
              </KV>
              {detail.idempotencyKey ? (
                <KV k="Idempotency key">
                  <span className="mono" style={{ fontSize: 12 }}>
                    {shortId(detail.idempotencyKey, 14, 6)}
                  </span>
                </KV>
              ) : null}
              <KV k="Recorded">{istTime(detail.createdAt)} IST</KV>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Checks that ran"
              sub={`${(detail.policyChecks ?? []).length} checks, in order`}
            />
            <CardBody>
              {(detail.policyChecks ?? []).length === 0 ? (
                <EmptyState title="No check trace stored" desc="This record predates check logging." />
              ) : (
                <Timeline>
                  {(detail.policyChecks ?? []).map((c, i) => (
                    <TimelineItem
                      key={`${c.check}-${i}`}
                      tone={c.passed ? "ok" : "no"}
                      title={humanizeCode(c.check)}
                      desc={c.detail}
                    />
                  ))}
                  <TimelineItem
                    tone={
                      detail.decision === "ALLOW"
                        ? "ok"
                        : detail.decision === "DENY"
                        ? "no"
                        : "hold"
                    }
                    title="Verdict"
                    desc={`Risk ${detail.riskScore} → ${decisionLabel(detail.decision)}`}
                    time={istTime(detail.createdAt)}
                  />
                </Timeline>
              )}

              {(detail.riskFactors ?? []).length > 0 ? (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  {(detail.riskFactors ?? []).map((f, i) => (
                    <KV key={i} k={f.factor}>
                      <span style={{ color: "var(--bad)" }}>+{f.points}</span>
                    </KV>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
