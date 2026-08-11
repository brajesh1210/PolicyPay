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
import { ago, decisionLabel, decisionTagClass, num, pct, shortId } from "@/lib/format";
import { useMoney } from "@/lib/currency";
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

/* ── the spending line, drawn as one smooth path ───────────── */
function SpendLine({
  trends,
  max,
  money,
}: {
  trends: { date: string; amount: number; count: number }[];
  max: number;
  money: (n: number) => string;
}) {
  // the svg stretches to the card width, so all geometry is in a
  // fixed 0..100 x 0..100 box and the axis labels live in real HTML
  const W = 100;
  const H = 100;
  const padT = 6;
  const padB = 6;
  const iw = W;
  const ih = H - padT - padB;
  const padL = 0;

  // round the top of the axis up to something friendly
  const nice = (n: number) => {
    if (n <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(n)));
    return Math.ceil(n / mag) * mag;
  };
  const top = nice(max);

  const pts = trends.map((t, i) => {
    const x = trends.length === 1 ? iw / 2 : (i / (trends.length - 1)) * iw;
    const y = padT + ih - (t.amount / top) * ih;
    return { x, y, t };
  });

  // catmull-rom → cubic bézier, so the curve stays inside the data
  let d = "";
  pts.forEach((p, i) => {
    if (i === 0) {
      d += `M${p.x} ${p.y}`;
      return;
    }
    const p0 = pts[i - 2] ?? pts[i - 1];
    const p1 = pts[i - 1];
    const p2 = p;
    const p3 = pts[i + 1] ?? p;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  });

  const area = pts.length
    ? `${d} L${pts[pts.length - 1].x} ${padT + ih} L${pts[0].x} ${padT + ih} Z`
    : "";

  const rows = [0, 0.25, 0.5, 0.75, 1];

  return (
    <>
      <div className="lchart">
        <div className="lchart-y">
          {rows.map((r) => (
            <span key={r} style={{ top: `${((padT + ih - r * ih) / H) * 100}%` }}>
              {money(top * r).replace(/\.00$/, "")}
            </span>
          ))}
        </div>
        <div className="lchart-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--b-400)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--b-400)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {rows.map((r) => {
            const y = padT + ih - r * ih;
            return <line className="gl" key={r} x1={0} y1={y} x2={W} y2={y} />;
          })}

          {area ? <path d={area} fill="url(#spendFill)" /> : null}
          {d ? <path className="ln" d={d} vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {pts.map((p) => (
            <i
              className="lchart-dot"
              key={p.t.date}
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
              title={`${money(p.t.amount)} · ${p.t.count} tx`}
            />
          ))}
        </div>
      </div>
      <div className="lchart-x">
        {pts.map((p) => (
          <span key={p.t.date} style={{ left: `${(p.x / W) * 100}%` }}>
            {DAY[new Date(p.t.date + "T00:00:00Z").getUTCDay()]}
          </span>
        ))}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const money = useMoney();
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
                <SpendLine trends={trends} max={maxAmt} money={money} />
                <div className="leg">
                  <span>
                    <i style={{ background: "var(--b-500)" }} />
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
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#E7ECF5" strokeWidth="15" />
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
                      stroke="#F0787C"
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
                      stroke="#F7C065"
                      strokeWidth="15"
                      strokeLinecap="round"
                      strokeDasharray={`${seg(dist?.require_approval ?? 0)} ${circ}`}
                      strokeDashoffset={-(seg(dist?.allow ?? 0) + seg(dist?.deny ?? 0))}
                    />
                    <defs>
                      <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#3DD68C" />
                        <stop offset="1" stopColor="#12A150" />
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
                    <i style={{ background: "#12A150" }} />
                    Allowed<b>{num(dist?.allow ?? 0)}</b>
                  </div>
                  <div className="dl-row">
                    <i style={{ background: "#F0787C" }} />
                    Denied<b>{num(dist?.deny ?? 0)}</b>
                  </div>
                  <div className="dl-row">
                    <i style={{ background: "#F7C065" }} />
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
