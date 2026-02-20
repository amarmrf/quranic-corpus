"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Loader2,
  Moon,
  Search,
  Sun,
} from "lucide-react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTheme } from "@/hooks/use-theme";
import {
  getConcordance,
  getDictionary,
  getDictionaryIndex,
  getMetadata,
  getSearch,
  getWordMorphology,
} from "@/lib/api";
import { getLinguisticToneColor } from "@/lib/linguistic-colors";
import type {
  ConcordanceResponse,
  DictionaryIndexEntry,
  DictionaryIndexType,
  DictionaryResponse,
  SearchGroupBy,
  SearchMode,
  SearchResult,
  SearchResponse,
  SearchSort,
  Translation,
  WordMorphology,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { TokenInspector } from "@/components/layout/token-inspector";
import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActiveTab = "search" | "dictionary" | "concordance";

const MODE_OPTIONS: { value: SearchMode; label: string }[] = [
  { value: "surface", label: "Surface/gloss" },
  { value: "lemma", label: "Lemma" },
  { value: "root", label: "Root" },
  { value: "translation", label: "Verse translation" },
];

const DEFAULT_SEARCH_EXAMPLE = "adam";
const DEFAULT_CONCORDANCE_EXAMPLE = "house";

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "location", label: "Location" },
];

const GROUP_BY_OPTIONS: { value: SearchGroupBy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "lemma", label: "Lemma" },
  { value: "root", label: "Root" },
];

const ARABIC_LETTERS = ["all", "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"] as const;
const LINGUISTIC_TERMS: { term: string; description: string }[] = [
  {
    term: "Lemma",
    description: "Dictionary headword for a word-form family (e.g., different inflections under one entry).",
  },
  {
    term: "Root",
    description: "Core consonantal base that links related words by meaning in Arabic morphology.",
  },
  {
    term: "Surface form",
    description: "The exact token as it appears in the verse text, including spelling variations.",
  },
  {
    term: "Gloss",
    description: "Short meaning hint used for quick reading before checking full translation context.",
  },
  {
    term: "POS",
    description: "Part of speech label such as noun, verb, particle, pronoun, and related categories.",
  },
  {
    term: "Concordance",
    description: "List of every occurrence of a query with local context for comparison across verses.",
  },
];

