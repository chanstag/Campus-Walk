import { useEffect } from "react";
import superjson from "superjson";
import { useSession } from "@/auth-client";

type SessionData = NonNullable<ReturnType<typeof useSession>["data"]>;

const KEY = "campus-walk:session";

function read(): SessionData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? superjson.parse<SessionData>(raw) : null;
  } catch {
    return null;
  }
}

function write(data: SessionData) {
  try {
    localStorage.setItem(KEY, superjson.stringify(data));
  } catch {
    // Storage full or blocked: offline sign-in just won't be remembered.
  }
}

export function forgetSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * Better Auth's `useSession`, plus the last good session on this device when the session request
 * fails on the network, so the walk screen opens offline instead of bouncing to /login. A session
 * the server says is gone (null with no error) is still treated as signed out.
 */
export function useAppSession() {
  const result = useSession();
  useEffect(() => {
    if (result.data) write(result.data);
  }, [result.data]);
  if (!result.data && result.error && !result.isPending) {
    const cached = read();
    if (cached) return { ...result, data: cached };
  }
  return result;
}
