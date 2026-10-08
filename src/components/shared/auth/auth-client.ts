"use client";

import { createAuthClient } from "better-auth/react";

// Client SDK for the A-13 auth screens. No baseURL needed: same-origin
// requests hit /api/auth (the A-09 catch-all route handler).
export const authClient = createAuthClient();
