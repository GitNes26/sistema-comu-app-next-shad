import { create } from "zustand";

// Estado de UI compartido (drawer de navegación tablet/móvil, búsqueda).

interface UiState {
  navOpen: boolean;
  searchOpen: boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
  setSearchOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  navOpen: false,
  searchOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));