function isSameLocation(
  left: [number, number, number],
  right: [number, number, number],
) {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function toSearchResultId(location: [number, number, number]) {
  return `search-result-${location.join("-")}`;
}

export function SearchShell() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const defaultSearchLoadedRef = useRef(false);
  const defaultDictionaryLoadedRef = useRef(false);
  const defaultConcordanceLoadedRef = useRef(false);
  const [showGuide, setShowGuide] = useLocalStorage<boolean>("qc.search.show-guide", true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [translation, setTranslation] = useState<string>(
    urlSearchParams.get("translation") ?? "sahih-international",
  );
  const [chapter, setChapter] = useState<string>("all");
  const [exact, setExact] = useState(false);
  const [diacritics, setDiacritics] = useState(false);
  const [limit, setLimit] = useState(50);

  const [searchQuery, setSearchQuery] = useState(urlSearchParams.get("q") ?? "");
  const [searchMode, setSearchMode] = useState<SearchMode>(
    (urlSearchParams.get("mode") as SearchMode) ?? "surface",
  );
  const [searchSort, setSearchSort] = useState<SearchSort>("relevance");
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);

  const [dictionaryType, setDictionaryType] = useState<DictionaryIndexType>("root");
  const [dictionaryStartsWith, setDictionaryStartsWith] = useState<(typeof ARABIC_LETTERS)[number]>("all");
  const [dictionaryContains, setDictionaryContains] = useState("");
  const [dictionaryFilterFocused, setDictionaryFilterFocused] = useState(false);
  const [dictionaryIndex, setDictionaryIndex] = useState<DictionaryIndexEntry[]>([]);
  const [selectedDictionaryEntry, setSelectedDictionaryEntry] = useState("");
  const [dictionaryData, setDictionaryData] = useState<DictionaryResponse | null>(null);
  const [dictionaryOccurrences, setDictionaryOccurrences] = useState<ConcordanceResponse | null>(null);

  const [concordanceQuery, setConcordanceQuery] = useState("");
  const [concordanceMode, setConcordanceMode] = useState<SearchMode>("surface");
  const [concordanceGroupBy, setConcordanceGroupBy] = useState<SearchGroupBy>("none");
  const [concordanceData, setConcordanceData] = useState<ConcordanceResponse | null>(null);

  const [translations, setTranslations] = useState<Translation[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [wordMorphology, setWordMorphology] = useState<WordMorphology | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setMetadataError(null);
        const metadata = await getMetadata();
        setTranslations(metadata.translations);
        if (!metadata.translations.some((entry) => entry.key === translation)) {
          setTranslation(metadata.translations[0]?.key ?? "sahih-international");
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "Unable to load metadata.";
        setMetadataError(message);
      }
    };

    void run();
  }, [translation]);

  const chapterNumber = useMemo(
    () => (chapter === "all" ? undefined : Number(chapter)),
    [chapter],
  );

  const runSearch = useCallback(
    async (nextOffset = 0, explicitQuery?: string, explicitMode?: SearchMode) => {
      const q = (explicitQuery ?? searchQuery).trim();
      const mode = explicitMode ?? searchMode;
      if (q.length === 0) {
        setError("Enter a query before searching.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const next = await getSearch({
          q,
          mode,
          translation,
          chapter: chapterNumber,
          exact,
          diacritics,
          limit,
          offset: nextOffset,
          sort: searchSort,
        });
        if (nextOffset === 0) {
          setSearchData(next);
        } else {
          setSearchData((current) =>
            current == null ? next : { ...next, results: [...current.results, ...next.results] },
          );
        }
        setSearchOffset(nextOffset);
        const urlParams = new URLSearchParams(urlSearchParams);
        urlParams.set("q", q);
        urlParams.set("mode", mode);
        urlParams.set("translation", translation);
        router.replace(`/search?${urlParams.toString()}`);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Search request failed.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      chapterNumber,
      diacritics,
      exact,
      limit,
      router,
      searchMode,
      searchQuery,
      searchSort,
      translation,
      urlSearchParams,
    ],
  );

  useEffect(() => {
    if (activeTab !== "search") {
      return;
    }

    if (defaultSearchLoadedRef.current) {
      return;
    }

    const initialQuery = urlSearchParams.get("q")?.trim() ?? "";
    defaultSearchLoadedRef.current = true;

    const initialModeParam = urlSearchParams.get("mode");
    const initialMode: SearchMode =
      initialModeParam === "surface" ||
      initialModeParam === "lemma" ||
      initialModeParam === "root" ||
      initialModeParam === "translation"
        ? initialModeParam
        : "surface";

    const queryToRun = initialQuery.length > 0 ? initialQuery : DEFAULT_SEARCH_EXAMPLE;
    const modeToRun = initialQuery.length > 0 ? initialMode : "surface";

    setSearchMode(modeToRun);
    setSearchSort("relevance");
    setSearchQuery(queryToRun);
    void runSearch(0, queryToRun, modeToRun);
  }, [activeTab, runSearch, urlSearchParams]);

  const dictionaryContainsPlaceholder = dictionaryType === "root"
    ? "Filter roots (e.g., كتب or ق د س)"
    : "Filter lemmas (e.g., آدم or البيت)";
  const dictionaryStartsWithLabel =
    dictionaryStartsWith === "all" ? "All letters" : `Letter ${dictionaryStartsWith}`;
  const hasSharedFilters = exact || diacritics || chapter !== "all";
  const normalizeDictionaryValue = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (dictionaryType !== "root") {
        return trimmed;
      }
      return trimmed.replace(/\s+/g, "");
    },
    [dictionaryType],
  );

  const loadDictionaryIndex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const normalizedContains = normalizeDictionaryValue(dictionaryContains);
      const response = await getDictionaryIndex({
        type: dictionaryType,
        startsWith: dictionaryStartsWith === "all" ? undefined : dictionaryStartsWith,
        contains: normalizedContains || undefined,
        limit: 200,
      });
      setDictionaryIndex(response.entries);
      if (response.entries.length > 0 && !response.entries.some((entry) => entry.key === selectedDictionaryEntry)) {
        setSelectedDictionaryEntry(response.entries[0].key);
      }
      if (response.entries.length === 0) {
        setSelectedDictionaryEntry("");
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Unable to load dictionary index.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    dictionaryContains,
    dictionaryStartsWith,
    dictionaryType,
    normalizeDictionaryValue,
    selectedDictionaryEntry,
  ]);

  useEffect(() => {
    if (activeTab === "dictionary") {
      void loadDictionaryIndex();
    }
  }, [activeTab, loadDictionaryIndex]);

  const runDictionary = useCallback(async (explicitEntry?: string) => {
    const rawDictionaryQuery = (explicitEntry ?? selectedDictionaryEntry).trim();
    const dictionaryQuery = normalizeDictionaryValue(rawDictionaryQuery);
    if (!dictionaryQuery) {
      setError("Pick a root/lemma entry first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [details, occurrences] = await Promise.all([
        getDictionary({
          q: dictionaryQuery,
          mode: dictionaryType,
          translation,
          chapter: chapterNumber,
          exact: true,
          diacritics,
          limit: 20,
          offset: 0,
          sort: "relevance",
          groupBy: dictionaryType,
        }),
        getConcordance({
          q: dictionaryQuery,
          mode: dictionaryType,
          translation,
          chapter: chapterNumber,
          exact: true,
          diacritics,
          limit: 200,
          offset: 0,
          sort: "location",
          groupBy: "none",
          occurrenceLimit: 200,
        }),
      ]);
      setDictionaryData(details);
      setDictionaryOccurrences(occurrences);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Dictionary request failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    chapterNumber,
    dictionaryType,
    diacritics,
    normalizeDictionaryValue,
    selectedDictionaryEntry,
    translation,
  ]);

  const runConcordance = useCallback(async (explicitQuery?: string) => {
    const q = (explicitQuery ?? concordanceQuery).trim();
    if (q.length === 0) {
      setError("Enter a concordance query.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setConcordanceData(
        await getConcordance({
          q,
          mode: concordanceMode,
          translation,
          chapter: chapterNumber,
          exact,
          diacritics,
          limit: 120,
          offset: 0,
          sort: "location",
          groupBy: concordanceGroupBy,
          occurrenceLimit: 120,
        }),
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Concordance request failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    chapterNumber,
    concordanceGroupBy,
    concordanceMode,
    concordanceQuery,
    diacritics,
    exact,
    translation,
  ]);

  useEffect(() => {
    if (activeTab !== "dictionary" || defaultDictionaryLoadedRef.current) {
      return;
    }

    if (!selectedDictionaryEntry) {
      return;
    }

    defaultDictionaryLoadedRef.current = true;
    void runDictionary(selectedDictionaryEntry);
  }, [activeTab, runDictionary, selectedDictionaryEntry]);

  useEffect(() => {
    if (activeTab !== "concordance" || defaultConcordanceLoadedRef.current) {
      return;
    }

    defaultConcordanceLoadedRef.current = true;
    setConcordanceQuery(DEFAULT_CONCORDANCE_EXAMPLE);
    void runConcordance(DEFAULT_CONCORDANCE_EXAMPLE);
  }, [activeTab, runConcordance]);

  useEffect(() => {
    if (!selectedResult) {
      setWordMorphology(null);
      setWordError(null);
      return;
    }

    let active = true;
    setWordMorphology(null);

    const run = async () => {
      setWordLoading(true);
      setWordError(null);
      try {
        const morphology = await getWordMorphology(selectedResult.location);
        if (active) {
          setWordMorphology(morphology);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        const message =
          requestError instanceof Error ? requestError.message : "Unable to load token analysis.";
        setWordError(message);
      } finally {
        if (active) {
          setWordLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [selectedResult]);

  const canLoadMoreSearch =
    searchData != null && searchData.results.length > 0 && searchData.results.length < searchData.total;
  const selectedLocation = selectedResult?.location.join(":");
  const analyzedToken = wordMorphology?.token;
  const analyzedArabic =
    analyzedToken?.segments
      .map((segment) => segment.arabic ?? "")
      .join("")
      .trim() || selectedResult?.tokenArabic || "";
  const analyzedPhonetic = analyzedToken?.phonetic || selectedResult?.phonetic || "";
  const activeQueryText = useMemo(() => {
    if (activeTab === "search") {
      return searchData?.query.q;
    }
    if (activeTab === "dictionary") {
      return dictionaryOccurrences?.query.q;
    }
    return concordanceData?.query.q;
  }, [activeTab, concordanceData?.query.q, dictionaryOccurrences?.query.q, searchData?.query.q]);
  const selectedResultTranslationSnippet = useMemo(() => {
    if (!selectedResult?.verseTranslation) {
      return null;
    }

    const verseArabicTokens = selectedResult.verseArabicTokens ?? [];
    const hasArabicContext = verseArabicTokens.length > 0;
    const rawMatchedTokenIndex = selectedResult.matchedTokenIndex ?? Math.max(selectedResult.location[2] - 1, 0);
    const matchedTokenIndex = hasArabicContext
      ? Math.min(Math.max(rawMatchedTokenIndex, 0), verseArabicTokens.length - 1)
      : 0;

    return getTranslationSnippet(
      selectedResult.verseTranslation,
      activeQueryText,
      selectedResult.gloss,
      false,
      matchedTokenIndex,
      verseArabicTokens.length,
    );
  }, [activeQueryText, selectedResult]);
  const activeResults = useMemo<SearchResult[]>(() => {
    if (activeTab === "search") {
      return searchData?.results ?? [];
    }

    if (activeTab === "dictionary") {
      return dictionaryOccurrences?.results ?? [];
    }

    if (!concordanceData) {
      return [];
    }

    if (concordanceGroupBy === "none") {
      return concordanceData.results;
    }

    return concordanceData.groups.flatMap((group) => group.occurrences);
  }, [activeTab, concordanceData, concordanceGroupBy, dictionaryOccurrences, searchData]);
  const selectedResultIndex = useMemo(() => {
    if (!selectedResult) {
      return -1;
    }

    return activeResults.findIndex((entry) => isSameLocation(entry.location, selectedResult.location));
  }, [activeResults, selectedResult]);
  const canSelectPreviousResult = selectedResultIndex > 0;
  const canSelectNextResult = selectedResultIndex >= 0 && selectedResultIndex < activeResults.length - 1;
  const selectPreviousResult = useCallback(() => {
    if (!canSelectPreviousResult) {
      return;
    }

    const previous = activeResults[selectedResultIndex - 1];
    if (previous) {
      setSelectedResult(previous);
    }
  }, [activeResults, canSelectPreviousResult, selectedResultIndex]);
  const selectNextResult = useCallback(() => {
    if (!canSelectNextResult) {
      return;
    }

    const next = activeResults[selectedResultIndex + 1];
    if (next) {
      setSelectedResult(next);
    }
  }, [activeResults, canSelectNextResult, selectedResultIndex]);

  return (
    <WorkbenchShell
      title="Search, Dictionary, Concordance"
      description="Console-style linguistic workspace with docked controls and live results."
      leftLabel="Query Console"
      mainLabel="Results Stream"
      rightLabel="Context"
      rightContentClassName="lg:overflow-visible"
      actions={(
        <>
          <Badge variant="secondary" className="hidden tabular-nums sm:inline-flex">
            API proxy: /api/quranic
          </Badge>
          <Button variant="outline" onClick={() => router.push("/reader/1:1")}>
            <BookOpenText className="size-4" aria-hidden="true" />
            <span className="sm:hidden">Read</span>
            <span className="hidden sm:inline">Reader</span>
          </Button>
          <Button
            type="button"
            variant={showGuide ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGuide((current) => !current)}
          >
            <CircleHelp className="size-4" aria-hidden="true" />
            Guide
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </>
      )}
      left={(
        <Card className="bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-balance">Tool controls</CardTitle>
           
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="search">Search</TabsTrigger>
                <TabsTrigger value="dictionary">Dictionary</TabsTrigger>
                <TabsTrigger value="concordance">Concordance</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "search" && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runSearch(0)}
                    disabled={loading || searchQuery.trim().length === 0}
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    Run search
                  </Button>
                </div>
                <div className="grid gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void runSearch(0);
                        }
                      }}
                      placeholder="house, mercy, justice..."
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={searchMode} onValueChange={(value) => setSearchMode(value as SearchMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODE_OPTIONS.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={searchSort} onValueChange={(value) => setSearchSort(value as SearchSort)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dictionary" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    onClick={() => void runDictionary()}
                    disabled={loading || selectedDictionaryEntry.length === 0}
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    Open entry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void loadDictionaryIndex()} disabled={loading}>
                    Refresh index
                  </Button>
                </div>

                <div className="grid gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Dictionary type</p>
                    <Select
                      value={dictionaryType}
                      onValueChange={(value) => {
                        setDictionaryType(value as DictionaryIndexType);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root">Root dictionary</SelectItem>
                        <SelectItem value="lemma">Lemma dictionary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Filter index</p>
                    <Input
                      value={dictionaryContains}
                      onFocus={() => setDictionaryFilterFocused(true)}
                      onBlur={() => setDictionaryFilterFocused(false)}
                      onChange={(event) => setDictionaryContains(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void loadDictionaryIndex();
                        }
                      }}
                      placeholder={dictionaryContainsPlaceholder}
                    />
                  </div>
                </div>

                {(showGuide || dictionaryFilterFocused) && (
                  <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                    <p className="text-pretty">
                      <span className="font-medium text-foreground">All letters</span> shows the broad index (up to
                      200 rows). Pick one letter first, then filter by text for faster lookup.
                    </p>
                    <p className="mt-2 text-pretty">
                      Example values:{" "}
                      {dictionaryType === "root" ? "كتب, ق د س, ع ل م" : "آدم, البيت, رحمة"}.
                    </p>
                  </div>
                )}

                <div className="min-w-0 space-y-2 rounded-md border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Starts with: <span className="font-medium text-foreground">{dictionaryStartsWithLabel}</span>
                    </p>
                    <Button
                      size="sm"
                      variant={dictionaryStartsWith === "all" ? "default" : "outline"}
                      onClick={() => {
                        setDictionaryStartsWith("all");
                      }}
                    >
                      All letters
                    </Button>
                  </div>
                  <div dir="rtl" className="flex flex-wrap justify-end gap-1 pb-1">
                    {ARABIC_LETTERS.filter((letter) => letter !== "all").map((letter) => (
                      <Button
                        key={letter}
                        type="button"
                        size="sm"
                        variant={dictionaryStartsWith === letter ? "default" : "outline"}
                        className="h-8 min-w-8 px-2 font-arabic text-base"
                        onClick={() => {
                          setDictionaryStartsWith(letter);
                        }}
                      >
                        {letter}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Select
                    value={selectedDictionaryEntry}
                    onValueChange={setSelectedDictionaryEntry}
                    disabled={dictionaryIndex.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select root/lemma from filtered index" />
                    </SelectTrigger>
                    <SelectContent>
                      {dictionaryIndex.map((entry) => (
                        <SelectItem key={`${entry.type}:${entry.key}`} value={entry.key}>
                          {entry.key} ({entry.arabic}) - {entry.count}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!loading && dictionaryIndex.length === 0 && (
                  <p className="text-xs text-muted-foreground text-pretty">
                    No index matches for the current filters. Try another letter or a shorter filter.
                  </p>
                )}
              </div>
            )}

            {activeTab === "concordance" && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void runConcordance()}
                    disabled={loading || concordanceQuery.trim().length === 0}
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    Run concordance
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Input
                    value={concordanceQuery}
                    onChange={(event) => setConcordanceQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void runConcordance();
                      }
                    }}
                    placeholder="Enter concordance query"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={concordanceMode} onValueChange={(value) => setConcordanceMode(value as SearchMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODE_OPTIONS.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={concordanceGroupBy}
                      onValueChange={(value) => setConcordanceGroupBy(value as SearchGroupBy)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUP_BY_OPTIONS.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Scope and output</p>
              <div className="grid gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Translation</p>
                  <Select value={translation} onValueChange={setTranslation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Translation" />
                    </SelectTrigger>
                    <SelectContent>
                      {translations.map((entry) => (
                        <SelectItem key={entry.key} value={entry.key}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Chapter scope</p>
                  <Select value={chapter} onValueChange={setChapter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All chapters</SelectItem>
                      {Array.from({ length: 114 }, (_, index) => index + 1).map((entry) => (
                        <SelectItem key={entry} value={String(entry)}>
                          Chapter {entry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Result size</p>
                  <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 200].map((entry) => (
                        <SelectItem key={entry} value={String(entry)}>
                          {entry} per page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <span className="px-1 text-xs text-muted-foreground">Match flags</span>
              <Button
                size="sm"
                variant={exact ? "default" : "outline"}
                onClick={() => setExact((current) => !current)}
              >
                Exact
              </Button>
              <Button
                size="sm"
                variant={diacritics ? "default" : "outline"}
                onClick={() => setDiacritics((current) => !current)}
              >
                Diacritics
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={!hasSharedFilters}
                onClick={() => {
                  setExact(false);
                  setDiacritics(false);
                  setChapter("all");
                }}
              >
                Reset
              </Button>
            </div>

            {showGuide && (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                <p className="text-pretty">
                  Search finds matching tokens. Dictionary opens one root/lemma entry. Concordance lists occurrences
                  and contexts.
                </p>
                <p className="mt-2 text-pretty">
                  Use chapter scope to narrow context. Use <span className="font-medium text-foreground">Exact</span>
                  {" "}for strict matching and{" "}
                  <span className="font-medium text-foreground">Diacritics</span> when vowel marks matter.
                </p>
              </div>
            )}

            {showGuide && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <p className="text-xs text-muted-foreground">Linguistic guide</p>
                <dl className="space-y-2">
                  {LINGUISTIC_TERMS.map((entry) => (
                    <div key={entry.term} className="rounded-md border bg-background p-2">
                      <dt className="text-sm font-medium text-foreground">{entry.term}</dt>
                      <dd className="text-xs text-muted-foreground text-pretty">{entry.description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {metadataError && <p className="text-sm text-destructive text-pretty">{metadataError}</p>}
            {error && <p className="text-sm text-destructive text-pretty">{error}</p>}
          </CardContent>
        </Card>
      )}
      main={(
        <Card className="bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-balance">Results</CardTitle>
            <CardDescription className="text-pretty">
              {activeTab === "search" && `${searchData?.total ?? 0} search matches`}
              {activeTab === "dictionary" &&
                `${dictionaryData?.totalEntries ?? 0} entry groups / ${
                  dictionaryOccurrences?.totalOccurrences ?? 0
                } occurrences`}
              {activeTab === "concordance" &&
                `${concordanceData?.totalOccurrences ?? 0} concordance matches`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTab === "search" && searchData == null && !loading && (
              <p className="text-sm text-muted-foreground text-pretty">
                Run a search query to load matching tokens and verses.
              </p>
            )}

            {activeTab === "search" && searchData != null && searchData.results.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-pretty">
                No search matches found. Try a different mode, chapter scope, or query.
              </p>
            )}

            {activeTab === "search" &&
              (searchData?.results ?? []).map((entry) => (
                <ResultRow
                  key={entry.location.join(":")}
                  entry={entry}
                  onShowDetails={setSelectedResult}
                  isSelected={selectedLocation === entry.location.join(":")}
                  queryText={searchData?.query.q}
                />
              ))}

            {activeTab === "dictionary" && (
              <div className="space-y-2">
                {!dictionaryData && !loading && (
                  <p className="text-sm text-muted-foreground text-pretty">
                    Select a root/lemma from the index, then open the dictionary entry.
                  </p>
                )}
                {(dictionaryData?.entries ?? []).map((entry) => (
                  <Card key={`${entry.type}:${entry.key}`} className="bg-background">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{entry.type}</Badge>
                        <span className="font-semibold">{entry.key}</span>
                        <span className="font-arabic text-lg">{entry.arabic}</span>
                        <Badge variant="outline">{entry.occurrences} occurrences</Badge>
                        <Badge variant="outline">{entry.formsCount} forms</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.glosses.join(", ")}</p>
                    </CardContent>
                  </Card>
                ))}

                {(dictionaryOccurrences?.results ?? []).map((entry) => (
                  <ResultRow
                    key={entry.location.join(":")}
                    entry={entry}
                    onShowDetails={setSelectedResult}
                    isSelected={selectedLocation === entry.location.join(":")}
                    showMorphology
                    queryText={dictionaryOccurrences?.query.q}
                  />
                ))}
                {dictionaryData &&
                  !loading &&
                  dictionaryData.entries.length === 0 &&
                  (dictionaryOccurrences?.results.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground text-pretty">
                      No dictionary results found for this entry and filter scope.
                    </p>
                  )}
              </div>
            )}

            {activeTab === "concordance" && (
              <div className="space-y-2">
                {!concordanceData && !loading && (
                  <p className="text-sm text-muted-foreground text-pretty">
                    Run concordance to inspect all occurrences for a query.
                  </p>
                )}
                {concordanceGroupBy === "none"
                  ? (concordanceData?.results ?? []).map((entry) => (
                      <ResultRow
                        key={entry.location.join(":")}
                        entry={entry}
                        onShowDetails={setSelectedResult}
                        isSelected={selectedLocation === entry.location.join(":")}
                        queryText={concordanceData?.query.q}
                      />
                    ))
                  : (concordanceData?.groups ?? []).map((group) => (
                      <Card key={`${group.type}:${group.key}`} className="bg-background">
                        <CardContent className="space-y-2 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{group.type}</Badge>
                            <span className="font-semibold">{group.key}</span>
                            <span className="font-arabic text-lg">{group.arabic}</span>
                            <Badge variant="outline">{group.count} occurrences</Badge>
                          </div>
                          {group.occurrences.map((entry) => (
                            <ResultRow
                              key={entry.location.join(":")}
                              entry={entry}
                              onShowDetails={setSelectedResult}
                              isSelected={selectedLocation === entry.location.join(":")}
                              compact
                              queryText={concordanceData?.query.q}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                {concordanceData != null &&
                  !loading &&
                  concordanceData.totalOccurrences === 0 && (
                    <p className="text-sm text-muted-foreground text-pretty">
                      No concordance occurrences found for this query.
                    </p>
                  )}
              </div>
            )}

            {activeTab === "search" && searchData != null && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  onClick={() => void runSearch(searchOffset + limit)}
                  disabled={loading || !canLoadMoreSearch}
                >
                  {canLoadMoreSearch ? "Load more search results" : "All search results loaded"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
      right={(
        <TokenInspector
          title="Token analysis"
          headerActions={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Select previous result token"
                  onClick={selectPreviousResult}
                  disabled={!canSelectPreviousResult}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Select next result token"
                  onClick={selectNextResult}
                  disabled={!canSelectNextResult}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedResult) {
                    router.push(`/reader/${selectedResult.location.join(":")}`);
                  }
                }}
                disabled={!selectedResult}
              >
                Open in reader
              </Button>
            </div>
          )}
        >
          {!selectedResult && (
            <div className="rounded-md border border-dashed bg-card p-3">
              <p className="text-sm text-foreground/80 text-pretty">
                No token selected. Pick any row and open details to load token analysis.
              </p>
            </div>
          )}

          {selectedResult && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-border/90 bg-card p-3">
                <div className="space-y-1">
                  <div>
                    <p className="text-xs text-foreground/70">Location</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {selectedResult.location.join(":")}
                    </p>
                  </div>
                </div>
                {analyzedArabic.length > 0 && (
                  <p className="font-arabic text-2xl leading-none">{analyzedArabic}</p>
                )}
                <div className="space-y-1">
                  {analyzedPhonetic.length > 0 && (
                    <p className="text-xs text-foreground/70 text-pretty">{analyzedPhonetic}</p>
                  )}
                  {selectedResultTranslationSnippet && (
                    <p className="text-xs text-foreground/70 text-pretty">
                      {highlightTranslation(selectedResultTranslationSnippet, activeQueryText, selectedResult.gloss)}
                    </p>
                  )}
                </div>
              </div>

              {wordError && (
                <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                  <p className="text-sm text-destructive text-pretty">{wordError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedResult((current) => (current ? { ...current } : current))}
                  >
                    Retry analysis
                  </Button>
                </div>
              )}

              {wordLoading && (
                <div className="flex items-center gap-2 rounded-md border border-border/90 bg-card p-3 text-sm text-foreground/75">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading token analysis...
                </div>
              )}

              {!wordLoading && wordMorphology && (
                <div className="overflow-hidden rounded-md border border-border/90 bg-card">
                  <section className="space-y-1.5 p-3">
                    <p className="text-xs text-foreground/70">Summary</p>
                    <p className="text-sm text-pretty">{wordMorphology.summary}</p>
                  </section>
                  <Separator />
                  <section className="space-y-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-foreground/70">Segments</p>
                      <Badge variant="outline" className="tabular-nums">
                        {wordMorphology.segmentDescriptions.length}
                      </Badge>
                    </div>
                    {wordMorphology.segmentDescriptions.length === 0 ? (
                      <p className="text-sm text-foreground/75 text-pretty">
                        Segment-level notes are not yet available for this token.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {wordMorphology.segmentDescriptions.map((description) => (
                          <li key={description} className="text-sm text-pretty">
                            {description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <Separator />
                  <section className="space-y-1.5 p-3">
                    <p className="text-xs text-foreground/70">Arabic grammar</p>
                    <p className="text-sm text-pretty">{wordMorphology.arabicGrammar}</p>
                  </section>
                </div>
              )}

              <div className="grid gap-2 rounded-md border border-border/90 bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground/70">Match field</span>
                  <Badge variant="outline">{selectedResult.matchField}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground/70">POS tags</span>
                  <span className="text-right">{selectedResult.posTags.join(", ") || "-"}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-foreground/70">Morphology</p>
                  <p className="text-xs text-pretty">
                    {selectedResult.morphology.length > 0
                      ? selectedResult.morphology.slice(0, 6).join(" | ")
                      : "No morphology tags."}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border/90 bg-card p-3">
                <p className="text-xs text-foreground/70">Lexeme links</p>
                <div className="flex flex-wrap gap-2">
                  {selectedResult.lemmas.slice(0, 3).map((lemma) => (
                    <Badge
                      key={`analysis-lemma-${lemma.key}`}
                      variant="outline"
                      style={{
                        borderColor: getLinguisticToneColor("noun", 0.5),
                        backgroundColor: getLinguisticToneColor("noun", 0.14),
                        color: getLinguisticToneColor("noun"),
                      }}
                    >
                      LEM: {lemma.key}
                    </Badge>
                  ))}
                  {selectedResult.roots.slice(0, 3).map((root) => (
                    <Badge
                      key={`analysis-root-${root.key}`}
                      variant="outline"
                      style={{
                        borderColor: getLinguisticToneColor("verb", 0.5),
                        backgroundColor: getLinguisticToneColor("verb", 0.14),
                        color: getLinguisticToneColor("verb"),
                      }}
                    >
                      ROOT: {root.key}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TokenInspector>
      )}
    />
  );
}

function ResultRow({
  entry,
  onShowDetails,
  isSelected,
  compact = false,
  showMorphology = false,
  queryText,
}: {
  entry: SearchResponse["results"][number];
  onShowDetails: (entry: SearchResult) => void;
  isSelected: boolean;
  compact?: boolean;
  showMorphology?: boolean;
  queryText?: string;
}) {
  const location = entry.location.join(":");
  const verseArabicTokens = entry.verseArabicTokens ?? [];
  const hasArabicContext = verseArabicTokens.length > 0;
  const rawMatchedTokenIndex = entry.matchedTokenIndex ?? Math.max(entry.location[2] - 1, 0);
  const matchedTokenIndex = hasArabicContext
    ? Math.min(Math.max(rawMatchedTokenIndex, 0), verseArabicTokens.length - 1)
    : 0;
  const tokenGloss = entry.verseTranslation ? entry.gloss : undefined;
  const translationLine = entry.verseTranslation
    ? getTranslationSnippet(
        entry.verseTranslation,
        queryText,
        tokenGloss,
        compact,
        matchedTokenIndex,
        verseArabicTokens.length,
      )
    : entry.gloss;
  const contextWindow = compact ? 2 : 4;
  const contextStart = hasArabicContext ? Math.max(matchedTokenIndex - contextWindow, 0) : 0;
  const contextEnd = hasArabicContext
    ? Math.min(matchedTokenIndex + contextWindow + 1, verseArabicTokens.length)
    : 0;
  const contextTokens = hasArabicContext ? verseArabicTokens.slice(contextStart, contextEnd) : [entry.tokenArabic];

  return (
    <div
      id={toSearchResultId(entry.location)}
      className={cn(
        "rounded-md border border-border/90 bg-background p-3",
        compact && "border-dashed p-2",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {location}
          </Badge>
          <span className="font-arabic text-xl leading-none">{entry.tokenArabic}</span>
          <span className="text-sm text-foreground/80">{entry.phonetic}</span>
          {entry.lemmas.map((lemma, index) => (
            <Badge
              key={`top-lemma-${location}-${lemma.key}-${index}`}
              variant="outline"
              className="whitespace-nowrap"
              style={{
                borderColor: getLinguisticToneColor("noun", 0.5),
                backgroundColor: getLinguisticToneColor("noun", 0.14),
                color: getLinguisticToneColor("noun"),
              }}
            >
              LEM: {lemma.key}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onShowDetails(entry)}
          >
            Details
          </Button>
        </div>
      </div>
      <div className="mt-2 rounded-md border border-border/80 bg-card px-2.5 py-2">
        <p dir="rtl" className="font-arabic text-right text-xl leading-relaxed text-pretty">
          {hasArabicContext && contextStart > 0 && (
            <span className="px-1 text-muted-foreground/80">…</span>
          )}
          {contextTokens.map((token, index) => {
            const absoluteIndex = hasArabicContext ? contextStart + index : index;
            const isMatch = absoluteIndex === matchedTokenIndex;

            return (
              <span
                key={`${location}-context-${absoluteIndex}`}
                className={cn(
                  "mx-0.5 inline-block rounded px-1 py-0.5",
                  isMatch
                    ? "bg-sky-500/20 text-sky-700 dark:bg-sky-400/25 dark:text-sky-200"
                    : "text-foreground",
                )}
              >
                {token}
              </span>
            );
          })}
          {hasArabicContext && contextEnd < verseArabicTokens.length && (
            <span className="px-1 text-muted-foreground/80">…</span>
          )}
        </p>
      </div>
      <p className="mt-2 text-sm text-foreground/85 text-pretty">
        {highlightTranslation(translationLine, queryText, tokenGloss)}
      </p>
      {showMorphology && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">POS: {entry.posTags.join(", ") || "-"}</p>
          {entry.morphology.length > 0 && (
            <p className="text-xs text-muted-foreground text-pretty">
              Morphology: {entry.morphology.slice(0, 4).join(" | ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function highlightWithTerm(value: string, term: string | undefined, keyPrefix: string): ReactNode | null {
  const normalizedTerm = term?.trim();
  if (!normalizedTerm || normalizedTerm.length < 2) {
    return null;
  }

  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escapedTerm})`, "ig");
  const parts = value.split(matcher);

  if (parts.length <= 1) {
    return null;
  }

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedTerm.toLowerCase()) {
      return (
        <mark
          key={`${keyPrefix}-match-${index}`}
          className="rounded-sm px-0.5"
          style={{
            backgroundColor: getLinguisticToneColor("verb", 0.2),
            color: getLinguisticToneColor("verb"),
          }}
        >
          {part}
        </mark>
      );
    }

    return <span key={`${keyPrefix}-plain-${index}`}>{part}</span>;
  });
}

function highlightTranslation(
  value: string,
  query: string | undefined,
  tokenGloss: string | undefined,
): ReactNode {
  const glossHighlight = highlightWithTerm(value, tokenGloss, "gloss");
  if (glossHighlight) {
    return glossHighlight;
  }

  const queryHighlight = highlightWithTerm(value, query, "query");
  return queryHighlight ?? value;
}

function getTranslationSnippet(
  value: string,
  query: string | undefined,
  tokenGloss: string | undefined,
  compact: boolean,
  matchedTokenIndex: number,
  arabicTokenCount: number,
): string {
  const anchorHint =
    arabicTokenCount > 1 ? Math.min(Math.max(matchedTokenIndex / (arabicTokenCount - 1), 0), 1) : 0.5;
  const focusTerm = getTranslationFocusTerm(value, query, tokenGloss);
  const wordWindow = compact ? 10 : 14;
  const fallbackAnchor = Math.round(anchorHint * Math.max(0, value.length - 1));

  if (!focusTerm) {
    return clipByWordWindow(value, fallbackAnchor, wordWindow);
  }

  const matchIndices = getMatchIndicesIgnoreCase(value, focusTerm);
  if (matchIndices.length === 0) {
    return clipByWordWindow(value, fallbackAnchor, wordWindow);
  }

  const matchIndex = getClosestIndexByRatio(value.length, matchIndices, anchorHint);
  return clipByWordWindow(value, matchIndex, wordWindow);
}

function getTranslationFocusTerm(
  value: string,
  query: string | undefined,
  tokenGloss: string | undefined,
): string | undefined {
  const candidates = [tokenGloss, query];
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized || normalized.length < 2) {
      continue;
    }
    if (indexOfIgnoreCase(value, normalized) >= 0) {
      return normalized;
    }
  }

  return undefined;
}

function indexOfIgnoreCase(value: string, needle: string): number {
  return value.toLowerCase().indexOf(needle.toLowerCase());
}

function getMatchIndicesIgnoreCase(value: string, needle: string): number[] {
  const source = value.toLowerCase();
  const term = needle.toLowerCase();
  const indices: number[] = [];
  let searchStart = 0;

  while (searchStart < source.length) {
    const index = source.indexOf(term, searchStart);
    if (index < 0) {
      break;
    }
    indices.push(index);
    searchStart = index + Math.max(1, term.length);
  }

  return indices;
}

function getClosestIndexByRatio(
  textLength: number,
  indices: number[],
  targetRatio: number,
): number {
  const denominator = Math.max(1, textLength - 1);
  let bestIndex = indices[0] ?? 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const index of indices) {
    const ratio = index / denominator;
    const delta = Math.abs(ratio - targetRatio);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function clipByWordWindow(value: string, anchorIndex: number, window: number): string {
  const matcher = /\S+/g;
  const ranges: Array<{ word: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    const word = match[0];
    const start = match.index;
    ranges.push({
      word,
      start,
      end: start + word.length,
    });
  }

  if (ranges.length === 0) {
    return value;
  }

  if (ranges.length <= window * 2 + 2) {
    return value;
  }

  let anchorWord = ranges.findIndex((range) => anchorIndex >= range.start && anchorIndex < range.end);
  if (anchorWord < 0) {
    anchorWord = 0;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i]!.start >= anchorIndex) {
        anchorWord = i;
        break;
      }
    }
  }

  const startWord = Math.max(0, anchorWord - window);
  const endWord = Math.min(ranges.length, anchorWord + window + 1);
  let snippet = ranges
    .slice(startWord, endWord)
    .map((range) => range.word)
    .join(" ")
    .trim();

  if (startWord > 0) {
    snippet = `… ${snippet}`;
  }
  if (endWord < ranges.length) {
    snippet = `${snippet} …`;
  }

  return snippet;
}
