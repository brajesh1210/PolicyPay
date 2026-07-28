import useSWR from "swr";
import { apiGet, apiSend } from "@/lib/api-client";

export function useApprovals() {
  const { data, error, isLoading, mutate } = useSWR<any>(
    "/approvals?status=PENDING",
    apiGet,
    { refreshInterval: 5000 }
  );

  const raw = data?.data?.approvals || data?.approvals || data?.data || data || [];
  const approvals = Array.isArray(raw) ? raw : [];

  return {
    approvals,
    isLoading: isLoading || (!data && !error),
    isError: error,
    refresh: mutate,
  };
}

export const approvalsApi = {
  async approve(id: string, note?: string) {
    return await apiSend("post", `/approvals/${id}/approve`, { note });
  },
  async reject(id: string, note?: string) {
    return await apiSend("post", `/approvals/${id}/reject`, { note });
  },
};