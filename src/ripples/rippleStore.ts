import { ripple } from "ripplex";

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

export const todoStore = {
  todos: ripple<Todo[]>([]),
  loading: ripple(false),
  error: ripple<string | null>(null),
};

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
