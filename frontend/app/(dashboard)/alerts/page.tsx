"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { useAlerts, alertsApi } from "@/hooks/use-alerts";
import { EmptyState } from "@/components/features/shared/empty-state";
import { AlertTriangle, ShieldAlert, Bell, X, Loader2 } from "lucide-react";

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const { alerts = [], isLoading, refresh } = useAlerts(severityFilter ? { severity: severityFilter } : undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await alertsApi.dismiss(id);
    refresh();
  };

  const handleRead = async (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    await alertsApi.markRead(id);
    refresh();
  };

  return (
    <div className="space-y-6 p-6">
      <TopBar title="Alerts" />

      {/* Filter Pills */}
      <div className="flex gap-2">
        {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
          const isActive = sev === "ALL" ? !severityFilter : severityFilter === sev;
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev === "ALL" ? undefined : sev)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {sev}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-12 w-12 text-slate-500" />}
          title="No alerts"
          description="Alerts appear here when a payment is blocked or a budget runs low."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: any) => {
            const sev = alert.severity?.toUpperCase() || "LOW";
            const isExpanded = expandedId === alert.id;

            return (
              <div
                key={alert.id}
                onClick={() => handleRead(alert.id)}
                className={`bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 cursor-pointer transition space-y-3`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-slate-900 mt-0.5">
                      {sev === "HIGH" ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : sev === "MEDIUM" ? (
                        <ShieldAlert className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Bell className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm">
                          {alert.title}
                        </span>
                        {!alert.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                      <span className="text-[10px] text-slate-500 mt-2 block">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        sev === "HIGH"
                          ? "bg-red-950 text-red-400 border border-red-900"
                          : sev === "MEDIUM"
                          ? "bg-amber-950 text-amber-400 border border-amber-900"
                          : "bg-blue-950 text-blue-400 border border-blue-900"
                      }`}
                    >
                      {sev}
                    </span>
                    <button
                      onClick={(e) => handleDismiss(e, alert.id)}
                      className="p-1 text-slate-500 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                    <p>
                      <span className="font-semibold">Type:</span>{" "}
                      <code className="bg-slate-900 px-1.5 py-0.5 rounded">
                        {alert.type}
                      </code>
                    </p>
                    {alert.agentId && (
                      <p>
                        <span className="font-semibold">Agent ID:</span> {alert.agentId}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}