"use client";

import { create } from "zustand";

interface QuoteStoreState {
  highlightIds: string[];
  provenanceVisible: boolean;
  setHighlightIds: (ids: string[]) => void;
  toggleProvenance: () => void;
}

export const useQuoteStore = create<QuoteStoreState>((set) => ({
  highlightIds: [],
  provenanceVisible: false,
  setHighlightIds: (ids) => set({ highlightIds: ids }),
  toggleProvenance: () =>
    set((state) => ({ provenanceVisible: !state.provenanceVisible })),
}));
