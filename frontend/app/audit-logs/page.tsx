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
  Skeleton,
  Terminal,
} from "@/components/ui";
import { useApiList } from "@/lib/hooks";
import { istDateTime, istTime, money, shortId } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import toast from "react-hot-toast";

const LIMIT = 10;

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params = useMemo(() => ({ page, limit: LIMIT }), [page]);
  const { data, meta, loading, error, reload } = useApiList<AuditLog[]>(
    "/v1/audit-logs",
    params
  );

  const rows = Array.isArray(data) ? data : [];
  const total = meta?.total ?? rows.length;
  const detail = selected ?? rows[0] ?? null;

  function copyJson() {
    if (!detail) return;
    navigator.clipboard?.writeText(JSON.stringify(detail, null, 2));
    toast.success("Copied to clipboard");
  }

  return (
    <AppShell title="Audit Logs" sub="Append-only record of every decision">
      <Card>
        <CardHeader
          title="Audit trail"
          sub="Append-only · nothing here can be edited or deleted"
          right={
            <Button variant="s" sm icon="refresh" onClick={reload}>
              Refresh
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
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Time (IST)</th>
                    <th>Agent</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Payload hash</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td
                        className="mono fs-mono-sm"
                        style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}
                      >
                        {istTime(l.createdAt)}
                      </td>
                      <td className="fs-body-sm">
                        <b>{l.transaction?.agent?.name ?? "—"}</b>
                      </td>
                      <td className="mono fs-mono-base">
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
                      <td>
                        <div className="act">
                          <Button variant="s" sm icon="eye" onClick={() => setSelected(l)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>

      <div className="split mt">
        <Card>
          <CardHeader
            title="Raw entry"
            sub="Exactly what is stored"
            right={
              <Button variant="s" sm onClick={copyJson} disabled={!detail}>
                Copy
              </Button>
            }
          />
          <CardBody style={{ padding: 0 }}>
            <Terminal title={`audit · ${detail ? shortId(detail.id, 10, 4) : "—"}`} height={250} flush>
              {detail ? JSON.stringify(detail, null, 2) : "No entry selected."}
            </Terminal>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Chain integrity" sub="Each row links to the one before it" />
          <CardBody>
            {detail ? (
              <>
                <KV k="Entry ID">
                  <span className="mono fs-mono-sm">
                    {detail.id}
                  </span>
                </KV>
                <KV k="Transaction">
                  <span className="mono fs-mono-sm">
                    {shortId(detail.transactionId ?? "—", 12, 5)}
                  </span>
                </KV>
                <KV k="Payload hash">
                  <span className="mono fs-mono-xs" style={{ wordBreak: "break-all" }}>
                    {detail.payloadHash}
                  </span>
                </KV>
                <KV k="Previous hash">
                  <span className="mono fs-mono-xs" style={{ wordBreak: "break-all" }}>
                    {detail.prevHash ?? "— genesis —"}
                  </span>
                </KV>
                <KV k="Written at">{istDateTime(detail.createdAt)} IST</KV>
              </>
            ) : (
              <Skeleton lines={4} />
            )}

            <div
              className="fs-body-sm"
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: "var(--r)",
                background: "var(--tint)",
                border: "1px solid var(--line)",
                color: "var(--ink-2)",
                lineHeight: 1.6,
              }}
            >
              Every write goes through the same append-only path and carries the hash of
              the row before it. There is no update or delete endpoint for audit rows —
              not even for an admin.
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
