"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { useTransactions, useTransaction } from "@/hooks/use-transactions";
import { useAgentList } from "@/hooks/use-agent-list";
import { DecisionBadge } from "@/components/features/shared/decision-badge";
import { RiskBadge } from "@/components/features/shared/risk-badge";
import { ReasonCodeList, REASON_TEXT } from "@/components/features/shared/reason-code-list";
import { PolicyCheckList } from "@/components/features/shared/policy-check-list";
import { RiskBreakdown } from "@/components/features/shared/risk-breakdown";
import { EmptyState } from "@/components/features/shared/empty-state";
import { X, Copy, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<{
    decision?: string;
    agentId?: string;
    merchant?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
  }>({ page: 1 });

  const { transactions = [], meta, isLoading } = useTransactions(filters);
  const { agents = [] } = useAgentList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { transaction: detailTx, isLoading: isDetailLoading } = useTransaction(selectedId);

  const clearFilters = () => setFilters({ page: 1 });

  return (
    <div className="space-y-6 p-6">
      <TopBar title="Transactions" />

      {/* Filter Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filters.decision || ""}
          onChange={(e) => setFilters((f) => ({ ...f, decision: e.target.value || undefined, page: 1 }))}
          className="bg-slate-900 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All Decisions</option>
          <option value="ALLOW">ALLOW</option>
          <option value="DENY">DENY</option>
          <option value="REQUIRE_APPROVAL">REQUIRE_APPROVAL</option>
        </select>

        <select
          value={filters.agentId || ""}
          onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value || undefined, page: 1 }))}
          className="bg-slate-900 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2"
        >
          <option value="">All Agents</option>
          {agents.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter merchant domain..."
          value={filters.merchant || ""}
          onChange={(e) => setFilters((f) => ({ ...f, merchant: e.target.value || undefined, page: 1 }))}
          className="bg-slate-900 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
        />

        <input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))}
          className="bg-slate-900 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2"
        />

        <input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))}
          className="bg-slate-900 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2"
        />

        <button
          onClick={clearFilters}
          className="text-xs text-slate-400 hover:text-slate-200 underline ml-auto"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState title="No transactions match these filters" />
        ) : (
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="p-4">Time</th>
                <th className="p-4">Agent</th>
                <th className="p-4">Merchant</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Risk</th>
                <th className="p-4">Decision</th>
                <th className="p-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transactions.map((tx: any) => {
                const firstReason = tx.reasonCodes?.[0];
                const friendly = REASON_TEXT[firstReason] || firstReason || "—";
                return (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedId(tx.id)}
                    className="hover:bg-slate-900/60 cursor-pointer transition"
                  >
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-4 font-medium text-slate-200">
                      {tx.agentName || tx.agent?.name || "Agent"}
                    </td>
                    <td className="p-4 text-slate-300">{tx.merchantDomain}</td>
                    <td className="p-4 font-semibold text-slate-100">
                      ${tx.amountUsd?.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <RiskBadge score={tx.riskScore ?? 0} />
                    </td>
                    <td className="p-4">
                      <DecisionBadge decision={tx.decision} />
                    </td>
                    <td className="p-4 text-xs text-slate-400 truncate max-w-[180px]">
                      {friendly}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing page {filters.page} of {Math.ceil((meta?.total || transactions.length) / (meta?.limit || 10)) || 1}
          </span>
          <div className="flex gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              className="p-1.5 rounded border border-slate-800 disabled:opacity-40 hover:bg-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={transactions.length < (meta?.limit || 10)}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              className="p-1.5 rounded border border-slate-800 disabled:opacity-40 hover:bg-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Sheet */}
      {selectedId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-[520px] bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6 relative">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>

            {isDetailLoading || !detailTx ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3">
                    <DecisionBadge decision={detailTx.decision} />
                    <span className="text-2xl font-bold text-slate-100">
                      ${detailTx.amountUsd?.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(detailTx.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <p>
                    <strong className="text-slate-400">Agent:</strong>{" "}
                    {detailTx.agent?.name || detailTx.agentId}
                  </p>
                  <p>
                    <strong className="text-slate-400">Merchant:</strong>{" "}
                    {detailTx.merchantDomain}{" "}
                    {detailTx.merchantName && `(${detailTx.merchantName})`}
                  </p>
                  <p>
                    <strong className="text-slate-400">Currency:</strong>{" "}
                    {detailTx.currency || "USDC"}
                  </p>
                  <p>
                    <strong className="text-slate-400">Purpose:</strong>{" "}
                    {detailTx.purpose || "N/A"}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-mono text-slate-400 truncate">
                      ID: {detailTx.id}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(detailTx.id);
                        toast.success("Copied ID");
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">Why this decision</h4>
                  <ReasonCodeList codes={detailTx.reasonCodes || []} />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">Policy checks</h4>
                  <PolicyCheckList checks={detailTx.policyChecks || []} />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">Risk breakdown</h4>
                  <RiskBreakdown
                    breakdown={detailTx.riskBreakdown || []}
                    total={detailTx.riskScore ?? 0}
                  />
                </div>

                {detailTx.x402TxHash && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <p className="text-xs text-slate-400 font-semibold">Payment Tx Hash</p>
                    <p className="text-xs font-mono text-slate-300 break-all">
                      {detailTx.x402TxHash}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}