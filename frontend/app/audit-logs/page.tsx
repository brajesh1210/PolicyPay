"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  KV,
  Pagination,
  Sheet,
  ScrollTable,
  Skeleton,
  Terminal,
} from "@/components/ui";
import Icon from "@/components/Icon";
import { useApiList } from "@/lib/hooks";
import { istDateTime, istTime, shortId } from "@/lib/format";
import { useMoney } from "@/lib/currency";
import type { AuditLog } from "@/lib/types";
import toast from "react-hot-toast";

const LIMIT = 10;

export default function AuditLogsPage() {
  const money = useMoney();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [agentQ, setAgentQ] = useState("");
  const [q, setQ] = useState("");

  const params = useMemo(() => ({ page, limit: LIMIT }), [page]);
  const { data, meta, loading, error, reload } = useApiList<AuditLog[]>(
    "/v1/audit-logs",
    params
  );

  const all = Array.isArray(data) ? data : [];
  const rows = all.filter((r) => {
    const a = agentQ.trim().toLowerCase();
    const n = q.trim().toLowerCase();
    if (a && !(r.transaction?.agent?.name ?? "").toLowerCase().includes(a)) return false;
    if (
      n &&
      !`${r.transaction?.merchantDomain ?? ""} ${r.payloadHash ?? ""} ${r.id}`
        .toLowerCase()
        .includes(n)
    )
      return false;
    return true;
  });
  const total = agentQ || q ? rows.length : meta?.total ?? rows.length;
  const detail = selected;

  const agentNames = Array.from(
    new Set(all.map((r) => r.transaction?.agent?.name).filter(Boolean) as string[])
  );

  function exportCsv() {
    const head = ["time", "agent", "merchant", "amount_usd", "payload_hash", "prev_hash"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((r) =>
      [
        r.createdAt,
        r.transaction?.agent?.name ?? "",
        r.transaction?.merchantDomain ?? "",
        r.transaction?.amountUsd ?? "",
        r.payloadHash,
        r.prevHash,
      ]
        .map(esc)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `policypay-audit-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyJson() {
    if (!detail) return;
    navigator.clipboard?.writeText(JSON.stringify(detail, null, 2));
    toast.success("Copied to clipboard");
  }

  return (
    <AppShell title="Audit Logs" sub="Append-only record of every decision">
      <Card style={{ marginBottom: 22 }}>
        <CardBody style={{ padding: "22px clamp(20px,2.6vw,26px)" }}>
          <div className="fbar">
            <div className="fld">
              <label htmlFor="a-agent">Agent</label>
              <select
                className="in"
                id="a-agent"
                value={agentQ}
                onChange={(e) => {
                  setAgentQ(e.target.value);
                  setSelected(null);
                }}
              >
                <option value="">All Agents</option>
                {agentNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="fld">
              <label htmlFor="a-q">Search</label>
              <input
                className="in"
                id="a-q"
                placeholder="Merchant, hash or id…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
              />
            </div>

            <div className="go">
              <Button variant="p" icon="refresh" onClick={reload}>
                Apply Filters
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Audit trail"
          sub="Append-only · nothing here can be edited or deleted"
          right={
            <Button variant="s" sm icon="upload" onClick={exportCsv}>
              Export CSV
            </Button>
          }
        />

        {loading ? (
          <CardBody>
            <Skeleton lines={8} height={18} />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="file"
            title="No audit entries yet"
            desc="Every decision writes one hash-chained row here."
          />
        ) : (
          <>
            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>Time (IST)</th>
                    <th>Agent</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Payload hash</th>
                    <th className="stickr" style={{ textAlign: "right" }}>
                      <span>View</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr
                      key={l.id}
                      className="rowlink"
                      onClick={() => setSelected(l)}
                    >
                      <td
                        className="mono"
                        style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}
                      >
                        {istTime(l.createdAt)}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <b>{l.transaction?.agent?.name ?? "—"}</b>
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {l.transaction?.merchantDomain ?? "—"}
                      </td>
                      <td className="num">
                        <b>
                          {typeof l.transaction?.amountUsd === "number"
                            ? money(l.transaction.amountUsd)
                            : "—"}
                        </b>
                      </td>
                      <td>
                        <span className="code">{shortId(l.payloadHash, 10, 6)}</span>
                      </td>
                      <td className="stickr">
                        <div className="act">
                          <button
                            className="iact"
                            aria-label="View this entry"
                            title="View"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(l);
                            }}
                          >
                            <Icon name="eye" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
            <Pagination page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>

      <Sheet
        open={!!detail}
        onClose={() => setSelected(null)}
        title="Audit entry"
        sub={
          detail
            ? `${shortId(detail.id, 12, 5)} · ${istDateTime(detail.createdAt)} IST`
            : undefined
        }
        wide
      >
        {detail ? (
          <div className="sheet-duo">
            <div className="gbox">
              <div className="gbox-h">
                <b>Raw entry</b>
                <div className="r">
                  <Button variant="s" sm icon="dl" onClick={copyJson}>
                    Copy
                  </Button>
                </div>
              </div>
              <div className="gbox-b flush">
                <Terminal
                  title={`audit · ${shortId(detail.id, 10, 4)}`}
                  height={330}
                  flush
                >
                  {JSON.stringify(detail, null, 2)}
                </Terminal>
              </div>
            </div>

            <div className="gbox">
              <div className="gbox-h">
                <b>Chain integrity</b>
                <div className="r">
                  <span className="tag t-ok">LINKED</span>
                </div>
              </div>
              <div className="gbox-b">
                <KV k="Entry ID">
                  <span className="mono" style={{ fontSize: 12 }}>
                    {detail.id}
                  </span>
                </KV>
                <KV k="Transaction">
                  <span className="mono" style={{ fontSize: 12 }}>
                    {shortId(detail.transactionId ?? "—", 12, 5)}
                  </span>
                </KV>
                <KV k="Payload hash">
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {detail.payloadHash}
                  </span>
                </KV>
                <KV k="Previous hash">
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {detail.prevHash ?? "— genesis —"}
                  </span>
                </KV>
                <KV k="Written at">{istDateTime(detail.createdAt)} IST</KV>

                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "var(--b-100)",
                    fontSize: 12.5,
                    color: "var(--b-800)",
                    lineHeight: 1.65,
                  }}
                >
                  Every write goes through the same append-only path and carries the
                  hash of the row before it. There is no update or delete endpoint for
                  audit rows — not even for an admin.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Sheet>

    </AppShell>
  );
}
