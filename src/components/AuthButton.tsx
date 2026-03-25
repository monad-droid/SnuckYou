"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-auth";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
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
    setSigningIn(true);
    try {
      // Race against a 5s timeout so the button doesn't hang forever
      const oauthPromise = supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: "Sign-in timed out" } }), 5000)
      );
      const { data, error } = await Promise.race([oauthPromise, timeoutPromise]);

      if (error) {
        console.error("Sign-in error:", error.message);
        setSigningIn(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      // No URL returned — something went wrong silently
      setSigningIn(false);
    } catch {
      setSigningIn(false);
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
        disabled={signingIn}
        className="text-sm font-medium text-emerald-800 hover:text-emerald-900 border border-emerald-800/30 rounded-full px-4 py-1.5 transition-colors duration-200 disabled:opacity-50"
      >
        {signingIn ? "Signing in…" : "Sign in"}
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
