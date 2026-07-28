"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { useApprovals, approvalsApi } from "@/hooks/use-approvals";
import { RiskBadge } from "@/components/features/shared/risk-badge";
import { REASON_TEXT } from "@/components/features/shared/reason-code-list";
import { EmptyState } from "@/components/features/shared/empty-state";
import { CheckCircle2, Clock, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading, refresh } = useApprovals("PENDING");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async () => {
    if (!selectedTx || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === "approve") {
        await approvalsApi.approve(selectedTx.id, note);
        toast.success("Payment approved");
      } else {
        await approvalsApi.reject(selectedTx.id, note);
        toast.success("Payment rejected");
      }
      refresh();
      setSelectedTx(null);
      setActionType(null);
      setNote("");
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <TopBar title="Approvals" />
      <p className="text-sm text-slate-400">
        {approvals.length} waiting for your decision
      </p>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />}
          title="Nothing waiting"
          description="All payments have been handled. New approval requests appear here automatically."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approvals.map((item: any) => {
            const reason = item.reasonCodes?.[0];
            const friendlyReason = REASON_TEXT[reason] || reason || "Requires human review";
            const created = new Date(item.createdAt).getTime();
            const now = Date.now();
            const minutesAgo = Math.max(0, Math.floor((now - created) / 60000));
            const expiresMins = Math.max(0, 30 - minutesAgo);
            const isExpired = expiresMins === 0;

            return (
              <div
                key={item.id}
                className={`rounded-xl border border-slate-800 bg-slate-950 p-5 flex flex-col justify-between space-y-4 ${
                  isExpired ? "opacity-50" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {item.agent?.name || item.agentId || "Unknown Agent"}
                    </span>
                    <RiskBadge score={item.riskScore ?? 0} />
                  </div>

                  <div>
                    <span className="text-3xl font-bold text-slate-100">
                      ${item.amountUsd?.toFixed(2)}
                    </span>
                    <span className="ml-2 text-sm text-slate-400 font-mono">
                      {item.currency || "USDC"}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-slate-200 font-medium">
                      {item.merchantDomain}
                    </p>
                    {item.merchantName && (
                      <p className="text-xs text-slate-400">{item.merchantName}</p>
                    )}
                  </div>

                  {item.purpose && (
                    <p className="text-xs text-slate-400 italic">"{item.purpose}"</p>
                  )}

                  <div className="rounded-lg bg-amber-950/40 border border-amber-900/50 p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">
                      Why this needs approval
                    </p>
                    <p className="text-xs text-amber-200/90">{friendlyReason}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Requested {minutesAgo}m ago
                    </span>
                    <span>
                      {isExpired ? "Expired" : `Expires in ${expiresMins}m`}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 transition-all"
                      style={{ width: `${(expiresMins / 30) * 100}%` }}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      disabled={isExpired}
                      onClick={() => {
                        setSelectedTx(item);
                        setActionType("reject");
                      }}
                      className="flex-1 border border-red-500/50 text-red-400 hover:bg-red-950/30 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                    <button
                      disabled={isExpired}
                      onClick={() => {
                        setSelectedTx(item);
                        setActionType("approve");
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTx && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-slate-100 capitalize">
              {actionType} Payment
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to {actionType} ${selectedTx.amountUsd} for{" "}
              <strong>{selectedTx.merchantDomain}</strong>?
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedTx(null);
                  setActionType(null);
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleAction}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white flex items-center gap-2 ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm {actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}