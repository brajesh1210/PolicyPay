import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

export function useAnalytics() {
  const { data: overview, error: errorOverview, mutate: mutateOverview } = useSWR<any>(
    "/analytics/overview",
    apiGet,
    { refreshInterval: 5000 }
  );

  const { data: trends, error: errorTrends } = useSWR<any>(
    "/analytics/spending-trends?days=7",
    apiGet
  );

  const { data: distribution, error: errorDistribution } = useSWR<any>(
    "/analytics/status-distribution",
    apiGet
  );

  const { data: recent, error: errorRecent } = useSWR<any>(
    "/analytics/recent-transactions?limit=5",
    apiGet
  );

  return {
    overview,
    trends,
    distribution,
    recent,
    isLoading: !overview && !errorOverview,
    isError: errorOverview || errorTrends || errorDistribution || errorRecent,
    mutateOverview,
  };
}