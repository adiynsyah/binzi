import type { Metadata } from "next";

import { AdminNav } from "@/components/layout/AdminNav/AdminNav";

import styles from "./layout.module.scss";

/**
 * BINZI admin CMS shell (TASK 015, Blueprint §3/§4, CMS Spec §46
 * "CMS Phase 1 — admin layout + navigation").
 *
 * Presentation-only layout: sidebar (brand + section navigation)
 * and the main content area. It deliberately performs NO
 * authentication or authorization — route-level ADMIN protection
 * is owned by src/proxy.ts (TASK 014), per Blueprint §12
 * ("middleware is not the only security boundary", and this shell
 * is not a security boundary at all).
 */
export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | BINZI Admin",
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>BINZI Admin</p>
        <AdminNav />
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
