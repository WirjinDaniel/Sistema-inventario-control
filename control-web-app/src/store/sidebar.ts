import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarStore {
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  toggle: () => void;
  toggleGroup: (title: string) => void;
  setGroupOpen: (title: string, open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      openGroups: {},
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      toggleGroup: (title) =>
        set((s) => ({
          openGroups: { ...s.openGroups, [title]: !s.openGroups[title] },
        })),
      setGroupOpen: (title, open) =>
        set((s) => ({
          openGroups: { ...s.openGroups, [title]: open },
        })),
    }),
    { name: "sidebar-state" }
  )
);
