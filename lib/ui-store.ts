import { create } from "zustand";

/* Small client UI state only (data stays in React Query / server calls). */
export const useUiStore = create<{
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen })
}));
