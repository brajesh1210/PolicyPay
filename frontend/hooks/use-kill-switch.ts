import useSWR, { mutate } from "swr";
import { apiGet, apiSend } from "../lib/api-client";
import toast from "react-hot-toast";

export function useKillSwitch() {
  const { data, error, isLoading, mutate: refresh } = useSWR(
    "kill-switch",
    () => apiGet<any>("/kill-switch")
  );
  return { active: data?.active, isLoading, error, refresh };
}

export const killSwitchApi = {
  set: async (active: boolean) => {
    await apiSend("patch", "/kill-switch", { active });
    toast.success(`Global kill switch is now ${active ? "ACTIVE" : "OFF"}`);
    mutate("kill-switch");
  },
};