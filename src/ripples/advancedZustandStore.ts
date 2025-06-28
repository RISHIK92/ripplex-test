import { create } from "zustand";

type Subtask = { id: number; title: string; done: boolean };
type Task = {
  id: number;
  title: string;
  completed: boolean;
  subtasks: Subtask[];
};
type Project = { id: number; name: string; tasks: Task[] };
type Widget = {
  id: string;
  type: string;
  config: { color: string; size: number; data: any };
};
type User = {
  id: number;
  name: string;
  profile: {
    bio: string;
    social: { twitter: string; github: string };
    preferences: {
      theme: "light" | "dark";
      notifications: { email: boolean; sms: boolean };
    };
  };
};

type Dashboard = {
  stats: { activeUsers: number; errors: number; lastUpdate: string };
  widgets: Widget[];
};

type ZustandStore = {
  user: User | null;
  projects: Project[];
  dashboard: Dashboard;
  loading: boolean;
  error: string | null;
  loadAll: () => Promise<void>;
  toggleTheme: () => void;
  addSubtask: () => void;
  setProjects: (projects: Project[]) => void;
};

export const useZustandStore = create<ZustandStore>((set, get) => ({
  user: null,
  projects: [],
  dashboard: {
    stats: { activeUsers: 0, errors: 0, lastUpdate: "" },
    widgets: [],
  },
  loading: false,
  error: null,
  loadAll: async () => {
    set({ loading: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    set({
      user: {
        id: 1,
        name: "Alice",
        profile: {
          bio: "Fullstack dev",
          social: { twitter: "@alice", github: "aliceGH" },
          preferences: {
            theme: "dark",
            notifications: { email: true, sms: false },
          },
        },
      },
      projects: [
        {
          id: 101,
          name: "Zustand Migration",
          tasks: [
            {
              id: 1,
              title: "Setup base repo",
              completed: true,
              subtasks: [
                { id: 1, title: "Init repo", done: true },
                { id: 2, title: "Add CI", done: false },
              ],
            },
            {
              id: 2,
              title: "Implement features",
              completed: false,
              subtasks: [
                { id: 3, title: "Signals", done: true },
                { id: 4, title: "Devtools", done: false },
              ],
            },
          ],
        },
      ],
      dashboard: {
        stats: {
          activeUsers: 42,
          errors: 1,
          lastUpdate: new Date().toISOString(),
        },
        widgets: [
          {
            id: "w1",
            type: "chart",
            config: { color: "#61dafb", size: 2, data: [1, 2, 3] },
          },
          {
            id: "w2",
            type: "list",
            config: { color: "#ffb86c", size: 1, data: ["A", "B"] },
          },
        ],
      },
      loading: false,
      error: null,
    });
  },
  toggleTheme: () => {
    set((state) => {
      if (!state.user) return {};
      return {
        user: {
          ...state.user,
          profile: {
            ...state.user.profile,
            preferences: {
              ...state.user.profile.preferences,
              theme:
                state.user.profile.preferences.theme === "dark"
                  ? "light"
                  : "dark",
            },
          },
        },
      };
    });
  },
  addSubtask: () => {
    set((state) => {
      const projects = [...state.projects];
      if (projects[0] && projects[0].tasks[0]) {
        projects[0].tasks[0].subtasks = [
          ...projects[0].tasks[0].subtasks,
          {
            id: Date.now(),
            title: "New Subtask " + Date.now(),
            done: false,
          },
        ];
      }
      return { projects };
    });
  },
  setProjects: (projects) => set({ projects }),
}));
