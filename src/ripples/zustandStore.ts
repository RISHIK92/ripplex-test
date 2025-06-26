import { create } from "zustand";

export const useZustandStore = create((set) => ({
  projects: [],
  loadAll: async (projectsOverride: any) => {
    await new Promise((r) => setTimeout(r, 0));
    set({ projects: projectsOverride || [] });
  },
  setProjectsSync: (projects: any) => set({ projects }),
}));
