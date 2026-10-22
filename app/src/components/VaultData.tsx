"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "./Session";
import { createVaultClient } from "@/lib/tide/client";
import type { Item } from "@/lib/store";

export function useApiFetch() {
  const session = useSession();
  const latest = useRef(session);
  latest.current = session;
  return useCallback(async (url: string, init?: RequestInit) => {
    const token = await latest.current.getToken();
    if (!token) throw new Error("Your session has ended. Sign in again.");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return latest.current.secureFetch(new URL(url, window.location.origin).href, { ...init, headers, cache: "no-store" });
  }, []);
}

export function useVaultItems() {
  const apiFetch = useApiFetch();
  const client = useMemo(() => createVaultClient(apiFetch), [apiFetch]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await client.getItems()); }
    catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => {
    let active = true;
    client.getItems().then(items => { if (active) setItems(items); }).catch(error => { if (active) setError(errorMessage(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);
  return { items, setItems, loading, error, refresh, client, apiFetch };
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
