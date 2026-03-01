"use server";

import { revalidatePath } from "next/cache";
import {
  updateRSSItem,
  deleteRSSItem,
  resetRSSItemFromFeed,
} from "@/lib/actions/rss";
import type { DBRSSItem, ActionResult } from "@/types/database";

export async function updateVideoRSSItem(
  id: string,
  input: {
    title?: string;
    excerpt?: string | null;
    thumbnail_url?: string | null;
    hidden_by_admin?: boolean;
  }
): Promise<ActionResult<DBRSSItem>> {
  const result = await updateRSSItem(id, input);
  if (!result.error) {
    revalidatePath("/videos");
    revalidatePath("/");
  }
  return result;
}

export async function deleteVideoRSSItem(
  id: string
): Promise<ActionResult<void>> {
  const result = await deleteRSSItem(id);
  if (!result.error) {
    revalidatePath("/videos");
    revalidatePath("/");
  }
  return result;
}

export async function resetVideoRSSItemFromFeed(
  id: string
): Promise<ActionResult<DBRSSItem>> {
  const result = await resetRSSItemFromFeed(id);
  if (!result.error) {
    revalidatePath("/videos");
    revalidatePath("/");
  }
  return result;
}
