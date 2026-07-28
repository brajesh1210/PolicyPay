import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

export function useTransactions(filters: {
  decision?: string;
  agentId?: string;
  merchant?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters.decision && filters.decision !== "ALL") params.append("decision", filters.decision);
  if (filters.agentId && filters.agentId !== "ALL") params.append("agentId", filters.agentId);
  if (filters.merchant) params.append("merchant", filters.merchant);
  if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.append("dateTo", filters.dateTo);
  params.append("page", String(filters.page || 1));
  params.append("limit", String(filters.limit || 10));

  const { data, error, isLoading, mutate } = useSWR<any>(
    `/transactions?${params.toString()}`,
    apiGet
  );

  const rawTx = data?.data?.transactions || data?.transactions || data?.data || data || [];
  const transactions = Array.isArray(rawTx) ? rawTx : [];
  const meta = data?.meta || data?.data?.meta || {
    total: transactions.length,
    page: filters.page || 1,
    limit: filters.limit || 10,
  };

  return { transactions, meta, isLoading, isError: error, refresh: mutate };
}

export function useTransaction(id: string | null) {
  const { data, error, isLoading } = useSWR<any>(
    id ? `/transactions/${id}` : null,
    apiGet
  );
  return { transaction: data?.data || data, isLoading, isError: error };
}