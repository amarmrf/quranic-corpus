import { formatLocation } from "@/lib/location";
import type {
  ConcordanceRequest,
  ConcordanceResponse,
  DictionaryIndexResponse,
  DictionaryResponse,
  SyntaxGraph,
  Metadata,
  SearchRequest,
  SearchResponse,
  Verse,
  WordMorphology,
} from "@/lib/types";

const API_PROXY_BASE = "/api/quranic";

class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
) {
  const url = new URL(`${API_PROXY_BASE}${path}`, "http://localhost");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) {
        continue;
      }

      const normalized = String(value);
      if (normalized.length > 0) {
        url.searchParams.set(key, normalized);
      }
    }
  }

  return `${url.pathname}${url.search}`;
}

async function apiRequest<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
) {
  const url = buildApiUrl(path, params);

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected network error.";
    throw new ApiError(`Unable to reach the API proxy (${API_PROXY_BASE}): ${details}`, 0);
  }

  if (!response.ok) {
    const fallback = `API request failed with status ${response.status}`;
    const message = (await response.text()) || fallback;
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function getMetadata() {
  return apiRequest<Metadata>("/metadata");
}

export async function getMorphology(params: {
  chapterNumber: number;
  startVerse: number;
  count: number;
  translations: string[];
}) {
  const { chapterNumber, startVerse, count, translations } = params;

  return apiRequest<Verse[]>("/morphology", {
    location: formatLocation([chapterNumber, startVerse]),
    n: String(count),
    translation: translations.join(","),
  });
}

export async function getWordMorphology(location: [number, number, number]) {
  return apiRequest<WordMorphology>("/morphology/word", {
    location: formatLocation(location),
  });
}

export async function getSyntax(params: {
  chapterNumber: number;
  verseNumber: number;
  graphNumber: number;
}) {
  const { chapterNumber, verseNumber, graphNumber } = params;

  return apiRequest<SyntaxGraph | null>("/syntax", {
    location: formatLocation([chapterNumber, verseNumber]),
    graph: graphNumber,
  });
}

export async function getSearch(params: SearchRequest) {
  return apiRequest<SearchResponse>("/search", params);
}

export async function getDictionary(params: SearchRequest) {
  return apiRequest<DictionaryResponse>("/dictionary", params);
}

export async function getConcordance(params: ConcordanceRequest) {
  return apiRequest<ConcordanceResponse>("/concordance", params);
}

export async function getDictionaryIndex(params: {
  type: "lemma" | "root";
  startsWith?: string;
  contains?: string;
  limit?: number;
  offset?: number;
}) {
  return apiRequest<DictionaryIndexResponse>("/dictionary/index", params);
}
