"use client";

// RevokeAllSessionsButton (card S5-05 §5.4, 9e "Keluar dari semua
// perangkat"): authClient.revokeSessions() — every session INCLUDING this
// device — then signOut() purely to clear the cookie (its error is
// ignored: the sessions are already gone, so a failing signOut must not
// turn the flow into a dead end), then /masuk. A revoke failure keeps the
// user on the page with the one generic banner — no navigation.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { authClient } from "@/components/shared/auth/auth-client";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

const FAILED_COPY = "Terjadi kesalahan. Coba lagi.";

export function RevokeAllSessionsButton() {
  const router = useRouter();
  // Handler-level guard on top of the disabled attribute (7 Nov lesson 6).
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleRevoke() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    const { error } = await authClient.revokeSessions();
    if (error) {
      setFailed(true);
      setBusy(false);
      inFlight.current = false;
      return;
    }
    await authClient.signOut();
    router.replace("/masuk");
    router.refresh();
  }

  return (
    <div className="w-full">
      <Button
        variant="secondary"
        className="w-full sm:w-auto"
        loading={busy}
        loadingLabel="Mengeluarkan…"
        onClick={handleRevoke}
      >
        Keluar dari semua perangkat
      </Button>
      {failed ? (
        <div className="mt-3">
          <Banner tone="error" title={FAILED_COPY} />
        </div>
      ) : null}
    </div>
  );
}
