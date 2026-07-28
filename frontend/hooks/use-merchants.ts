import useSWR, { mutate } from "swr";
import { apiGet, apiSend } from "../lib/api-client";
import toast from "react-hot-toast";

export function useMerchants(params?: { reputation?: string; search?: string }) {
  const { data, error, isLoading, mutate: refresh } = useSWR(
    ["merchants", params],
    ([, p]) => apiGet<any>("/merchants", p)
  );
  return { merchants: data, isLoading, error, refresh };
}

export const merchantsApi = {
  create: async (body: any) => {
    await apiSend("post", "/merchants", body);
    toast.success("Merchant added successfully");
    mutate((key) => Array.isArray(key) && key[0] === "merchants");
  },
  setReputation: async (id: string, reputation: string) => {
    await apiSend("patch", `/merchants/${id}/reputation`, { reputation });
    toast.success("Merchant reputation updated");
    mutate((key) => Array.isArray(key) && key[0] === "merchants");
  },
  remove: async (id: string) => {
    await apiSend("delete", `/merchants/${id}`);
    toast.success("Merchant deleted successfully");
    mutate((key) => Array.isArray(key) && key[0] === "merchants");
  },
};