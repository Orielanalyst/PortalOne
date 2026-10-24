/**
 * Stable, deterministic, content-addressable IDs (docs/stable-ids.md).
 *
 * Same input, same ID, on every machine, every re-run, every backfill.
 * This module has zero dependencies: sha-256 is implemented inline so the
 * same code runs in Node and in the browser bundle.
 */
/** Hex-encoded sha-256 of a UTF-8 string. */
export declare function sha256Hex(input: string): string;
/**
 * Deterministic JSON serialization: object keys sorted, undefined members
 * dropped. JSON key order in JS is insertion order, so a naive
 * JSON.stringify comparison gives false negatives; the idempotency diff
 * (scripts/idempotency-check.ts) depends on this function instead.
 */
export declare function canonicalJson(value: unknown): string;
/**
 * normalizeName per docs/stable-ids.md:
 *   NFKD normalize -> strip combining marks -> lowercase -> collapse whitespace -> trim
 *
 * Notes on the edge cases this must catch (dedupe correctness depends on it):
 * - Diacritics: "Jose Garcia" and the accented spelling must normalize identically
 *   (NFKD decomposes the accents into combining marks, which are then stripped).
 * - Non-breaking space (U+00A0): NFKD decomposes it to a regular space; the
 *   whitespace collapse then folds runs of any whitespace into one space.
 * - Zero-width characters (U+200B..U+200D, U+FEFF) carry no name content and are
 *   stripped explicitly, since NFKD leaves them alone.
 * - Over-normalization is the opposite failure: "Acme Corp" and
 *   "Acme Corporation" are DIFFERENT names and must produce DIFFERENT ids.
 *   Normalization never abbreviates, stems, or drops word characters.
 */
export declare function normalizeName(name: string): string;
/** Externally keyed entity or context: the literal grammar `type:system:externalId`. */
export declare function externalId(type: string, system: string, id: string): string;
/** Name-keyed entity: ent_<first 16 hex of sha256(`${type}:${normalizeName(name)}`)>. */
export declare function entityIdFromName(type: string, name: string): string;
/**
 * Context id.
 *
 * Ruling: docs/stable-ids.md derives context ids as hash(type + canonicalKey +
 * parent), but every shipped example references externally keyed contexts by
 * the literal `type:system:externalId` grammar (e.g. "season:gridiron:145").
 * So: externally keyed contexts use the literal grammar (the caller's external
 * id is already unique within its system, parent included by construction);
 * attr-keyed contexts (no external key) are hashed WITH the parent, which is
 * what makes week:14 under season:145 a different id than under season:144.
 */
export declare function contextIdFromAttrs(type: string, attrs: Record<string, unknown>, parent?: string): string;
/** Relationship id: hash(from + type + to + context? + validFrom?). Re-adding the same edge is a no-op. */
export declare function relationshipId(from: string, type: string, to: string, context?: string, validFrom?: string): string;
/** Fact id: content-addressed dedupe key. Asserting the identical fact twice is a no-op. */
export declare function factId(about: string, predicate: string, value: unknown, assertedAt: string, sourceKind: string, sourceUrl?: string): string;
