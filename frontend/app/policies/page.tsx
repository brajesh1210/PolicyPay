"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  KV,
  Skeleton,
  SwitchRow,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { money } from "@/lib/format";
import type { Policy } from "@/lib/types";
import toast from "react-hot-toast";

const BLURB: Record<string, string> = {
  CONSERVATIVE: "Tight caps and a narrow window. Good for a new agent you do not trust yet.",
  MODERATE: "A working default. Enough room for a busy agent without losing the leash.",
  AGGRESSIVE: "High ceilings, no time window. Only for agents you have already watched for a while.",
};

type Draft = {
  perTxLimitUsd: string;
  dailyBudgetUsd: string;
  monthlyBudgetUsd: string;
  maxTxPerHour: string;
  maxTxPerDay: string;
  approvalThresholdScore: string;
  denyThresholdScore: string;
  blockUnknownMerchants: boolean;
  enabled: boolean;
};

function toDraft(p: Policy): Draft {
  return {
    perTxLimitUsd: String(p.perTxLimitUsd),
    dailyBudgetUsd: String(p.dailyBudgetUsd),
    monthlyBudgetUsd: String(p.monthlyBudgetUsd),
    maxTxPerHour: String(p.maxTxPerHour),
    maxTxPerDay: String(p.maxTxPerDay),
    approvalThresholdScore: String(p.approvalThresholdScore),
    denyThresholdScore: String(p.denyThresholdScore),
    blockUnknownMerchants: p.blockUnknownMerchants,
    enabled: p.enabled,
  };
}

