import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

export function useAuditLogs() {
  const { data, error, mutate } = useSWR<any>("/audit-logs", apiGet);

  return {
    logs: data?.data || data || [],
    isLoading: !data && !error,
    isError: error,
    mutate,
  };
}