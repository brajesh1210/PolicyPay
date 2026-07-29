"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  RiskBar,
  Skeleton,
  StatCard,
  Switch,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import {
  ago,
  decisionLabel,
  decisionTagClass,
  money,
  num,
  pct,
  shortId,
} from "@/lib/format";
import type {
  Agent,
  Approval,
  Overview,
  Policy,
  RecentTransactions,
  SpendingTrends,
  StatusDistribution,
} from "@/lib/types";
import { useState } from "react";
import toast from "react-hot-toast";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const ov = useApi<Overview>("/v1/analytics/overview");
  const tr = useApi<SpendingTrends>("/v1/analytics/spending-trends", { days: 7 });
  const sd = useApi<StatusDistribution>("/v1/analytics/status-distribution");
  const rt = useApi<RecentTransactions>("/v1/analytics/recent-transactions", { limit: 6 });
  const ag = useApi<Agent[]>("/v1/agents");
  const po = useApi<Policy[]>("/v1/policies");
  const ap = useApi<Approval[]>("/v1/approvals");
  const ks = useApi<{ active: boolean }>("/v1/kill-switch");

  const [killBusy, setKillBusy] = useState(false);
  const [killLocal, setKillLocal] = useState<boolean | null>(null);
  const killOn = killLocal ?? ks.data?.active ?? false;

  async function toggleKill(next: boolean) {
    setKillBusy(true);
    const prev = killOn;
    setKillLocal(next);
    try {
      await apiSend("patch", "/v1/kill-switch", { active: next });
      toast.success(next ? "Kill switch is ON — every payment is denied" : "Kill switch is off");
      ks.reload();
    } catch (e: any) {
      setKillLocal(prev);
      toast.error(e?.message || "Could not change the kill switch");
    } finally {
      setKillBusy(false);
    }
  }

  const pending = (ap.data ?? []).filter((a) => a.status === "PENDING");
  const trends = tr.data?.trends ?? [];
  const maxAmt = Math.max(1, ...trends.map((t) => t.amount));

  const dist = sd.data;
  const total = dist?.total ?? 0;
  const circ = 2 * Math.PI * 50;
  const seg = (n: number) => (total > 0 ? (n / total) * circ : 0);

  const agents = ag.data ?? [];
  const policies = po.data ?? [];
  const policyOf = (a: Agent) =>
    policies.find((p) => p.id === a.policyId) ?? null;

  return (
    <AppShell title="Dashboard" sub="Everything your agents did today">
      {pending.length > 0 ? (
        <div className="banner">
          <Icon name="warn" />
          <div className="tx">
            <b>
              {pending.length} payment{pending.length > 1 ? "s are" : " is"} waiting for
              your decision
            </b>
            <span>
              {pending[0].agent?.name ?? "An agent"} asked for{" "}
              {money(pending[0].transaction?.amountUsd ?? 0)} · risk{" "}
              {pending[0].transaction?.riskScore ?? 0}/100 · {ago(pending[0].createdAt)}
            </span>
          </div>
          <Link className="btn btn-p btn-sm" href="/approvals">
            Review now <Icon name="chev" />
          </Link>
        </div>
      ) : null}

      {killOn ? (
        <div className="banner crit">
          <Icon name="power" />
          <div className="tx">
            <b>The global kill switch is ON</b>
            <span>Every payment from every agent is being denied right now.</span>
          </div>
          <Button variant="d" sm onClick={() => toggleKill(false)} loading={killBusy}>
            Turn it off
          </Button>
        </div>
      ) : null}

      {/* ── stat cards ── */}
      <div className="stats">
        <StatCard
          accent
          icon="coin"
          label="Spent today"
          value={money(ov.data?.total_spend_today ?? 0)}
          loading={ov.loading}
          foot={
            <>
              <b>
                {(ov.data?.total_spend_today_change_pct ?? 0) >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(ov.data?.total_spend_today_change_pct ?? 0)}%
              </b>{" "}
              vs yesterday
            </>
          }
        />
        <StatCard
          icon="swap"
          label="Decisions"
          value={num(dist?.total ?? 0)}
          loading={sd.loading}
          foot={
            <>
              <b>{num(dist?.allow ?? 0)}</b> allowed all-time
            </>
          }
        />
        <StatCard
          icon="shield"
          iconBg="var(--bad-bg)"
          label="Blocked today"
          value={num(ov.data?.blocked_today ?? 0)}
          loading={ov.loading}
          foot={
            <>
              <b>{num(dist?.deny ?? 0)}</b> denied all-time
            </>
          }
        />
        <StatCard
          icon="bot"
          iconBg="var(--ok-bg)"
          label="Active agents"
          value={num(ov.data?.active_agents ?? 0)}
          loading={ov.loading}
          foot={
            <>
              <b>{num(ov.data?.pending_approvals ?? 0)}</b> awaiting approval
            </>
          }
        />
      </div>

      {/* ── charts ── */}
      <div className="split mt">
        <Card>
          <CardHeader title="Spending trends" sub="Last 7 days" />
          <CardBody>
            {tr.loading ? (
              <div className="sk" style={{ height: 190 }} />
            ) : tr.error ? (
              <ErrorState message={tr.error} onRetry={tr.reload} />
            ) : trends.length === 0 ? (
              <EmptyState title="No spending yet" desc="Run the demo agent to see data here." />
            ) : (
              <>
                <div className="bars">
                  {trends.map((t) => {
                    const h = Math.max(3, (t.amount / maxAmt) * 150);
                    const d = new Date(t.date + "T00:00:00Z");
                    return (
                      <div className="c" key={t.date}>
                        <div className="st">
                          <i
                            style={{
                              height: h,
                              background: "linear-gradient(180deg,#3787F6,#1459D0)",
                            }}
                            title={`${money(t.amount)} · ${t.count} tx`}
                          />
                        </div>
                        <small>{DAY[d.getUTCDay()]}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="leg">
                  <span>
                    <i style={{ background: "linear-gradient(180deg,#3787F6,#1459D0)" }} />
                    Amount spent per day
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
                    Peak {money(maxAmt)}
                  </span>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status split" sub="All decisions on record" />
          <CardBody>
            {sd.loading ? (
              <div className="sk" style={{ height: 190 }} />
            ) : sd.error ? (
              <ErrorState message={sd.error} onRetry={sd.reload} />
            ) : (
              <div className="donut">
                <div className="gauge">
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#EFF1F7" strokeWidth="15" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="url(#gd)"
                      strokeWidth="15"
                      strokeLinecap="round"
                      strokeDasharray={`${seg(dist?.allow ?? 0)} ${circ}`}
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#EF6B6B"
                      strokeWidth="15"
                      strokeLinecap="round"
                      strokeDasharray={`${seg(dist?.deny ?? 0)} ${circ}`}
                      strokeDashoffset={-seg(dist?.allow ?? 0)}
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#F0A93B"
                      strokeWidth="15"
                      strokeLinecap="round"
                      strokeDasharray={`${seg(dist?.require_approval ?? 0)} ${circ}`}
                      strokeDashoffset={-(seg(dist?.allow ?? 0) + seg(dist?.deny ?? 0))}
                    />
                    <defs>
                      <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#3787F6" />
                        <stop offset="1" stopColor="#1459D0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="mid">
                    <div>
                      <b>{num(total)}</b>
                      <span>decisions</span>
                    </div>
                  </div>
                </div>
                <div className="dlist">
                  <div className="dl-row">
                    <i style={{ background: "#236CDF" }} />
                    Allowed<b>{num(dist?.allow ?? 0)}</b>
                  </div>
                  <div className="dl-row">
                    <i style={{ background: "#EF6B6B" }} />
                    Denied<b>{num(dist?.deny ?? 0)}</b>
                  </div>
                  <div className="dl-row">
                    <i style={{ background: "#F0A93B" }} />
                    Approval<b>{num(dist?.require_approval ?? 0)}</b>
                  </div>
                  <div
                    className="dl-row"
                    style={{
                      borderTop: "1px solid var(--line)",
                      marginTop: 6,
                      paddingTop: 12,
                    }}
                  >
                    <i style={{ background: "var(--ok)" }} />
                    Block rate
                    <b>{total ? (((dist?.deny ?? 0) / total) * 100).toFixed(1) : "0.0"}%</b>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── recent decisions ── */}
      <Card className="mt">
        <CardHeader
          title="Recent decisions"
          sub="Live from the production API"
          right={
            <>
              <span className="eyebrow">
                <i className="live" />
                Live
              </span>
              <Link className="btn btn-s btn-sm" href="/transactions">
                View all <Icon name="chev" />
              </Link>
            </>
          }
        />
        {rt.loading ? (
          <CardBody>
            <Skeleton lines={6} height={18} />
          </CardBody>
        ) : rt.error ? (
          <ErrorState message={rt.error} onRetry={rt.reload} />
        ) : (rt.data?.transactions ?? []).length === 0 ? (
          <EmptyState
            title="No decisions yet"
            desc="Once an agent asks to pay, it shows up here instantly."
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Verdict</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(rt.data?.transactions ?? []).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.agentName}</b>
                      <div className="sub mono">{shortId(t.id)}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {t.merchantDomain}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── agent budgets + kill switch ── */}
      <div className="split3 mt">
        {ag.loading ? (
          <Card>
            <CardBody>
              <Skeleton lines={4} />
            </CardBody>
          </Card>
        ) : (
          agents.slice(0, 2).map((a) => {
            const p = policyOf(a);
            const cap = p?.dailyBudgetUsd ?? 0;
            const used = a.totalSpent ?? 0;
            const p100 = pct(used, cap);
            const cls = p100 > 85 ? "bad" : p100 > 60 ? "warn" : "";
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="card-h" style={{ padding: "0 0 14px 0" }}>
                    <div>
                      <h3>{a.name}</h3>
                      <p>{p?.name ?? "No policy"} policy</p>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}
                  >
                    <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                      Total spent
                    </span>
                    <b className="num">
                      {money(used)} / {money(cap)} daily
                    </b>
                  </div>
                  <div className={`prog ${cls}`}>
                    <i style={{ width: `${p100}%` }} />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 9 }}>
                    {a.totalTx} decisions · resets 00:00 UTC (5:30 AM IST)
                  </p>
                </CardBody>
              </Card>
            );
          })
        )}

        <Card>
          <CardBody>
            <div className="card-h" style={{ padding: "0 0 14px 0" }}>
              <div>
                <h3>Kill switch</h3>
                <p>Freeze everything at once</p>
              </div>
            </div>
            <div className="swrow" style={{ border: "none", padding: "6px 0 0" }}>
              <div className="tx">
                <b>Global freeze</b>
                <span>Denies every payment, every agent</span>
              </div>
              <Switch
                checked={killOn}
                onChange={toggleKill}
                danger
                disabled={killBusy || ks.loading}
                label="Global kill switch"
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
              Currently{" "}
              <b style={{ color: killOn ? "var(--bad)" : "var(--ok)" }}>
                {killOn ? "active" : "inactive"}
              </b>
              {killOn ? " — nothing can transact." : " — agents can transact."}
            </p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
