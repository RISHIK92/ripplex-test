import { create } from "zustand";

export const useZustandStore = create((set) => ({
  projects: [],
  loadAll: async (projectsOverride: any) => {
    await new Promise((r) => setTimeout(r, 1000));
    set({ projects: projectsOverride || [] });
  },
  setProjectsSync: (projects: any) => set({ projects }), // ✅ Added
}));
