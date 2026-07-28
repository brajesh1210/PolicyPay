import useSWR from "swr";
import { apiGet, apiSend } from "@/lib/api-client";

export function useAlerts(severity?: string) {
  const url = severity && severity !== "ALL"
    ? `/alerts?is_dismissed=false&severity=${severity}`
    : `/alerts?is_dismissed=false`;

  const { data, error, isLoading, mutate } = useSWR<any>(url, apiGet, {
    refreshInterval: 10000,
  });

  const raw = data?.data?.alerts || data?.alerts || data?.data || data || [];
  const alerts = Array.isArray(raw) ? raw : [];

  return { alerts, isLoading, error, refresh: mutate };
}

export const alertsApi = {
  async markRead(id: string) {
    return await apiSend("patch", `/alerts/${id}/read`);
  },
  async dismiss(id: string) {
    return await apiSend("patch", `/alerts/${id}/dismiss`);
  },
};