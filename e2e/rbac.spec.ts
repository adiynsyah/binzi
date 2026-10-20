// RBAC on pages & API (V-04, Q42, Q43) — card A-19 §4f.
//
// The expectation table below is WRITTEN EXPLICITLY from the PRD (§3.2/§7.2,
// v1.5) — it is deliberately NOT derived from ROUTE_RULES or cms-nav.ts: an
// oracle that changes together with the code catches nothing. Page statuses
// are read with cookie-carrying API requests that do NOT follow redirects.
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { expect, test } from "./fixtures";
import {
  createRoleAccount,
  newCollectedContext,
  setRoleViaScript,
  signInViaApi,
  type UserRole,
} from "./fixtures";

const E2E = "http://localhost:3100";
const CMS_NAV_MARKER = 'aria-label="Menu CMS"';

/** "/cms/pengguna" → "/masuk?next=%2Fcms%2Fpengguna" (guest redirect). */
function guestRedirect(path: string): string {
  return `/masuk?next=${encodeURIComponent(path)}`;
}

// statusses: 200 | 403 (literal per PRD row). /belajar is MEMBER+.
const PAGE_EXPECTATIONS: readonly {
  path: string;
  member: number;
  editor: number;
  admin: number;
  superAdmin: number;
}[] = [
  // EDITOR+ workbench
  { path: "/cms", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  { path: "/cms/konten", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  { path: "/cms/artikel", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  { path: "/cms/kursus", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  { path: "/cms/quiz", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  { path: "/cms/media", member: 403, editor: 200, admin: 200, superAdmin: 200 },
  // ADMIN+
  { path: "/cms/kategori", member: 403, editor: 403, admin: 200, superAdmin: 200 },
  { path: "/cms/pengguna", member: 403, editor: 403, admin: 200, superAdmin: 200 },
  { path: "/cms/reset-attempt", member: 403, editor: 403, admin: 200, superAdmin: 200 },
  // SUPER_ADMIN only
  { path: "/cms/pengaturan", member: 403, editor: 403, admin: 403, superAdmin: 200 },
  { path: "/cms/audit-log", member: 403, editor: 403, admin: 403, superAdmin: 200 },
  // MEMBER+ area
  { path: "/belajar", member: 200, editor: 200, admin: 200, superAdmin: 200 },
];

// ---------------------------------------------------------------- helpers

/** Location header normalized to path+search (handles absolute forms). */
function locationPath(response: {
  headers(): Record<string, string>;
}): string | null {
  const raw = response.headers()["location"];
  if (!raw) return null;
  try {
    const url = new URL(raw, E2E);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

/** Every page.tsx route under src/app/(cms) — the coverage oracle. */
function listCmsPages(): string[] {
  // process.cwd() — import.meta is unavailable in Playwright's CJS worker
  // transform (see the note in mail-log.ts).
  const root = resolve(process.cwd(), "src/app/(cms)/cms");
  const paths: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        paths.push(prefix);
      }
    }
  };
  walk(root, "/cms");
  return paths.sort();
}

// ------------------------------------------------------------------ tests

test.describe("cakupan tabel RBAC", () => {
  test("every CMS page.tsx has a row in the expectation table", () => {
    // A new CMS page without an expectation row turns this red — the table
    // can never silently drift from the actual routes (card §4f). /belajar
    // is asserted separately (it is not a CMS page).
    const expectedCms = PAGE_EXPECTATIONS.map((row) => row.path)
      .filter((path) => path.startsWith("/cms"))
      .sort();
    expect(expectedCms).toEqual(listCmsPages());
    expect(PAGE_EXPECTATIONS.map((row) => row.path)).toContain("/belajar");
  });
});

test.describe("tamu (proxy redirect)", () => {
  test("every protected page redirects to /masuk?next=<path+query>", async ({
    request,
  }) => {
    for (const row of PAGE_EXPECTATIONS) {
      const response = await request.get(row.path, { maxRedirects: 0 });
      expect(
        response.status(),
        `${row.path} guest status (proxy redirect)`,
      ).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      expect(locationPath(response), `${row.path} guest Location`).toBe(
        guestRedirect(row.path),
      );
    }
  });

  test("/cms/tidak-ada redirects too", async ({ request }) => {
    const response = await request.get("/cms/tidak-ada", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(locationPath(response)).toBe(guestRedirect("/cms/tidak-ada"));
  });
});

test.describe("status per peran", () => {
  const roles: {
    role: UserRole;
    key: "member" | "editor" | "admin" | "superAdmin";
  }[] = [
    { role: "MEMBER", key: "member" },
    { role: "EDITOR", key: "editor" },
    { role: "ADMIN", key: "admin" },
    { role: "SUPER_ADMIN", key: "superAdmin" },
  ];

  for (const { role, key } of roles) {
    test(`${role}: HTTP status per page (and 403 bodies say “Akses ditolak”)`, async ({
      browser,
      request,
    }) => {
      const account = await createRoleAccount(request, role);
      const { context } = await newCollectedContext(browser);
      await signInViaApi(context, account);
      try {
        for (const row of PAGE_EXPECTATIONS) {
          const response = await context.request.get(row.path, {
            maxRedirects: 0,
          });
          expect(
            response.status(),
            `${role} ${row.path}`,
          ).toBe(row[key]);
          if (row[key] === 403) {
            expect(
              await response.text(),
              `${role} ${row.path} 403 body`,
            ).toContain("Akses ditolak");
          }
        }
      } finally {
        await context.close();
      }
    });
  }

  test("/cms/tidak-ada: never 200, never CMS content — per role", async ({
    browser,
    request,
  }) => {
    for (const role of ["MEMBER", "EDITOR", "ADMIN", "SUPER_ADMIN"] as const) {
      const account = await createRoleAccount(request, role);
      const { context } = await newCollectedContext(browser);
      await signInViaApi(context, account);
      try {
        const response = await context.request.get("/cms/tidak-ada", {
          maxRedirects: 0,
        });
        // Property under test: never 200 and no CMS shell — the exact
        // status per role is recorded in the PR (session note).
        console.log(`[rbac] /cms/tidak-ada as ${role}: ${response.status()}`);
        expect(response.status(), `${role} /cms/tidak-ada`).not.toBe(200);
        expect(await response.text(), `${role} /cms/tidak-ada body`).not.toContain(
          CMS_NAV_MARKER,
        );
      } finally {
        await context.close();
      }
    }
  });
});

test.describe("menu CMS di 1280 (Q43)", () => {
  for (const role of ["EDITOR", "ADMIN", "SUPER_ADMIN"] as const) {
    test(`${role}: every visible menu link opens 200`, async ({
      page,
      request,
    }) => {
      const account = await createRoleAccount(request, role);
      await signInViaApi(page.context(), account);
      await page.goto("/cms");
      await expect(page.locator('nav[aria-label="Menu CMS"] a').first()).toBeVisible();

      // Two "Menu CMS" navs exist in the DOM (sidebar AND rail — one is
      // visually hidden), so read ALL of their texts/links, not a strict
      // single match.
      const menuTexts = await page
        .locator('nav[aria-label="Menu CMS"]')
        .allInnerTexts();
      const menuText = menuTexts.join("\n");

      const links = page.locator('nav[aria-label="Menu CMS"] a');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
      const hrefs = new Set<string>();
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute("href");
        expect(href, `${role} menu link #${i}`).toBeTruthy();
        hrefs.add(href as string);
      }
      for (const href of hrefs) {
        const response = await page.request.get(href, { maxRedirects: 0 });
        expect(response.status(), `${role} menu link ${href}`).toBe(200);
      }

      if (role === "ADMIN") {
        // Q43: ADMIN must not see the SUPER_ADMIN items in the menu (their
        // labels are "Audit log" and "Sistem" — cms-nav.ts).
        expect(menuText).not.toContain("Audit log");
        expect(menuText).not.toContain("Sistem");
      }
      if (role === "SUPER_ADMIN") {
        expect(menuText).toContain("Audit log");
        expect(menuText).toContain("Sistem");
      }
    });
  }
});

test.describe("API RBAC", () => {
  test("GET /api/cms/ping: guest 401 JSON, MEMBER 403 JSON, EDITOR 200", async ({
    browser,
    request,
  }) => {
    const guest = await request.get("/api/cms/ping");
    expect(guest.status()).toBe(401);
    expect(guest.headers()["content-type"]).toContain("application/json");

    const member = await createRoleAccount(request, "MEMBER");
    const { context: memberContext } = await newCollectedContext(browser);
    await signInViaApi(memberContext, member);
    const memberResponse = await memberContext.request.get("/api/cms/ping");
    expect(memberResponse.status()).toBe(403);
    expect(memberResponse.headers()["content-type"]).toContain("application/json");
    await memberContext.close();

    const editor = await createRoleAccount(request, "EDITOR");
    const { context: editorContext } = await newCollectedContext(browser);
    await signInViaApi(editorContext, editor);
    const editorResponse = await editorContext.request.get("/api/cms/ping");
    expect(editorResponse.status()).toBe(200);
    expect(await editorResponse.json()).toEqual({ data: { message: "pong" } });
    await editorContext.close();
  });

  test("role changed mid-session → next request with the old cookie is signed out", async ({
    browser,
    request,
  }) => {
    const account = await createRoleAccount(request, "EDITOR");
    const { context } = await newCollectedContext(browser);
    await signInViaApi(context, account);

    const before = await context.request.get("/cms", { maxRedirects: 0 });
    expect(before.status()).toBe(200);

    // set-role revokes every session in the same transaction (A-12).
    setRoleViaScript(account.email, "MEMBER");

    const after = await context.request.get("/cms", { maxRedirects: 0 });
    expect(after.status()).toBeGreaterThanOrEqual(300);
    expect(after.status()).toBeLessThan(400);
    expect(locationPath(after)).toBe(guestRedirect("/cms"));
    await context.close();
  });
});
