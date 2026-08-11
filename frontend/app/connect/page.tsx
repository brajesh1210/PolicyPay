"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiGet, apiSend, API_BASE } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Agent } from "@/lib/types";
import toast from "react-hot-toast";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Tx = {
  id: string;
  agentId: string;
  merchantDomain: string;
  amountUsd: number;
  decision: string;
  riskScore: number;
  createdAt: string;
};

function copy(text: string, what = "Copied") {
  navigator.clipboard?.writeText(text);
  toast.success(what);
}

/* ── a code block with its own copy button ─────────────────── */
function Snippet({
  code,
  label,
  lang,
}: {
  code: string;
  label?: string;
  lang?: string;
}) {
  return (
    <div className="snip">
      {lang || label ? (
        <div className="snip-h">
          {lang ? <span className="lang">{lang}</span> : null}
          {label ? <span className="lbl">{label}</span> : null}
        </div>
      ) : null}
      <div className="snip-b">
        <pre>{code}</pre>
        <button className="snip-cp" onClick={() => copy(code)} aria-label="Copy code">
          <Icon name="dl" />
        </button>
      </div>
    </div>
  );
}

/* ── numbered step wrapper ─────────────────────────────────── */
function Step({
  n,
  title,
  desc,
  children,
  done,
}: {
  n: number;
  title: string;
  desc?: string;
  children?: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="cstep">
      <div className={`n${done ? " done" : ""}`}>{done ? <Icon name="check" /> : n}</div>
      <div className="bd">
        <h4>{title}</h4>
        {desc ? <p>{desc}</p> : null}
        {children ? <div className="in-b">{children}</div> : null}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const agents = useApi<Agent[]>("/v1/agents");
  const list = agents.data ?? [];

  const [agentId, setAgentId] = useState("");
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // listening panel
  const [seen, setSeen] = useState<Tx[]>([]);
  const [watching, setWatching] = useState(false);
  const [baseline, setBaseline] = useState<string | null>(null);

  const agent = useMemo(() => list.find((a) => a.id === agentId) ?? null, [list, agentId]);

  // pick the first agent once they load
  useEffect(() => {
    if (!agentId && list.length) setAgentId(list[0].id);
  }, [list, agentId]);

  async function loadKeys(id: string) {
    if (!id) return;
    setKeysLoading(true);
    try {
      const res = await apiGet<ApiKey[]>(`/v1/agents/${id}/api-keys`);
      setKeys(res ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Could not load keys");
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }

  useEffect(() => {
    setFresh(null);
    setKeys(null);
    if (agentId) loadKeys(agentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    setCreating(true);
    try {
      const res: any = await apiSend("post", `/v1/agents/${agentId}/api-keys`, {
        name: keyName.trim() || `${agent?.name ?? "agent"} key`,
      });
      const key = res?.apiKey ?? res?.api_key ?? res?.key ?? null;
      if (key) {
        setFresh({ name: res?.name ?? keyName.trim(), key });
        toast.success("Key created — copy it now, it is shown once");
      } else {
        toast.error("Key created but the value was not returned");
      }
      setKeyName("");
      loadKeys(agentId);
    } catch (err: any) {
      toast.error(err?.message || "Could not create the key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(k: ApiKey) {
    if (!agentId) return;
    setRevoking(k.id);
    try {
      await apiSend("delete", `/v1/agents/${agentId}/api-keys/${k.id}`);
      toast.success(`${k.name} revoked`);
      loadKeys(agentId);
    } catch (err: any) {
      toast.error(err?.message || "Could not revoke the key");
    } finally {
      setRevoking(null);
    }
  }

  /* ── watch for the first live call ───────────────────────── */
  useEffect(() => {
    if (!watching || !agentId) return;
    let stop = false;

    (async () => {
      // remember where we started so we only show new rows
      try {
        const rows = await apiGet<Tx[]>("/v1/transactions", { limit: 1, agentId });
        if (!stop) setBaseline(rows?.[0]?.id ?? "none");
      } catch {
        if (!stop) setBaseline("none");
      }
    })();

    const iv = setInterval(async () => {
      try {
        const rows = await apiGet<Tx[]>("/v1/transactions", { limit: 10, agentId });
        if (stop || !rows) return;
        const cut = rows.findIndex((r) => r.id === baseline);
        const fresh = cut === -1 ? rows : rows.slice(0, cut);
        if (fresh.length) setSeen(fresh.slice(0, 6));
      } catch {
        /* keep polling quietly */
      }
    }, 3000);

    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [watching, agentId, baseline]);

  const liveKey = fresh?.key ?? "pp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const envBlock = `POLICYPAY_API_KEY=${liveKey}\nPOLICYPAY_AGENT_ID=${agentId || "your-agent-id"}`;

  const codeBlock = `import { PolicyPay } from "policypay";

const pp = new PolicyPay();

// before your agent spends anything
const ok = await pp.check({
  amount: 4.99,
  vendor: "openai",
  why: "GPT-4 calls",
});

if (!ok.allowed) {
  console.log(ok.message);
  return;
}

// safe to spend`;

  const activeKeys = (keys ?? []).filter((k) => !k.revokedAt);

  return (
    <AppShell
      title="Connect an agent"
      sub="Put PolicyPay in front of your agent's spending — about five minutes"
    >
      {agents.error ? (
        <Card>
          <ErrorState message={agents.error} onRetry={agents.reload} />
        </Card>
      ) : agents.loading ? (
        <Card>
          <CardBody style={{ padding: 26 }}>
            <Skeleton lines={6} height={18} />
          </CardBody>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon="bot"
            title="No agents yet"
            desc="Create an agent first — it is the identity your code will authenticate as."
            action={
              <Button variant="p" onClick={() => (window.location.href = "/agents")}>
                Go to Agents
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="split" style={{ alignItems: "start" }}>
          {/* ── left: the walkthrough ── */}
          <Card>
            <CardHeader title="Set up" sub="Four steps, in order" />
            <CardBody>
              {/* 1 — pick agent */}
              <Step
                n={1}
                title="Choose which agent this is"
                desc="Policies are per-agent. Pick the one whose limits should apply."
                done={!!agentId}
              >
                <div className="apick">
                  {list.map((a) => {
                    const on = a.id === agentId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={on ? "on" : ""}
                        aria-pressed={on}
                        onClick={() => setAgentId(a.id)}
                      >
                        <span className="g">
                          <Icon name="bot" />
                        </span>
                        <span className="t">
                          <b>{a.name}</b>
                          <span>{a.policy?.name ?? "no policy"}</span>
                        </span>
                        {on ? (
                          <span className="tick">
                            <Icon name="check" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Step>

              {/* 2 — key */}
              <Step
                n={2}
                title="Create an API key"
                desc="Shown once, then only the prefix. Treat it like a password."
                done={!!fresh || activeKeys.length > 0}
              >
                <form
                  onSubmit={createKey}
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 210 }}>
                    <Field label="Key name" htmlFor="kn">
                      <input
                        className="in"
                        id="kn"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder={`${agent?.name ?? "agent"} — laptop`}
                      />
                    </Field>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <Button variant="p" type="submit" loading={creating} icon="key">
                      Create key
                    </Button>
                  </div>
                </form>

                {fresh ? (
                  <div className="freshkey">
                    <Icon name="key" />
                    <div className="t">
                      <b>Copy this now — it will not be shown again</b>
                      <code>{fresh.key}</code>
                    </div>
                    <Button
                      variant="p"
                      sm
                      icon="dl"
                      onClick={() => copy(fresh.key, "Key copied")}
                    >
                      Copy
                    </Button>
                  </div>
                ) : null}

                {/* existing keys */}
                <div style={{ marginTop: 14 }}>
                  {keysLoading ? (
                    <Skeleton lines={2} />
                  ) : activeKeys.length ? (
                    activeKeys.map((k) => (
                      <div className="krow" key={k.id}>
                        <div className="t">
                          <b>{k.name}</b>
                          <span>
                            {k.keyPrefix}••••••••••••••••{"  ·  "}
                            {k.lastUsedAt ? `used ${ago(k.lastUsedAt)}` : "never used"}
                          </span>
                        </div>
                        <Button
                          variant="s"
                          sm
                          loading={revoking === k.id}
                          onClick={() => revoke(k)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="fs-meta muted">No active keys for this agent yet.</p>
                  )}
                </div>
              </Step>

              {/* 3 — install */}
              <Step
                n={3}
                title="Install the package and add your keys"
                desc="Two values in your .env — that is the whole configuration."
              >
                <Snippet
                  code="npm install policypay"
                  lang="bash"
                  label="in your agent's project"
                />
                <Snippet code={envBlock} lang=".env" label="paste into .env" />
                <p className="fs-meta muted" style={{ marginTop: 12 }}>
                  Verify it with <code className="code">npx policypay test</code>
                </p>
              </Step>

              {/* 4 — code */}
              <Step
                n={4}
                title="Ask before spending"
                desc="One check in front of anything that costs money."
              >
                <Snippet code={codeBlock} lang="javascript" label="in your agent" />

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>
                    Can&apos;t change the code?
                  </div>
                  <p className="fs-body muted" style={{ lineHeight: 1.55, marginBottom: 12 }}>
                    Wrap the command instead. Every paid call is checked, with the agent
                    untouched.
                  </p>
                  <Snippet code="npx policypay guard -- node agent.js" lang="bash" />
                </div>
              </Step>
            </CardBody>
          </Card>

          {/* ── right: live listener + reference ── */}
          <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
            <Card>
              <CardHeader
                title="Live check"
                sub={watching ? "Listening for this agent" : "Confirm it is wired up"}
                right={
                  <Button
                    variant={watching ? "s" : "p"}
                    sm
                    onClick={() => {
                      setSeen([]);
                      setBaseline(null);
                      setWatching((w) => !w);
                    }}
                  >
                    {watching ? "Stop" : "Start listening"}
                  </Button>
                }
              />
              <CardBody>
                {!watching ? (
                  <p className="fs-body muted" style={{ lineHeight: 1.6 }}>
                    Press <b style={{ color: "var(--ink)" }}>Start listening</b>, then run
                    your agent. The first decision it makes will appear here.
                  </p>
                ) : seen.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span className="spin" style={{ color: "var(--b-500)" }} />
                    <span className="fs-body muted">
                      Waiting for {agent?.name ?? "your agent"} to call…
                    </span>
                  </div>
                ) : (
                  <div>
                    {seen.map((t) => (
                      <div className="lvrow" key={t.id}>
                        <div className="t">
                          <b>
                            ${Number(t.amountUsd).toFixed(2)}{" "}
                            <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                              to {t.merchantDomain}
                            </span>
                          </b>
                          <span>
                            risk {t.riskScore}/100 · {ago(t.createdAt)}
                          </span>
                        </div>
                        <span
                          className={`tag ${
                            t.decision === "ALLOW"
                              ? "t-ok"
                              : t.decision === "REQUIRE_APPROVAL"
                              ? "t-hold"
                              : "t-no"
                          }`}
                        >
                          {t.decision === "REQUIRE_APPROVAL" ? "HOLD" : t.decision}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="What you get back" sub="Three outcomes" />
              <CardBody>
                {(
                  [
                    ["t-ok", "ALLOW", "Under budget, merchant is fine. Go ahead."],
                    ["t-hold", "HOLD", "Held for a human. Approve it on Approvals."],
                    ["t-no", "DENY", "Refused. The reason codes say why."],
                  ] as [string, string, string][]
                ).map(([cls, label, desc]) => (
                  <div className="outrow" key={label}>
                    <span className={`tag ${cls}`}>{label}</span>
                    <p>{desc}</p>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Endpoint" sub="If you'd rather call it directly" />
              <CardBody>
                {(
                  [
                    ["Gateway", API_BASE],
                    ["Path", "POST /v1/authorize-payment"],
                    ["Auth", "Authorization: Bearer pp_live_…"],
                    ["Agent id", agentId || "—"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div className="eprow" key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
                <Button
                  variant="s"
                  sm
                  icon="dl"
                  style={{ marginTop: 16 }}
                  onClick={() => copy(agentId, "Agent id copied")}
                  disabled={!agentId}
                >
                  Copy agent id
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
