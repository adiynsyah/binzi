/*
 * Shared setup for jsdom component tests (card A-05). Every *.test.tsx
 * in this folder starts with the docblock `// @vitest-environment jsdom`
 * and imports this file. vitest.config.ts stays node-default (no
 * setupFiles, no globals) — non-UI tests keep the fast node environment.
 *
 * - React 19 needs IS_REACT_ACT_ENVIRONMENT for act() compatibility.
 * - RTL's auto-cleanup only registers itself when `afterEach` exists as a
 *   global; vitest runs without globals here, so cleanup is wired by hand.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
