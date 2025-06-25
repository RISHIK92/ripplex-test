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