export default function PoliciesPage() {
  const { data, loading, error, reload } = useApi<Policy[]>("/v1/policies");
  const policies = Array.isArray(data) ? data : [];

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editId && policies.length > 0) {
      setEditId(policies[0].id);
      setDraft(toDraft(policies[0]));
    }
  }, [policies, editId]);

  const editing = policies.find((p) => p.id === editId) ?? null;

  function pick(p: Policy) {
    setEditId(p.id);
    setDraft(toDraft(p));
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function save() {
    if (!editing || !draft) return;

    const appr = Number(draft.approvalThresholdScore);
    const deny = Number(draft.denyThresholdScore);
    if (!(deny > appr)) {
      toast.error("The deny threshold must be higher than the approval threshold");
      return;
    }

    setBusy(true);
    try {
      await apiSend("patch", `/v1/policies/${editing.id}`, {
        perTxLimitUsd: Number(draft.perTxLimitUsd),
        dailyBudgetUsd: Number(draft.dailyBudgetUsd),
        monthlyBudgetUsd: Number(draft.monthlyBudgetUsd),
        maxTxPerHour: Number(draft.maxTxPerHour),
        maxTxPerDay: Number(draft.maxTxPerDay),
        approvalThresholdScore: appr,
        denyThresholdScore: deny,
        blockUnknownMerchants: draft.blockUnknownMerchants,
        enabled: draft.enabled,
      });
      toast.success(`${editing.name} saved`);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not save the policy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Policies" sub="The rulebook every agent lives inside">
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", maxWidth: 600 }}>
          A policy is the rulebook one or more agents live inside. Change it here and every
          agent on it follows the new limits from the next request onward.
        </p>
      </div>

      {loading ? (
        <div className="pgrid">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton lines={7} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : policies.length === 0 ? (
        <Card>
          <EmptyState icon="shield" title="No policies found" />
        </Card>
      ) : (
        <div className="pgrid">
          {policies.map((p) => (
            <article className="card" key={p.id}>
              <CardHeader
                title={p.name}
                sub={`${p._count?.agents ?? 0} agent${(p._count?.agents ?? 0) === 1 ? "" : "s"} assigned`}
                right={
                  <span className={p.enabled ? "tag t-ok" : "tag t-mute"}>
                    {p.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                }
              />
              <CardBody>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                  {BLURB[p.template] ?? "Custom policy."}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  {[
                    ["Per transaction", money(p.perTxLimitUsd)],
                    ["Per day", money(p.dailyBudgetUsd)],
                    ["Per month", money(p.monthlyBudgetUsd)],
                    ["Rate limit", `${p.maxTxPerHour}/hr`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          letterSpacing: ".8px",
                          textTransform: "uppercase",
                          color: "var(--ink-3)",
                        }}
                      >
                        {k}
                      </span>
                      <b style={{ display: "block", fontSize: 18, fontWeight: 800, marginTop: 3 }}>
                        {v}
                      </b>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <KV k="Approval at">risk ≥ {p.approvalThresholdScore}</KV>
                  <KV k="Deny at">risk ≥ {p.denyThresholdScore}</KV>
                  <KV k="Allowed hours">
                    {p.allowedHoursStart && p.allowedHoursEnd
                      ? `${p.allowedHoursStart} – ${p.allowedHoursEnd}`
                      : "No restriction"}
                  </KV>
                  <KV k="Unknown merchants">
                    <span style={{ color: p.blockUnknownMerchants ? "var(--bad)" : "var(--ink-3)" }}>
                      {p.blockUnknownMerchants ? "Blocked" : "Allowed"}
                    </span>
                  </KV>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <Button variant="s" sm icon="cog" style={{ flex: 1 }} onClick={() => pick(p)}>
                    Edit policy
                  </Button>
                </div>
              </CardBody>
            </article>
          ))}
        </div>
      )}

      {editing && draft ? (
        <Card className="mt">
          <CardHeader
            title={`Edit · ${editing.name}`}
            sub={`Applies to ${editing._count?.agents ?? 0} agent(s) immediately on save`}
            right={<span className="tag t-info">{editing.template}</span>}
          />
          <CardBody>
            <div className="grid3">
              <Field label="Per transaction (USD)" htmlFor="p1">
                <input
                  className="in"
                  id="p1"
                  type="number"
                  step="0.01"
                  value={draft.perTxLimitUsd}
                  onChange={(e) => set("perTxLimitUsd", e.target.value)}
                />
              </Field>
              <Field label="Per day (USD)" htmlFor="p2">
                <input
                  className="in"
                  id="p2"
                  type="number"
                  step="0.01"
                  value={draft.dailyBudgetUsd}
                  onChange={(e) => set("dailyBudgetUsd", e.target.value)}
                />
              </Field>
              <Field label="Per month (USD)" htmlFor="p3">
                <input
                  className="in"
                  id="p3"
                  type="number"
                  step="0.01"
                  value={draft.monthlyBudgetUsd}
                  onChange={(e) => set("monthlyBudgetUsd", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid3">
              <Field label="Transactions per hour" htmlFor="p4">
                <input
                  className="in"
                  id="p4"
                  type="number"
                  value={draft.maxTxPerHour}
                  onChange={(e) => set("maxTxPerHour", e.target.value)}
                />
              </Field>
              <Field label="Transactions per day" htmlFor="p5">
                <input
                  className="in"
                  id="p5"
                  type="number"
                  value={draft.maxTxPerDay}
                  onChange={(e) => set("maxTxPerDay", e.target.value)}
                />
              </Field>
              <Field
                label="Allowed hours (UTC)"
                htmlFor="p6"
                hint="Set on the backend seed — read only here."
              >
                <input
                  className="in"
                  id="p6"
                  value={
                    editing.allowedHoursStart && editing.allowedHoursEnd
                      ? `${editing.allowedHoursStart} – ${editing.allowedHoursEnd}`
                      : "No restriction"
                  }
                  readOnly
                  disabled
                />
              </Field>
            </div>

            <div className="grid2">
              <Field
                label="Send to approval at risk ≥"
                htmlFor="p7"
                hint="Anything at or above this waits for a human."
              >
                <input
                  className="in"
                  id="p7"
                  type="number"
                  value={draft.approvalThresholdScore}
                  onChange={(e) => set("approvalThresholdScore", e.target.value)}
                />
              </Field>
              <Field
                label="Deny outright at risk ≥"
                htmlFor="p8"
                hint="Must be higher than the approval threshold."
              >
                <input
                  className="in"
                  id="p8"
                  type="number"
                  value={draft.denyThresholdScore}
                  onChange={(e) => set("denyThresholdScore", e.target.value)}
                />
              </Field>
            </div>

            <SwitchRow
              title="Block unknown merchants"
              desc="Any domain not on the merchant list is denied before risk is even scored"
              checked={draft.blockUnknownMerchants}
              onChange={(v) => set("blockUnknownMerchants", v)}
            />
            <SwitchRow
              title="Policy enabled"
              desc="Turning this off denies every payment from agents on this policy"
              checked={draft.enabled}
              onChange={(v) => set("enabled", v)}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <Button variant="p" icon="check" loading={busy} onClick={save}>
                Save policy
              </Button>
              <Button variant="s" onClick={() => setDraft(toDraft(editing))} disabled={busy}>
                Discard changes
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </AppShell>
  );
}
