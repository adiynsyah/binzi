"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "./auth/auth-client";
import { unknownNotice } from "./auth/auth-errors";

/*
 * Shared Keluar handler for the account dropdown and the account drawer
 * (card A-14b): on success replace to Beranda + refresh so the guest
 * header renders; on failure the menu stays open and shows the ONE
 * generic notice from auth-errors.ts (no new copy).
 *
 * While the request is in flight `pending` is true — callers lock their
 * items with it (TOKENS: loading keeps controls locked).
 */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setPending(true);
    setError(null);
    const { error: signOutError } = await authClient.signOut();
    setPending(false);
    if (signOutError) {
      setError(unknownNotice().message);
      return;
    }
    router.replace("/");
    router.refresh();
  }, [router]);

  return { pending, error, signOut };
}
