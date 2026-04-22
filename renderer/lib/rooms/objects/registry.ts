import type { ObjectComponent } from "../types";

type Registry = Record<string, ObjectComponent>;

export const OBJECT_REGISTRY: Registry = {};

export function registerObject(kind: string, component: ObjectComponent) {
  OBJECT_REGISTRY[kind] = component;
}

export function getObjectComponent(kind: string): ObjectComponent | null {
  return OBJECT_REGISTRY[kind] ?? null;
}
