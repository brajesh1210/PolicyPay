import useSWR, { mutate } from "swr";
import { apiGet, apiSend } from "../lib/api-client";
import toast from "react-hot-toast";

export function usePolicies() {
  const { data, error, isLoading, mutate: refresh } = useSWR(
    "policies",
    () => apiGet<any>("/policies")
  );
  return { policies: data, isLoading, error, refresh };
}

export function useTemplates() {
  const { data, error, isLoading } = useSWR(
    "policies/templates",
    () => apiGet<any>("/policies/templates")
  );
  return { templates: data, isLoading, error };
}

export const policiesApi = {
  create: async (body: any) => {
    await apiSend("post", "/policies", body);
    toast.success("Policy created successfully");
    mutate("policies");
  },
  createFromTemplate: async (body: { template: string; name: string }) => {
    await apiSend("post", "/policies/from-template", body);
    toast.success("Policy created from template");
    mutate("policies");
  },
  update: async (id: string, body: any) => {
    await apiSend("put", `/policies/${id}`, body);
    toast.success("Policy updated successfully");
    mutate("policies");
  },
  toggle: async (id: string) => {
    await apiSend("patch", `/policies/${id}/toggle`);
    toast.success("Policy status toggled");
    mutate("policies");
  },
  remove: async (id: string) => {
    await apiSend("delete", `/policies/${id}`);
    toast.success("Policy deleted successfully");
    mutate("policies");
  },
};