import { createBrowserClient as createBrowser } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowser> | null = null;

export function createBrowserClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    // Return a minimal stub during SSR/build when env vars aren't available
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOAuth: () => Promise.resolve({ data: null, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as unknown as ReturnType<typeof createBrowser>;
  }

  _client = createBrowser(url, key);
  return _client;
}
