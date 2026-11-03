import { useCallback, useEffect, useState } from "react";
import { DEFAULT_UNITS } from "@/engine/unitsData";

export interface Settings {
  system: "metric" | "imperial";
  angle: "rad" | "deg";
  theme: "light" | "dark";
  fontSize: number;
  inline: boolean;
  developer: boolean;
  debug: boolean;
  unitsJson: string;
}

const KEY = "smart-text-editor:settings:v1";
const TEXT_KEY = "smart-text-editor:text:v1";

export const DEFAULT_UNITS_JSON = JSON.stringify(DEFAULT_UNITS, null, 2);

function defaults(): Settings {
  const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return {
    system: "metric",
    angle: "rad",
    theme: prefersDark ? "dark" : "light",
    fontSize: 15,
    inline: true,
    developer: false,
    debug: false,
    unitsJson: DEFAULT_UNITS_JSON,
  };
}

function load(): Settings {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...d, ...parsed };
  } catch {
    return d;
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota errors */
    }
  }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update];
}

export function usePersistentText(): [string, (t: string) => void] {
  const [text, setText] = useState<string>(() => {
    try {
      return localStorage.getItem(TEXT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(TEXT_KEY, text);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [text]);
  return [text, setText];
}
