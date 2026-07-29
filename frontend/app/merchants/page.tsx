"use client";

import { useState } from "react";
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
  StatCard,
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

export default function MerchantsPage() {
  const { data, loading, error, reload } = useApi<Merchant[]>("/v1/merchants");
  const merchants = Array.isArray(data) ? data : [];

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [reputation, setReputation] = useState<Reputation>("TRUSTED");
  const [category, setCategory] = useState("api");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const trusted = merchants.filter((m) => m.reputation === "TRUSTED").length;
  const unknown = merchants.filter((m) => m.reputation === "UNKNOWN").length;
  const blocked = merchants.filter((m) => m.reputation === "BLOCKED").length;

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
      <div className="stats" style={{ marginBottom: 20 }}>
        <StatCard
          icon="check"
          iconBg="var(--ok-bg)"
          label="Trusted"
          value={trusted}
          loading={loading}
          foot="no extra risk points"
        />
        <StatCard
          icon="warn"
          iconBg="var(--warn-bg)"
          label="Unknown"
          value={unknown}
          loading={loading}
          foot={
            <>
              <b>+25</b> risk on every attempt
            </>
          }
        />
        <StatCard
          icon="x"
          iconBg="var(--bad-bg)"
          label="Blocked"
          value={blocked}
          loading={loading}
          foot="denied before scoring"
        />
        <StatCard
          icon="store"
          label="On the list"
          value={merchants.length}
          loading={loading}
          foot="anything else counts as unknown"
        />
      </div>

      <Card>
        <CardHeader
          title="Merchant list"
          sub={`${merchants.length} domains · anything not here counts as unknown`}
          right={
            <Button variant="s" sm icon="refresh" onClick={reload}>
              Refresh
            </Button>
          }
        />
        {loading ? (
          <CardBody>
            <Skeleton lines={5} height={18} />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : merchants.length === 0 ? (
          <EmptyState icon="store" title="No merchants yet" desc="Add the first one below." />
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Reputation</th>
                  <th>Category</th>
                  <th>Risk added</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <b>{m.name}</b>
                      <div className="sub mono">{m.domain}</div>
                    </td>
                    <td>{repTag(m.reputation)}</td>
                    <td style={{ fontSize: 13, color: "var(--ink-2)" }}>{m.category}</td>
                    <td>
                      <span className="code">{repPoints(m.reputation)}</span>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      {istDateTime(m.createdAt)}
                    </td>
                    <td>
                      <div className="act">
                        <Button
                          variant="d"
                          sm
                          icon="x"
                          loading={removing === m.id}
                          onClick={() => remove(m)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="split mt">
        <Card>
          <CardHeader
            title="Add a merchant"
            sub="Reputation decides how much risk a payment picks up"
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
                    <option value="api">api</option>
                    <option value="data">data</option>
                    <option value="cloud">cloud</option>
                    <option value="misc">misc</option>
                  </select>
                </Field>
              </div>
              <Button variant="p" icon="plus" type="submit" loading={busy}>
                Add merchant
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How reputation is used" sub="Straight from the risk engine" />
          <CardBody>
            <KV k="Trusted">+0 points</KV>
            <KV k="Unknown">
              <span style={{ color: "#D97706" }}>+25 points</span>
            </KV>
            <KV k="Blocked">
              <span style={{ color: "var(--bad)" }}>Instant deny</span>
            </KV>
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: "var(--r)",
                background: "var(--b-100)",
                border: "1px solid var(--b-200)",
                fontSize: 13,
                color: "var(--b-800)",
                lineHeight: 1.6,
              }}
            >
              A policy with <b>Block unknown merchants</b> switched on stops the payment
              before the risk engine ever runs — the score you see afterwards is only for
              context.
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
