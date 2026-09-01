"use client";

/**
 * Records a reading-history entry when the user opens an item page.
 *
 * Renders nothing — drop it into an item page and it fires one beacon on
 * mount:
 *
 *   <TrackItemView itemId={item.id} />
 *
 * Three layers of debounce, cheapest first, because the naive version of this
 * component fires on every render, every back-navigation, and every Strict
 * Mode double-mount:
 *
 *   1. A ref, so a remount within the same mounted tree sends at most one
 *      request. This is what absorbs React Strict Mode's double effect in
 *      development.
 *   2. sessionStorage, so returning to the same item via the back button or a
 *      soft navigation does not re-send within the window. Keeps the request
 *      off the wire entirely rather than relying on the server to reject it.
 *   3. The server's own VIEW_DEBOUNCE_MS check in recordItemView, which is the
 *      real guarantee — the two client layers are optimizations and can be
 *      defeated by a hard refresh or a second tab.
 *
 * Anonymous visitors are handled by the endpoint, which returns
 * `tracked: false` rather than 401, so this component does not need to know
 * whether anyone is signed in.
 */

import { useEffect, useRef } from "react";
import { VIEW_DEBOUNCE_MS } from "@/lib/actions/libraryValidation";

interface TrackItemViewProps {
  itemId: string;
  /**
   * Delay before the beacon fires. A view that ends before this has elapsed is
   * a bounce, not a read, so waiting keeps mis-clicks out of the history.
   */
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 2_000;
const STORAGE_PREFIX = "hs:viewed:";

/**
 * Has this item been beaconed recently in this tab?
 *
 * sessionStorage access is wrapped because it throws in private-mode Safari and
 * when storage is disabled. A failure here means "not seen recently", which
 * falls through to sending the beacon — the server debounce still holds, so the
 * cost of a storage failure is one redundant request, not a duplicate entry.
 */
function seenRecently(itemId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${itemId}`);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    return Number.isFinite(at) && Date.now() - at < VIEW_DEBOUNCE_MS;
  } catch {
    return false;
  }
}

function markSeen(itemId: string): void {
  try {
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${itemId}`,
      String(Date.now())
    );
  } catch {
    // Storage unavailable — the server debounce covers us.
  }
}

export default function TrackItemView({
  itemId,
  delayMs = DEFAULT_DELAY_MS,
}: TrackItemViewProps) {
  // Which item this instance has already sent for. Keyed by id rather than a
  // boolean so a client-side navigation that reuses the component for a
  // different item still tracks the new one.
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (!itemId || sentFor.current === itemId) return;
    if (seenRecently(itemId)) return;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      sentFor.current = itemId;

      void fetch("/api/library/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
        signal: controller.signal,
        // Let the request outlive the page: a reader who clicks straight
        // through to the original article should still have the view recorded.
        keepalive: true,
      })
        .then((res) => {
          if (res.ok) markSeen(itemId);
          // A failed beacon is not worth surfacing to the reader; the next
          // visit will try again.
        })
        .catch(() => {
          // Aborted on unmount, or offline. Allow a retry on the next mount.
          sentFor.current = null;
        });
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [itemId, delayMs]);

  return null;
}
