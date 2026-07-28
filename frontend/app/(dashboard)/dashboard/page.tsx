"use client";

import React from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { StatusBadge } from "@/components/features/status-badge";
import { RiskBadge } from "@/components/features/risk-badge";
import { AmountFormatter } from "@/components/features/amount-formatter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer as RechartsResponsiveContainer,
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  Tooltip as RechartsTooltip,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell as RechartsCell,
} from "recharts";

const ResponsiveContainer = RechartsResponsiveContainer as any;
const LineChart = RechartsLineChart as any;
const Line = RechartsLine as any;
const XAxis = RechartsXAxis as any;
const YAxis = RechartsYAxis as any;
const Tooltip = RechartsTooltip as any;
const PieChart = RechartsPieChart as any;
const Pie = RechartsPie as any;
const Cell = RechartsCell as any;

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#64748b"];

export default function DashboardPage() {
  const { overview, trends, distribution, recent, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Loading dashboard data...
      </div>
    );
  }

  // 1. Overview stats
  const stats = overview?.data || overview || {};

  // 2. Spending Trends array extraction
  const rawTrends = trends?.data?.trends || trends?.trends || trends?.data || trends;
  const trendData = Array.isArray(rawTrends)
    ? rawTrends.map((item: any) => ({
        date: item.date || item.day || item.timestamp || "N/A",
        amount: Number(item.amount ?? item.amountUsd ?? 0),
      }))
    : [];

  // 3. Status Distribution conversion ({ allow: 14, deny: 5, require_approval: 1 })
  const distObj = distribution?.data || distribution || {};
  const distData = [
    { status: "ALLOW", count: distObj.allow ?? 0 },
    { status: "DENY", count: distObj.deny ?? 0 },
    { status: "REQUIRE APPROVAL", count: distObj.require_approval ?? 0 },
  ].filter((item) => item.count > 0);

  // 4. Recent Transactions array extraction
  const rawRecent = recent?.data?.transactions || recent?.transactions || recent?.data || recent;
  const recentTx = Array.isArray(rawRecent) ? rawRecent : [];

  const totalSpend = stats.total_spend_today ?? stats.totalAmountUsd ?? stats.totalVolume ?? 0;
  const pendingApprovals = stats.pending_approvals ?? stats.totalTransactions ?? 0;
  const activeAgents = stats.active_agents ?? 0;
  const blockedToday = stats.blocked_today ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-slate-400">Real-time spending metrics and decision analytics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Spend Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AmountFormatter amount={totalSpend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Blocked Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Spending Trends (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Decision Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                  >
                    {distData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 px-3">Transaction ID</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentTx.map((tx: any) => (
                  <tr key={tx.id || tx.transactionId || tx.transaction_id}>
                    <td className="py-3 px-3 font-mono text-xs">
                      {tx.id || tx.transactionId || tx.transaction_id}
                    </td>
                    <td className="py-3 px-3">
                      <AmountFormatter amount={tx.amountUsd ?? tx.amount_usd ?? tx.amount ?? 0} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={tx.decision || tx.status} />
                    </td>
                    <td className="py-3 px-3">
                      <RiskBadge score={tx.riskScore ?? tx.risk_score ?? 0} />
                    </td>
                  </tr>
                ))}
                {recentTx.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No recent transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}