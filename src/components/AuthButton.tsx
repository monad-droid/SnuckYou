"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-auth";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    // Race getUser against a 3s timeout so the button is always usable
    const timeout = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 3000)
    );
    Promise.race([supabase.auth.getUser(), timeout])
      .then((res) => {
        setUser(res.data.user);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // If Supabase returns a URL instead of auto-redirecting, navigate manually
    if (!error && data?.url) {
      window.location.href = data.url;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading || !user) {
    return (
      <button
        onClick={signIn}
        className="text-sm font-medium text-emerald-800 hover:text-emerald-900 border border-emerald-800/30 rounded-full px-4 py-1.5 transition-colors duration-200"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.user_metadata?.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.user_metadata.avatar_url}
          alt=""
          className="w-7 h-7 rounded-full"
        />
      )}
      <button
        onClick={signOut}
        className="text-xs font-medium text-emerald-800/60 hover:text-emerald-900 transition-colors duration-200"
      >
        Sign out
      </button>
    </div>
  );
}
