import axios from "axios";
import { getSession } from "next-auth/react";
import toast from "react-hot-toast";
import { SuccessEnvelope } from "@policypay/contracts";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach the API token if the user is logged in
apiClient.interceptors.request.use(async (config) => {
  const session = await getSession();
  
  if (session?.apiToken) {
    config.headers.Authorization = `Bearer ${session.apiToken}`;
  }
  
  return config;
});

// Response Interceptor: Handle success envelopes and global errors
apiClient.interceptors.response.use(
  (response) => {
    // Return the response data directly so callers get the envelope
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error?.message || "An unexpected error occurred.";
    const code = error.response?.data?.error?.code || "UNKNOWN_ERROR";
    const status = error.response?.status || 500;

    // Show a generic message via toast
    toast.error(message);

    // Re-throw a normal Error carrying { code, message, status }
    throw { code, message, status };
  }
);

export default apiClient;

// Typed helpers for GET requests
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get(url, { params });
  return (response as unknown as SuccessEnvelope<T>).data;
}

// Typed helpers for POST, PUT, PATCH, DELETE requests
// Typed helpers for POST, PUT, PATCH, DELETE requests
export async function apiSend<T>(
  method: "post" | "put" | "patch" | "delete",
  url: string,
  body?: unknown
): Promise<T> {
  // Use the universal request config to satisfy TypeScript
  const response = await apiClient.request({
    method,
    url,
    data: body,
  });
  return (response as unknown as SuccessEnvelope<T>).data;
}