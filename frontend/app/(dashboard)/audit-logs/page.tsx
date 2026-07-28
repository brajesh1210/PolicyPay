"use client";

import { TopBar } from "@/components/layout/top-bar";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { DecisionBadge } from "@/components/features/shared/decision-badge";
import { EmptyState } from "@/components/features/shared/empty-state";
import { Copy, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuditLogsPage() {
  const { logs = [], isLoading } = useAuditLogs();

  return (
    <div className="space-y-6 p-6">
      <TopBar title="Audit Logs" />

      {/* Explanation Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-200">Tamper-evident log</p>
          <p className="text-xs text-slate-400">
            Every decision is hashed together with the hash of the previous entry. If anyone
            edits or deletes an old record, the chain no longer matches, making tampering
            detectable.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="p-4">Time</th>
                <th className="p-4">Agent</th>
                <th className="p-4">Merchant</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Decision</th>
                <th className="p-4">Hash</th>
                <th className="p-4">Previous Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {logs.map((log: any) => {
                const hash = log.payloadHash || log.hash || "";
                const prev = log.prevHash || log.previousHash;

                return (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition">
                    <td className="p-4 text-slate-400 font-sans text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 font-sans font-medium text-slate-200">
                      {log.agentName || log.agentId || "Agent"}
                    </td>
                    <td className="p-4 font-sans text-slate-300">{log.merchantDomain}</td>
                    <td className="p-4 font-sans font-semibold text-slate-100">
                      ${log.amountUsd?.toFixed(2)}
                    </td>
                    <td className="p-4 font-sans">
                      <DecisionBadge decision={log.decision} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-300">{hash.slice(0, 12)}...</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(hash);
                            toast.success("Hash copied");
                          }}
                          className="p-1 text-slate-500 hover:text-slate-200"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      {prev ? (
                        <span className="text-slate-500">{prev.slice(0, 12)}...</span>
                      ) : (
                        <span className="text-slate-600 font-sans italic">genesis</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Each row's Previous value should equal the Hash of the row below it.
      </p>
    </div>
  );
}