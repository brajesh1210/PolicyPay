import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

export function useAgentList() {
  const { data, error } = useSWR<any>("/agents", apiGet);

  return {
    agents: data?.data || data || [],
    isLoading: !data && !error,
    isError: error,
  };
}