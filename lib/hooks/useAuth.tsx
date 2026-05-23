"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  name: string | null;
  nif: string | null;
  email: string | null;
  address: string | null;
  activity: string | null;
  epigrafe: string | null;
  tipo_iva: number;
  retencion_irpf: number;
  plan: "gratis" | "autonomo" | "creator" | "business";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  notif_fiscales: boolean;
  notif_facturas: boolean;
  notif_resumen: boolean;
  notif_tips: boolean;
  onboarding_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isDemo: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isDemo: true,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Use a ref so the client is stable across renders — avoids infinite effect loops
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch {
      // Profile fetch failed, continue without it
    }
  // supabase ref is stable — empty deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    // Safety: always resolve loading within 8 s even if Supabase hangs
    // (e.g. project paused on free tier, network timeout)
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.user) {
          setUser(currentSession.user);
          setSession(currentSession);
          await fetchProfile(currentSession.user.id);
        }
      } catch {
        // Auth init failed
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        if (event === "SIGNED_OUT") {
          setProfile(null);
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  // supabase is stable (useRef) — only fetchProfile matters for re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Clear demo cookie
    document.cookie = "kuentas_demo=; path=/; max-age=0";
    window.location.href = "/";
  }, [supabase]);

  const isDemo = !user && !loading;

  return (
    <AuthContext.Provider
      value={{ user, session, profile, isDemo, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
