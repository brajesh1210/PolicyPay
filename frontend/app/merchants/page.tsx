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
  KV,
  Skeleton,
} from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { apiSend } from "@/lib/api";
import { istDateTime } from "@/lib/format";
import type { Merchant, Reputation } from "@/lib/types";
import toast from "react-hot-toast";

function repTag(r: Reputation) {
  if (r === "TRUSTED") return <span className="tag t-ok">TRUSTED</span>;
  if (r === "UNKNOWN") return <span className="tag t-hold">UNKNOWN</span>;
  return <span className="tag t-no">BLOCKED</span>;
}

function repPoints(r: Reputation) {
  if (r === "TRUSTED") return "0 pts";
  if (r === "UNKNOWN") return "+25 pts";
  return "deny";
}

/* every category gets its own glyph and tint, as in the reference */
const CATS: Record<string, { icon: string; bg: string; fg: string; label: string }> = {
  api: { icon: "cloud", bg: "var(--b-100)", fg: "var(--b-700)", label: "API Service" },
  data: { icon: "database", bg: "var(--ok-bg)", fg: "var(--ok)", label: "Data Provider" },
  cloud: { icon: "cloud", bg: "var(--pur-bg)", fg: "var(--pur)", label: "Cloud Service" },
  misc: { icon: "store", bg: "#EDF0F6", fg: "var(--ink-3)", label: "Other" },
};

function catPill(category: string) {
  const c = CATS[category] ?? CATS.misc;
  return (
    <span className="gpill" style={{ background: c.bg, color: c.fg }}>
      <Icon name={c.icon} />
      {c.label}
    </span>
  );
}

/* a stable colour per domain so the tile does not flicker between loads */
const MARKS = ["#4D8DF6", "#12A150", "#7C5CFC", "#E5484D", "#DF9008", "#0E7C86"];
function markColour(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return MARKS[n % MARKS.length];
}

type Tab = "allow" | "block";

