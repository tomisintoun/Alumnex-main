"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
export type Item = Record<string, any>;
type Session = { user: Item | null; csrf: string; demo: boolean };
type Context = Session & {
  api: (path: string, method?: string, body?: unknown) => Promise<any>;
  refresh: () => Promise<void>;
  toast: (message: string) => void;
};
const C = createContext<Context | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error("Missing application context");
  return c;
};
export function Provider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session>({
      user: null,
      csrf: "",
      demo: false,
    }),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(""),
    [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const r = await fetch("/api/session", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("Unable to reach your network.");
    const s = await r.json();
    setSession(s);
    if (!s.user) router.replace("/login");
  }, [router]);
  useEffect(() => {
    refresh()
      .catch((e) => setFailure(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);
  const api = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const r = await fetch("/api/" + path, {
        method,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : { "X-CSRF-Token": session.csrf }),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          router.replace("/login");
          setSession((s) => ({ ...s, user: null }));
        }
        throw new Error(d.error || "The request could not be completed.");
      }
      return d;
    },
    [session.csrf, router],
  );
  if (loading)
    return (
      <main className="session-loading">
        <span className="brand">ALUMNEX</span>
        <div className="spinner" />
        <p>Connecting you to your ABUAD network…</p>
      </main>
    );
  if (failure)
    return (
      <main className="document-page">
        <h1>We couldn’t reach your network.</h1>
        <p>{failure}</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  if (!session.user)
    return (
      <main className="session-loading">
        <p>Taking you to sign in…</p>
      </main>
    );
  return (
    <C.Provider value={{ ...session, api, refresh, toast: setMessage }}>
      {children}
      {message ? (
        <div className="toast" role="status">
          {message}
        </div>
      ) : null}
    </C.Provider>
  );
}
export function useData(endpoint: string | null) {
  const { api } = useApp();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const loadedFor = useRef("");
  useEffect(() => {
    let live = true;
    if (!endpoint) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(loadedFor.current !== endpoint);
    setError("");
    api(endpoint)
      .then((d) => {
        if (live) {
          loadedFor.current = endpoint;
          setData(d);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [endpoint, api, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
