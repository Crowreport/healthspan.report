/**
 * Shared request validation for the /api/library routes.
 *
 * Not a server action — plain helpers, so both route handlers and any future
 * client code can use them without a network hop.
 */

/** Max folders per user — a guard against runaway automated creation. */
export const MAX_FOLDERS_PER_USER = 200;

/** Default and maximum page size for listing saved items. */
export const SAVED_ITEMS_DEFAULT_LIMIT = 50;
export const SAVED_ITEMS_MAX_LIMIT = 100;

export const FOLDER_NAME_MAX_LENGTH = 100;

/** Postgres unique-violation code, raised by the per-user folder name index. */
export const UNIQUE_VIOLATION = "23505";
/** Postgres foreign-key violation, raised when item_id/folder_id doesn't exist. */
export const FOREIGN_KEY_VIOLATION = "23503";

/** Matches a canonical UUID; ids reaching the database should look like this. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Read a `folder_id` from a request body.
 *
 * Three distinct outcomes, because `null` and "absent" mean different things:
 * an explicit `null` files an item as unfiled, while omitting the key leaves
 * the current folder alone.
 */
export function parseFolderId(
  raw: unknown
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (!isUuid(raw)) {
    return { ok: false, error: "folder_id must be a UUID or null" };
  }
  return { ok: true, value: raw };
}