export default function MerchantsPage() {
  const { data, loading, error, reload } = useApi<Merchant[]>("/v1/merchants");
  const merchants = Array.isArray(data) ? data : [];

  const [tab, setTab] = useState<Tab>("allow");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [reputation, setReputation] = useState<Reputation>("TRUSTED");
  const [category, setCategory] = useState("api");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const allowed = merchants.filter((m) => m.reputation !== "BLOCKED");
  const blocked = merchants.filter((m) => m.reputation === "BLOCKED");

  const shown = useMemo(() => {
    const base = tab === "allow" ? allowed : blocked;
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.domain.toLowerCase().includes(needle) ||
        (m.category ?? "").toLowerCase().includes(needle)
    );
  }, [tab, q, merchants]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) {
      toast.error("Name and domain are both required");
      return;
    }
    setBusy(true);
    try {
      await apiSend("post", "/v1/merchants", {
        name: name.trim(),
        domain: domain.trim().toLowerCase(),
        reputation,
        category,
      });
      toast.success("Merchant added");
      setName("");
      setDomain("");
      setAdding(false);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Could not add the merchant");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Merchant) {
    setRemoving(m.id);
    try {
      await apiSend("delete", `/v1/merchants/${m.id}`);
      toast.success(`${m.name} removed`);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove the merchant");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <AppShell title="Merchants" sub="Who your agents are allowed to pay">
      <div className="phead">
        <div className="segs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "allow"}
            className={`seg${tab === "allow" ? " on" : ""}`}
            onClick={() => setTab("allow")}
          >
            <i style={{ background: "var(--ok)" }} />
            Allowlisted ({allowed.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === "block"}
            className={`seg${tab === "block" ? " on" : ""}`}
            onClick={() => setTab("block")}
          >
            <i style={{ background: "var(--bad)" }} />
            Blocklisted ({blocked.length})
          </button>
        </div>

        <div className="sp" />

        <label className="psearch">
          <Icon name="search" />
          <input
            placeholder="Search merchants…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search merchants"
          />
        </label>

        <Button variant="p" icon="plus" onClick={() => setAdding((v) => !v)}>
          Add Merchant
        </Button>
      </div>

      {adding ? (
        <Card style={{ marginBottom: 22 }}>
          <CardHeader
            title="Add a merchant"
            sub="Reputation decides how much risk a payment picks up"
            right={
              <Button variant="s" sm icon="x" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            }
          />
          <CardBody>
            <form onSubmit={add}>
              <div className="grid2">
                <Field label="Display name" htmlFor="m1">
                  <input
                    className="in"
                    id="m1"
                    placeholder="Weather API"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Field label="Domain" htmlFor="m2">
                  <input
                    className="in"
                    id="m2"
                    placeholder="weather-api.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={busy}
                  />
                </Field>
              </div>
              <div className="grid2">
                <Field label="Reputation" htmlFor="m3">
                  <select
                    className="in"
                    id="m3"
                    value={reputation}
                    onChange={(e) => setReputation(e.target.value as Reputation)}
                    disabled={busy}
                  >
                    <option value="TRUSTED">Trusted — adds 0 risk points</option>
                    <option value="UNKNOWN">Unknown — adds 25 risk points</option>
                    <option value="BLOCKED">Blocked — denied before scoring</option>
                  </select>
                </Field>
                <Field label="Category" htmlFor="m4">
                  <select
                    className="in"
                    id="m4"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={busy}
                  >
                    <option value="api">API service</option>
                    <option value="data">Data provider</option>
                    <option value="cloud">Cloud service</option>
                    <option value="misc">Other</option>
                  </select>
                </Field>
              </div>
              <Button variant="p" icon="plus" type="submit" loading={busy}>
                Add merchant
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        {loading ? (
          <CardBody style={{ padding: 26 }}>
            <Skeleton lines={5} height={18} />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="store"
            title={q ? "Nothing matches that search" : "Nothing on this list"}
            desc={
              q
                ? "Try a different name or domain."
                : tab === "allow"
                ? "Add the first merchant and your agents can start paying it."
                : "No domain has been blocked outright."
            }
            action={
              !q && tab === "allow" ? (
                <Button variant="p" icon="plus" onClick={() => setAdding(true)}>
                  Add Merchant
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Merchant Name</th>
                  <th>Domain URL</th>
                  <th>Category</th>
                  <th>Risk added</th>
                  <th>Date Added</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="idc">
                        <span
                          className="mk"
                          style={{ background: markColour(m.domain) }}
                          aria-hidden="true"
                        >
                          {m.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="tx">
                          <b>{m.name}</b>
                          <span>{repTag(m.reputation)}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="dlink">{m.domain}</span>
                    </td>
                    <td>{catPill(m.category)}</td>
                    <td>
                      <span className="code">{repPoints(m.reputation)}</span>
                    </td>
                    <td className="fs-meta" style={{ whiteSpace: "nowrap" }}>
                      {istDateTime(m.createdAt)}
                    </td>
                    <td>
                      <div className="act">
                        <button
                          className="iact no"
                          aria-label={`Remove ${m.name}`}
                          title="Remove"
                          disabled={removing === m.id}
                          onClick={() => remove(m)}
                        >
                          {removing === m.id ? (
                            <span className="spin" />
                          ) : (
                            <Icon name="trash" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt">
        <CardHeader title="How reputation is used" sub="Straight from the risk engine" />
        <CardBody>
          <div className="grid2">
            <div>
              <KV k="Trusted">+0 points</KV>
              <KV k="Unknown">
                <span style={{ color: "var(--warn)" }}>+25 points</span>
              </KV>
              <KV k="Blocked">
                <span style={{ color: "var(--bad)" }}>Instant deny</span>
              </KV>
            </div>
            <div
              className="fs-body-sm"
              style={{
                padding: "16px 18px",
                borderRadius: 18,
                background: "var(--b-100)",
                color: "var(--b-800)",
                lineHeight: 1.65,
                alignSelf: "start",
              }}
            >
              A policy with <b>Block unknown merchants</b> switched on stops the payment
              before the risk engine ever runs — the score you see afterwards is only for
              context.
            </div>
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}
