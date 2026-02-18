import type { Location } from "@/lib/types";

export function parseLocation(value: string): Location {
  const decodedValue = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();

  return decodedValue
    .split(":")
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isFinite(entry));
}

export function isTokenLocation(location: Location): location is [number, number, number] {
  return location.length === 3;
}

export function normalizeVerseLocation(location: Location): [number, number] {
  const chapter = location[0] ?? 1;
  const verse = location[1] ?? 1;
  return [Math.max(chapter, 1), Math.max(verse, 1)];
}

export function formatLocation(location: Location): string {
  return location.join(":");
}

export function toVerseId(chapterNumber: number, verseNumber: number): string {
  return `verse-${chapterNumber}-${verseNumber}`;
}

export function toTokenId(location: Location): string {
  return `token-${location.join("-")}`;
}
