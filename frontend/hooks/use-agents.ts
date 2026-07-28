import useSWR, { mutate } from "swr";
import { apiGet, apiSend } from "../lib/api-client";
import toast from "react-hot-toast";

export function useAgents(params?: { status?: string; search?: string }) {
  const { data, error, isLoading, mutate: refresh } = useSWR(
    ["agents", params],
    ([, p]) => apiGet<any>("/agents", p)
  );
  return { agents: data, isLoading, error, refresh };
}

export const agentsApi = {
  create: async (body: any) => {
    await apiSend("post", "/agents", body);
    toast.success("Agent created successfully");
    mutate((key) => Array.isArray(key) && key[0] === "agents");
  },
  update: async (id: string, body: any) => {
    await apiSend("put", `/agents/${id}`, body);
    toast.success("Agent updated successfully");
    mutate((key) => Array.isArray(key) && key[0] === "agents");
  },
  remove: async (id: string) => {
    await apiSend("delete", `/agents/${id}`);
    toast.success("Agent deleted successfully");
    mutate((key) => Array.isArray(key) && key[0] === "agents");
  },
  toggleKillSwitch: async (id: string, active: boolean) => {
    await apiSend("patch", `/agents/${id}/kill-switch`, { active });
    toast.success(`Agent kill switch turned ${active ? "ON" : "OFF"}`);
    mutate((key) => Array.isArray(key) && key[0] === "agents");
  },
  listKeys: async (id: string) => {
    return await apiGet<any>(`/agents/${id}/api-keys`);
  },
  createKey: async (id: string, body: { name: string }) => {
    const data = await apiSend<any>("post", `/agents/${id}/api-keys`, body);
    toast.success("API key generated");
    return data;
  },
  revokeKey: async (id: string, keyId: string) => {
    await apiSend("delete", `/agents/${id}/api-keys/${keyId}`);
    toast.success("API key revoked");
  },
};