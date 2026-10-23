"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/*
 * Session drafts keep what a person typed across back/refresh within the same LINE window or tab (sessionStorage,
 * so they disappear when it closes). Never store passwords, tokens or files here.
 *
 * Rule for forms that edit saved server data (cart, profile, saved package choices): each draft records the server
 * value it was typed on top of (its "base"). A draft is restored only while that base is still what the server
 * returns; if the server value changed, the server wins and the draft is dropped. A draft equal to its base is not
 * kept. Pure client forms (registration, login email, new product, new Admin) have no base. Callers clear the draft
 * after a successful submit.
 */
const PREFIX = "tonphueng-draft:";
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function readDraft<T>(key: string, base?: unknown): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const draft = JSON.parse(raw) as { value: T; base?: unknown };
    if (same(draft.base, base)) return draft.value;
    sessionStorage.removeItem(PREFIX + key);
  } catch { /* Storage may be unavailable or hold an old shape; the form simply starts fresh. */ }
  return undefined;
}

export function writeDraft(key: string, value: unknown, base?: unknown) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify({ value, base })); } catch { /* Drafts are a convenience only. */ }
}

export function clearDraft(key: string) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* Drafts are a convenience only. */ }
}

/** Controlled value that is restored after hydration and saved while it differs from `initial`. */
export function useSessionDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);
  useEffect(() => {
    const saved = readDraft<T>(key);
    if (saved !== undefined) setValue(saved);
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    if (same(value, initialRef.current)) clearDraft(key); else writeDraft(key, value);
  }, [hydrated, key, value]);
  const clear = useCallback(() => clearDraft(key), [key]);
  return [value, setValue, clear] as const;
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Drafts for uncontrolled forms: restores the named fields once after mount and saves them on every input.
 * `restored` lets the component seed controlled or conditionally rendered fields (e.g. category and its "other" text).
 */
export function useFormDraft(formRef: RefObject<HTMLFormElement | null>, key: string, fields: readonly string[], base?: Record<string, string>) {
  const [restored, setRestored] = useState<Record<string, string> | null>(null);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    const saved = readDraft<Record<string, string>>(key, baseRef.current);
    const form = formRef.current;
    if (!saved || !form) return;
    for (const name of fields) {
      const element = form.elements.namedItem(name) as FieldElement | null;
      if (element && "value" in element && typeof saved[name] === "string") element.value = saved[name];
    }
    setRestored(saved);
    // Restore once per form key; field names are static per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = { ...(baseRef.current ?? {}) };
    for (const name of fields) {
      const element = form.elements.namedItem(name) as FieldElement | null;
      if (element && "value" in element) values[name] = element.value;
    }
    if (baseRef.current && same(values, { ...baseRef.current })) clearDraft(key);
    else writeDraft(key, values, baseRef.current);
  }, [fields, formRef, key]);
  const clear = useCallback(() => clearDraft(key), [key]);
  return { restored, save, clear };
}
