"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  KV,
  Skeleton,
  Switch,
  SwitchRow,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend, API_BASE } from "@/lib/api";
import { ago } from "@/lib/format";
import { useCurrency } from "@/lib/currency";
import type { Agent } from "@/lib/types";
import toast from "react-hot-toast";

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "PP").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const { money, currency, setCurrency, rate } = useCurrency();
  const { data: session } = useSession();
  const ks = useApi<{ active: boolean }>("/v1/kill-switch");
  const agents = useApi<Agent[]>("/v1/agents");

  const [killBusy, setKillBusy] = useState(false);
  const [killLocal, setKillLocal] = useState<boolean | null>(null);
  const killOn = killLocal ?? ks.data?.active ?? false;

  const [notifDeny, setNotifDeny] = useState(true);
  const [notifApproval, setNotifApproval] = useState(true);
  const [notifBudget, setNotifBudget] = useState(true);
  const [notifBurst, setNotifBurst] = useState(false);

  async function toggleKill(next: boolean) {
    setKillBusy(true);
    const prev = killOn;
    setKillLocal(next);
    try {
      await apiSend("patch", "/v1/kill-switch", { active: next });
      toast.success(
        next ? "Kill switch ON — every payment is denied" : "Kill switch off — agents can transact"
      );
      ks.reload();
    } catch (e: any) {
      setKillLocal(prev);
      toast.error(e?.message || "Could not change the kill switch");
    } finally {
      setKillBusy(false);
    }
  }

  return (
    <AppShell title="Settings" sub="Account, notifications and system controls">
      <div className={`banner${killOn ? " crit" : ""}`} style={{ marginBottom: 20 }}>
        <Icon name="power" />
        <div className="tx">
          <b>Global kill switch</b>
          <span>
            {killOn
              ? "It is ON right now — nothing can transact."
              : "Flip this and every agent is denied instantly — no exceptions, no queue."}
          </span>
        </div>
        <Switch
          checked={killOn}
          onChange={toggleKill}
          danger
          disabled={killBusy || ks.loading}
          label="Global kill switch"
        />
      </div>

      <div className="split">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <CardHeader title="Your account" sub="Signed in as the workspace admin" />
            <CardBody>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <span className="av" style={{ width: 52, height: 52, fontSize: 17 }}>
                  {initials(session?.user?.name, session?.user?.email)}
                </span>
                <div>
                  <b style={{ fontSize: 15, fontWeight: 800, display: "block" }}>
                    {session?.user?.name ?? "—"}
                  </b>
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    {session?.user?.email ?? "—"} · {session?.user?.role ?? "USER"}
                  </span>
                </div>
                <Button
                  variant="s"
                  sm
                  icon="logout"
                  style={{ marginLeft: "auto" }}
                  onClick={() => signOut({ callbackUrl: "/landing" })}
                >
                  Sign out
                </Button>
              </div>

              <div className="grid2">
                <Field label="Display name" htmlFor="n1">
                  <input className="in" id="n1" value={session?.user?.name ?? ""} readOnly disabled />
                </Field>
                <Field label="Email" htmlFor="n2">
                  <input className="in" id="n2" value={session?.user?.email ?? ""} readOnly disabled />
                </Field>
              </div>

              <div className="grid2">
                <Field
                  label="Time zone"
                  htmlFor="n3"
                  hint="Budgets still reset at 00:00 UTC — that is 5:30 AM here."
                >
                  <input className="in" id="n3" value="Asia/Kolkata (IST, UTC+5:30)" readOnly disabled />
                </Field>
                <Field
                  label="Currency shown"
                  htmlFor="n4"
                  hint="Display only — every payment is still settled in USDC."
                >
                  <select
                    className="in"
                    id="n4"
                    value={currency}
                    onChange={(e) => {
                      const c = e.target.value as "USD" | "INR";
                      setCurrency(c);
                      toast.success(
                        c === "INR"
                          ? `Showing amounts in ₹ at 1 USD = ₹${rate}`
                          : "Showing amounts in $"
                      );
                    }}
                  >
                    <option value="USD">USD ($) — settled in USDC</option>
                    <option value="INR">INR (₹) — converted for display</option>
                  </select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notifications" sub="What reaches you, and how loudly" />
            <CardBody style={{ padding: "6px 20px 20px" }}>
              <SwitchRow
                title="Every denied payment"
                desc="A HIGH alert the moment the engine says no"
                checked={notifDeny}
                onChange={setNotifDeny}
              />
              <SwitchRow
                title="Approval requests"
                desc="Nothing moves until you answer, so this stays on"
                checked={notifApproval}
                onChange={setNotifApproval}
              />
              <SwitchRow
                title="Budget at 80%"
                desc="Early warning before an agent runs itself dry"
                checked={notifBudget}
                onChange={setNotifBudget}
              />
              <SwitchRow
                title="Frequency bursts"
                desc="More than 3 payments inside 10 minutes"
                checked={notifBurst}
                onChange={setNotifBurst}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Agent keys"
              sub="Shown once at creation, stored only as a hash"
            />
            {agents.loading ? (
              <CardBody>
                <Skeleton lines={4} height={18} />
              </CardBody>
            ) : (
              <div className="tw">
                <table style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>Spent</th>
                      <th>Last used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agents.data ?? []).map((a) => (
                      <tr key={a.id}>
                        <td>
                          <b>{a.name}</b>
                          <div className="sub mono">{a.id}</div>
                        </td>
                        <td>
                          <span className={a.status === "ACTIVE" ? "tag t-ok" : "tag t-mute"}>
                            {a.status}
                          </span>
                        </td>
                        <td className="num">{money(a.totalSpent)}</td>
                        <td style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                          {ago(a.lastActiveAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <CardHeader
              title="System"
              sub="Live status"
              right={
                <span className="eyebrow">
                  <i className="live" />
                  {ks.error ? "Unreachable" : "Healthy"}
                </span>
              }
            />
            <CardBody>
              <KV k="API">
                <span style={{ color: ks.error ? "var(--bad)" : "var(--ok)" }}>
                  {ks.error ? "Unreachable" : "Operational"}
                </span>
              </KV>
              <KV k="Kill switch">
                <span style={{ color: killOn ? "var(--bad)" : "var(--ok)" }}>
                  {killOn ? "ACTIVE" : "Inactive"}
                </span>
              </KV>
              <KV k="x402 network">base-sepolia</KV>
              <KV k="Backend">
                <span className="mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>
                  {API_BASE.replace(/^https?:\/\//, "")}
                </span>
              </KV>
              <KV k="Version">
                <span className="mono" style={{ fontSize: 12 }}>
                  v1.0.0
                </span>
              </KV>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Before a live demo" sub="Run these in order" />
            <CardBody>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 16 }}>
                Spend counters live in Redis and only reset at 00:00 UTC. Clear them from the
                Railway console so all five demo scenarios start from a clean slate:
              </p>
              <div
                className="code"
                style={{ display: "block", padding: "11px 13px", lineHeight: 1.7, marginBottom: 14 }}
              >
                npm run reset:counters --workspace backend
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
                Then run <b>npm run demo</b> from the demo-agent folder. All five scenarios
                should pass.
              </p>
            </CardBody>
          </Card>

          <Card style={{ borderColor: "#F2C9C9" }}>
            <div className="card-h" style={{ borderBottomColor: "#F2C9C9" }}>
              <div>
                <h3 style={{ color: "var(--bad)" }}>Danger zone</h3>
                <p>These cannot be undone</p>
              </div>
            </div>
            <CardBody>
              <SwitchRow
                title="Freeze every agent"
                desc="Same as the kill switch above — denies everything instantly"
                right={
                  <Button
                    variant="d"
                    sm
                    loading={killBusy}
                    onClick={() => toggleKill(!killOn)}
                  >
                    {killOn ? "Unfreeze" : "Freeze"}
                  </Button>
                }
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
