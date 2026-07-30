"use client";

import { useState } from "react";
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
  Field,
  Skeleton,
  SwitchRow,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { ago, money, pct, shortId } from "@/lib/format";
import type { Agent, Policy } from "@/lib/types";
import toast from "react-hot-toast";

type Filter = "all" | "ACTIVE" | "PAUSED";

export default function AgentsPage() {
  const { data, loading, error, reload } = useApi<Agent[]>("/v1/agents");
  const pol = useApi<Policy[]>("/v1/policies");

  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);

  const agents = Array.isArray(data) ? data : [];
  const policies = pol.data ?? [];
  const shown = agents.filter((a) => (filter === "all" ? true : a.status === filter));
  const activeCount = agents.filter((a) => a.status === "ACTIVE").length;
  const pausedCount = agents.filter((a) => a.status !== "ACTIVE").length;

  const policyOf = (a: Agent) =>
    a.policy ?? policies.find((p) => p.id === a.policyId) ?? null;
  const capOf = (a: Agent) =>
    policies.find((p) => p.id === a.policyId)?.dailyBudgetUsd ?? 0;

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the agent a name first");
      return;
    }
    setBusy(true);
    try {
      const res: any = await apiSend("post", "/v1/agents", {
        name: name.trim(),
        description: desc.trim() || undefined,
        policyId: policyId || policies[0]?.id,
        status: paused ? "PAUSED" : "ACTIVE",
      });
      const key = res?.apiKey ?? res?.api_key ?? res?.key ?? null;
      if (key) setNewKey({ name: name.trim(), key });
      toast.success("Agent created");
      setName("");
      setDesc("");
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Could not create the agent");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(a: Agent) {
    setToggling(a.id);
    const next = a.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await apiSend("patch", `/v1/agents/${a.id}`, { status: next });
      toast.success(next === "PAUSED" ? `${a.name} paused` : `${a.name} resumed`);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Could not change the agent");
    } finally {
      setToggling(null);
    }
  }

  return (
    <AppShell title="Agents" sub="Who is allowed to spend, and how much">
      {newKey ? (
        <div className="banner" style={{ background: "var(--b-100)", borderColor: "var(--b-200)" }}>
          <Icon name="key" />
          <div className="tx">
            <b>API key for {newKey.name} — copy it now</b>
            <span className="mono" style={{ wordBreak: "break-all" }}>
              {newKey.key}
            </span>
          </div>
          <Button
            variant="s"
            sm
            onClick={() => {
              navigator.clipboard?.writeText(newKey.key);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button variant="s" sm icon="x" onClick={() => setNewKey(null)}>
            Hide
          </Button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All agents · ${agents.length}` },
            { value: "ACTIVE", label: `Active · ${activeCount}` },
            { value: "PAUSED", label: `Paused · ${pausedCount}` },
          ]}
        />
      </div>

      {loading ? (
        <div className="pgrid">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton lines={5} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="bot"
            title="No agents here"
            desc="Register one below and PolicyPay will start guarding its payments straight away."
          />
        </Card>
      ) : (
        <div className="pgrid">
          {shown.map((a) => {
            const cap = capOf(a);
            const p100 = pct(a.totalSpent, cap);
            const cls = p100 > 85 ? "bad" : p100 > 60 ? "warn" : "";
            return (
              <article className="agent-card" key={a.id}>
                <div className="ac-top">
                  <span className="ac-av">
                    <Icon name="bot" />
                  </span>
                  <span className="tx">
                    <b>{a.name}</b>
                    <span>{a.id}</span>
                  </span>
                  <span className={a.status === "ACTIVE" ? "tag t-ok" : "tag t-mute"}>
                    {a.status}
                  </span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="fs-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Total spent</span>
                    <b className="num">
                      {money(a.totalSpent)} / {money(cap)}
                    </b>
                  </div>
                  <div className={`prog ${cls}`}>
                    <i style={{ width: `${p100}%` }} />
                  </div>
                </div>

                <div className="ac-meta">
                  <div>
                    <span>Policy</span>
                    <b>{policyOf(a)?.name ?? "—"}</b>
                  </div>
                  <div>
                    <span>Decisions</span>
                    <b>{a.totalTx}</b>
                  </div>
                  <div>
                    <span>Last seen</span>
                    <b className="fs-body-sm">{ago(a.lastActiveAt)}</b>
                  </div>
                  <div>
                    <span>Kill switch</span>
                    <b
                      style={{
                        color: a.killSwitchActive ? "var(--bad)" : "var(--ok)",
                      }}
                    >
                      {a.killSwitchActive ? "On" : "Off"}
                    </b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <Button
                    variant="s"
                    sm
                    icon="power"
                    style={{ flex: 1 }}
                    loading={toggling === a.id}
                    onClick={() => togglePause(a)}
                  >
                    {a.status === "ACTIVE" ? "Pause" : "Resume"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Card className="mt">
        <CardHeader
          title="Register a new agent"
          sub="The API key is shown once, then stored only as a hash"
        />
        <CardBody>
          <form onSubmit={createAgent}>
            <div className="grid2">
              <Field label="Agent name" htmlFor="an" hint="Lower-case, hyphens only. This shows up in every log line.">
                <input
                  className="in"
                  id="an"
                  placeholder="research-bot-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field label="Policy" htmlFor="ap" hint="You can move the agent to another policy at any time.">
                <select
                  className="in"
                  id="ap"
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">
                    {policies[0] ? `${policies[0].name} (default)` : "Loading…"}
                  </option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.perTxLimitUsd)} / {money(p.dailyBudgetUsd)} /{" "}
                      {money(p.monthlyBudgetUsd)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="What is it for?" htmlFor="ad">
              <textarea
                className="in"
                id="ad"
                placeholder="Pulls market data every 15 minutes and pays per call."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                disabled={busy}
              />
            </Field>

            <SwitchRow
              title="Start in paused state"
              desc="Register the agent but reject its payments until you flip it on"
              checked={paused}
              onChange={setPaused}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <Button variant="p" icon="plus" type="submit" loading={busy}>
                Create agent and show key
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </AppShell>
  );
}
