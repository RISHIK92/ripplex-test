import { ripple } from "../../lib";
// import { ripple } from "ripplex-core";

export const appStore1 = {
  user: ripple<{
    id: number;
    name: string;
    profile: {
      bio: string;
      social: {
        twitter: string;
        github: string;
      };
      preferences: {
        theme: "light" | "dark";
        notifications: {
          email: boolean;
          sms: boolean;
        };
      };
    };
  } | null>(null),

  projects: ripple.immer<
    {
      id: number;
      name: string;
      tasks: {
        id: number;
        title: string;
        completed: boolean;
        subtasks: {
          id: number;
          title: string;
          done: boolean;
        }[];
      }[];
    }[]
  >([]),

  dashboard: ripple<{
    stats: {
      activeUsers: number;
      errors: number;
      lastUpdate: string;
    };
    widgets: {
      id: string;
      type: string;
      config: {
        color: string;
        size: number;
        data: any;
      };
    }[];
  }>({
    stats: { activeUsers: 0, errors: 0, lastUpdate: "" },
    widgets: [],
  }),

  loading: ripple(false),
  error: ripple<string | null>(null),
};

export interface Todo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export const countStore = {
  count: ripple(0),
  loading: ripple(false),
  error: ripple<string | null>(null),
};

export const todoStore = ripple({
  title: null,
  todos: [] as Todo[],
  loading: false,
  error: null as string | null,
});

export const countNew = ripple(0);

export type Subtask = { id: number; title: string; done: boolean };
export type Task = {
  id: number;
  title: string;
  completed: boolean;
  subtasks: Subtask[];
};
export type Project = { id: number; name: string; tasks: Task[] };

export const appStore = {
  projects: ripple<Project[]>([]),
};
