/*
 * Single re-export of the resolver used by the CMS form dialogs.
 *
 * Workaround for a TypeScript 5.9.1 bundler-resolution quirk: when this
 * specifier is resolved fresh from a .tsx file in this directory, the
 * lookup goes down an @types-style path ('hookform-resolvers__standard-
 * schema') and never consults the package exports (TS2307), while the
 * same import from a plain .ts module resolves correctly. Every CMS form
 * that needs the resolver imports it from here instead.
 */
export { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
