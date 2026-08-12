"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  SwitchRow,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { ago, pct } from "@/lib/format";
import { useMoney } from "@/lib/currency";
import type { Agent, Policy } from "@/lib/types";
import toast from "react-hot-toast";

type Filter = "all" | "ACTIVE" | "PAUSED";

export default function AgentsPage() {
  const money = useMoney();
  const { data, loading, error, reload } = useApi<Agent[]>("/v1/agents");
  const pol = useApi<Policy[]>("/v1/policies");

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);

  const agents = Array.isArray(data) ? data : [];
  const policies = pol.data ?? [];
  const activeCount = agents.filter((a) => a.status === "ACTIVE").length;
  const pausedCount = agents.filter((a) => a.status !== "ACTIVE").length;

  const shown = useMemo(() => {
    const base = agents.filter((a) => {
      if (filter === "all") return true;
      if (filter === "ACTIVE") return a.status === "ACTIVE";
      return a.status !== "ACTIVE";
    });
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) || a.id.toLowerCase().includes(needle)
    );
  }, [agents, filter, q]);

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
        status: paused ? "INACTIVE" : "ACTIVE",
      });
      const key = res?.apiKey ?? res?.api_key ?? res?.key ?? null;
      if (key) setNewKey({ name: name.trim(), key });
      toast.success("Agent created");
      setName("");
      setDesc("");
      setAdding(false);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Could not create the agent");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(a: Agent) {
    setToggling(a.id);
    const next = a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiSend("put", `/v1/agents/${a.id}`, { status: next });
      toast.success(next === "INACTIVE" ? `${a.name} paused` : `${a.name} resumed`);
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
        <div className="banner" style={{ borderLeftColor: "var(--b-500)" }}>
          <Icon name="key" style={{ stroke: "var(--b-600)" }} />
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

      <div className="phead">
        <div className="segs" role="tablist">
          {(
            [
              ["all", `All · ${agents.length}`],
              ["ACTIVE", `Active · ${activeCount}`],
              ["PAUSED", `Paused · ${pausedCount}`],
            ] as [Filter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={filter === v}
              className={`seg${filter === v ? " on" : ""}`}
              onClick={() => setFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sp" />

        <label className="psearch">
          <Icon name="search" />
          <input
            placeholder="Search agents…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search agents"
          />
        </label>

        <Button variant="p" icon="plus" onClick={() => setAdding((v) => !v)}>
          Add Agent
        </Button>
      </div>

      {adding ? (
        <Card style={{ marginBottom: 22 }}>
          <CardHeader
            title="Register a new agent"
            sub="The API key is shown once, then stored only as a hash"
            right={
              <Button variant="s" sm icon="x" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            }
          />
          <CardBody>
            <form onSubmit={createAgent}>
              <div className="grid2">
                <Field
                  label="Agent name"
                  htmlFor="an"
                  hint="Lower-case, hyphens only. This shows up in every log line."
                >
                  <input
                    className="in"
                    id="an"
                    placeholder="research-bot-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Field
                  label="Policy"
                  htmlFor="ap"
                  hint="You can move the agent to another policy at any time."
                >
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
      ) : null}

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
            title={q ? "Nothing matches that search" : "No agents here"}
            desc={
              q
                ? "Try a different name or id."
                : "Register one and PolicyPay will start guarding its payments straight away."
            }
            action={
              !q ? (
                <Button variant="p" icon="plus" onClick={() => setAdding(true)}>
                  Add Agent
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="pgrid">
          {shown.map((a) => {
            const cap = capOf(a);
            const p100 = pct(a.totalSpent, cap);
            const cls = p100 > 85 ? "bad" : p100 > 60 ? "warn" : "";
            const on = a.status === "ACTIVE";
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
                </div>

                <div style={{ marginTop: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                    }}
                  >
                    <b className="num" style={{ fontSize: 15 }}>
                      {money(a.totalSpent)}
                    </b>
                    <span className="fs-meta">of {money(cap)} today</span>
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
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span className={on ? "tag t-ok" : "tag t-mute"}>
                    {on ? "ACTIVE" : "PAUSED"}
                  </span>
                  <span className="fs-meta" style={{ whiteSpace: "nowrap" }}>
                    Last active {ago(a.lastActiveAt)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    className="iact"
                    aria-label={on ? `Pause ${a.name}` : `Resume ${a.name}`}
                    title={on ? "Pause" : "Resume"}
                    disabled={toggling === a.id}
                    onClick={() => togglePause(a)}
                  >
                    {toggling === a.id ? <span className="spin" /> : <Icon name="power" />}
                  </button>
                  {a.killSwitchActive ? (
                    <span className="tag t-no" title="Kill switch is on for this agent">
                      KILLED
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}