"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { apiGet, apiList, type Meta } from "./api";
import type { Alert, Approval } from "./types";

/** Fetches once the session is ready. Returns { data, loading, error, reload }. */
export function useApi<T>(
  path: string | null,
  params?: Record<string, unknown>,
  deps: unknown[] = []
) {
  const { status } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    if (status !== "authenticated" || !path) {
      if (status === "unauthenticated") setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet<T>(path, params)
      .then((d) => {
        if (!cancelled && alive.current) setData(d);
      })
      .catch((e: any) => {
        if (!cancelled && alive.current) setError(e?.message || "Request failed");
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, path, key, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** Same as useApi but keeps the `meta` block for pagination. */
export function useApiList<T>(
  path: string | null,
  params?: Record<string, unknown>
) {
  const { status } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<Meta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    if (status !== "authenticated" || !path) {
      if (status === "unauthenticated") setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiList<T>(path, params)
      .then((r) => {
        if (cancelled) return;
        setData(r.data);
        setMeta(r.meta);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, path, key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, meta, loading, error, reload };
}

/** Sidebar badge counts: pending approvals + unread alerts. */
export function useCounts() {
  const { status } = useSession();
  const [counts, setCounts] = useState({ approvals: 0, alerts: 0 });

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      try {
        const [ap, al] = await Promise.all([
          apiGet<Approval[]>("/v1/approvals").catch(() => [] as Approval[]),
          apiGet<Alert[]>("/v1/alerts").catch(() => [] as Alert[]),
        ]);
        if (cancelled) return;
        setCounts({
          approvals: (Array.isArray(ap) ? ap : []).filter(
            (a) => a.status === "PENDING"
          ).length,
          alerts: (Array.isArray(al) ? al : []).filter(
            (a) => !a.isRead && !a.isDismissed
          ).length,
        });
      } catch {
        /* badges are cosmetic — silence */
      }
    }

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  return counts;
}
