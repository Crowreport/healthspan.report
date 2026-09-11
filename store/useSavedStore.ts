"use client";

import { create } from "zustand";

interface SavedResponseItem {
  id: string;
  item_id: string;
}

interface SavedResponse {
  items: SavedResponseItem[];
  total: number;
}

interface SavedStore {
  savedMap: Record<string, boolean>;
  loaded: boolean;
  isFetching: boolean;
  fetchSaved: () => Promise<void>;
  toggleSave: (itemId: string) => Promise<boolean>;
  isSaved: (itemId: string) => boolean;
}

export const useSavedStore = create<SavedStore>((set, get) => ({
  savedMap: {},
  loaded: false,
  isFetching: false,

  fetchSaved: async () => {
    if (get().isFetching) return;
    set({ isFetching: true });

    try {
      const response = await fetch("/api/library/saved?limit=100");
      if (!response.ok) {
        set({ savedMap: {}, loaded: true, isFetching: false });
        return;
      }

      const payload = (await response.json()) as SavedResponse;
      const nextMap: Record<string, boolean> = {};
      for (const entry of payload.items || []) {
        if (entry.item_id) {
          nextMap[entry.item_id] = true;
        }
      }

      set({ savedMap: nextMap, loaded: true, isFetching: false });
    } catch {
      set({ loaded: true, isFetching: false });
    }
  },

  isSaved: (itemId: string) => {
    return Boolean(get().savedMap[itemId]);
  },

  toggleSave: async (itemId: string) => {
    const currentlySaved = Boolean(get().savedMap[itemId]);
    const nextState = !currentlySaved;

    // Optimistic update
    set((state) => ({
      savedMap: {
        ...state.savedMap,
        [itemId]: nextState,
      },
    }));

    try {
      const endpoint = currentlySaved ? "/api/library/unsave" : "/api/library/save";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });

      if (!response.ok) {
        // Rollback on error
        set((state) => ({
          savedMap: {
            ...state.savedMap,
            [itemId]: currentlySaved,
          },
        }));
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      // Rollback on network failure
      set((state) => ({
        savedMap: {
          ...state.savedMap,
          [itemId]: currentlySaved,
        },
      }));
      return false;
    }
  },
}));
