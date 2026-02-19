"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpenText, CircleHelp, Loader2, Moon, Search, Sun } from "lucide-react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTheme } from "@/hooks/use-theme";
import { getConcordance, getDictionary, getDictionaryIndex, getMetadata, getSearch } from "@/lib/api";
import type {
  ConcordanceResponse,
  DictionaryIndexEntry,
  DictionaryIndexType,
  DictionaryResponse,
  SearchGroupBy,
  SearchMode,
  SearchResponse,
  SearchSort,
  Translation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
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
  { value: "surface", label: "Surface / gloss" },
  { value: "lemma", label: "Lemma" },
  { value: "root", label: "Root" },
  { value: "translation", label: "Verse translation" },
];

const SEARCH_EXAMPLE_QUERIES = ["house", "mercy", "forgiveness", "light"] as const;
const DEFAULT_SEARCH_EXAMPLE = SEARCH_EXAMPLE_QUERIES[0];
const DICTIONARY_ROOT_EXAMPLES = ["كتب", "ق د س", "ع ل م"] as const;
const DICTIONARY_LEMMA_EXAMPLES = ["آدم", "البيت", "رحمة"] as const;
const CONCORDANCE_EXAMPLE_QUERIES = ["mercy", "house", "light"] as const;
const DEFAULT_CONCORDANCE_EXAMPLE = CONCORDANCE_EXAMPLE_QUERIES[0];

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "location", label: "Location" },
];

const GROUP_BY_OPTIONS: { value: SearchGroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "lemma", label: "Group by lemma" },
  { value: "root", label: "Group by root" },
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

export function SearchShell() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLElement | null>(null);
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
  const [activeExampleQuery, setActiveExampleQuery] = useState<string | null>(null);

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
  const [activeConcordanceExample, setActiveConcordanceExample] = useState<string | null>(null);

  const [translations, setTranslations] = useState<Translation[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

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

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) {
      return;
    }

    const updateHeaderHeight = () => {
      setHeaderHeight(Math.ceil(headerElement.getBoundingClientRect().height));
    };

    updateHeaderHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateHeaderHeight());
      observer.observe(headerElement);
      window.addEventListener("resize", updateHeaderHeight);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", updateHeaderHeight);
      };
    }

    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  const stickyPaneTop = Math.max(headerHeight + 16, 16);
  const sidePaneVars = useMemo(
    () =>
      ({
        "--search-side-pane-top": `${stickyPaneTop}px`,
      }) as CSSProperties,
    [stickyPaneTop],
  );

  const searchExampleSet = useMemo(
    () => new Set(SEARCH_EXAMPLE_QUERIES.map((query) => query.toLowerCase())),
    [],
  );
  const concordanceExampleSet = useMemo<Set<string>>(
    () => new Set(CONCORDANCE_EXAMPLE_QUERIES),
    [],
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
        if (nextOffset === 0) {
          setActiveExampleQuery(searchExampleSet.has(q.toLowerCase()) ? q : null);
        }

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
      searchExampleSet,
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

  const dictionaryContainsExamples =
    dictionaryType === "root" ? DICTIONARY_ROOT_EXAMPLES : DICTIONARY_LEMMA_EXAMPLES;
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
      setActiveConcordanceExample(concordanceExampleSet.has(q) ? q : null);

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
    concordanceExampleSet,
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

  const canLoadMoreSearch =
    searchData != null && searchData.results.length > 0 && searchData.results.length < searchData.total;

  return (
    <div className="min-h-dvh bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header
        ref={headerRef}
        className="sticky top-0 z-10 border-b bg-background"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="container py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-balance">Search, Dictionary, Concordance</h1>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
                Search is free query. Dictionary is root/lemma-first lookup. Concordance is occurrence listing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/reader/1:1")}>
                <BookOpenText className="size-4" aria-hidden="true" />
                Reader
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
            </div>
          </div>
        </div>
      </header>

      <main className="container py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tool controls</CardTitle>
                <CardDescription>Each tab has its own workflow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="search">Search</TabsTrigger>
                    <TabsTrigger value="dictionary">Dictionary</TabsTrigger>
                    <TabsTrigger value="concordance">Concordance</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Scope and output</p>
                  <div className="grid gap-2 md:grid-cols-3">
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
                    Reset filters
                  </Button>
                </div>

                {showGuide && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    <p className="text-pretty">
                      Search finds matching tokens. Dictionary opens one root/lemma entry. Concordance lists
                      occurrences and contexts.
                    </p>
                    <p className="mt-2 text-pretty">
                      Use chapter scope to narrow context. Use <span className="font-medium text-foreground">Exact</span>
                      {" "}for strict matching and{" "}
                      <span className="font-medium text-foreground">Diacritics</span> when vowel marks matter.
                    </p>
                  </div>
                )}

                {activeTab === "search" && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={searchQuery}
                          onChange={(event) => {
                            setSearchQuery(event.target.value);
                            if (activeExampleQuery) {
                              setActiveExampleQuery(null);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void runSearch(0);
                            }
                          }}
                          placeholder="house, mercy, justice..."
                        />
                      </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void runSearch(0)}
                        disabled={loading || searchQuery.trim().length === 0}
                      >
                        {loading && <Loader2 className="size-4 animate-spin" />}
                        Run search
                      </Button>
                      <span className="text-xs text-muted-foreground">Examples:</span>
                      {SEARCH_EXAMPLE_QUERIES.map((exampleQuery) => (
                        <Button
                          key={exampleQuery}
                          type="button"
                          size="sm"
                          variant={
                            activeExampleQuery?.toLowerCase() === exampleQuery.toLowerCase()
                              ? "default"
                              : "outline"
                          }
                          onClick={() => {
                            setSearchQuery(exampleQuery);
                            void runSearch(0, exampleQuery);
                          }}
                        >
                          {exampleQuery}
                        </Button>
                      ))}
                      {showGuide && (
                        <p className="text-xs text-muted-foreground text-pretty">
                          Example queries: <span className="font-medium text-foreground">house</span>,{" "}
                          <span className="font-medium text-foreground">mercy</span>,{" "}
                          <span className="font-medium text-foreground">justice</span>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "dictionary" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid gap-2 md:grid-cols-2">
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
                          <span className="font-medium text-foreground">All letters</span> shows the broad index
                          (up to 200 rows). Pick one letter first, then filter by text for faster lookup.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span>Examples:</span>
                          {dictionaryContainsExamples.map((example) => (
                            <Button
                              key={example}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setDictionaryContains(example);
                              }}
                            >
                              {example}
                            </Button>
                          ))}
                        </div>
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

                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
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
                      <Button size="sm" variant="outline" onClick={() => void loadDictionaryIndex()} disabled={loading}>
                        Refresh index
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void runDictionary()}
                        disabled={loading || selectedDictionaryEntry.length === 0}
                      >
                        Open entry
                      </Button>
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
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Input
                        value={concordanceQuery}
                        onChange={(event) => {
                          setConcordanceQuery(event.target.value);
                          if (activeConcordanceExample) {
                            setActiveConcordanceExample(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void runConcordance();
                          }
                        }}
                        placeholder="Enter concordance query"
                      />
                      <Select
                        value={concordanceMode}
                        onValueChange={(value) => setConcordanceMode(value as SearchMode)}
                      >
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void runConcordance()}
                        disabled={loading || concordanceQuery.trim().length === 0}
                      >
                        {loading && <Loader2 className="size-4 animate-spin" />}
                        Run concordance
                      </Button>
                      <span className="text-xs text-muted-foreground">Examples:</span>
                      {CONCORDANCE_EXAMPLE_QUERIES.map((exampleQuery) => (
                        <Button
                          key={exampleQuery}
                          type="button"
                          size="sm"
                          variant={activeConcordanceExample === exampleQuery ? "default" : "outline"}
                          onClick={() => {
                            setConcordanceQuery(exampleQuery);
                            void runConcordance(exampleQuery);
                          }}
                        >
                          {exampleQuery}
                        </Button>
                      ))}
                      {showGuide && (
                        <p className="text-xs text-muted-foreground text-pretty">
                          Try grouping by lemma/root after running a query to review clusters quickly.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {metadataError && <p className="text-sm text-destructive">{metadataError}</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Results</CardTitle>
                <CardDescription>
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
                {activeTab === "search" && activeExampleQuery && searchData != null && (
                  <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-pretty">
                    Showing example results for{" "}
                    <span className="font-medium text-foreground">{activeExampleQuery}</span>. Replace the query and
                    run search to explore your own term.
                  </div>
                )}
                {activeTab === "concordance" && activeConcordanceExample && concordanceData != null && (
                  <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-pretty">
                    Showing example concordance for{" "}
                    <span className="font-medium text-foreground">{activeConcordanceExample}</span>. Replace the query
                    to inspect your own term.
                  </div>
                )}

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
                    <ResultRow key={entry.location.join(":")} entry={entry} onOpenReader={router.push} />
                  ))}

                {activeTab === "dictionary" && (
                  <div className="space-y-2">
                    {!dictionaryData && !loading && (
                      <p className="text-sm text-muted-foreground text-pretty">
                        Select a root/lemma from the index, then open the dictionary entry.
                      </p>
                    )}
                    {(dictionaryData?.entries ?? []).map((entry) => (
                      <Card key={`${entry.type}:${entry.key}`} className="border-dashed">
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
                        onOpenReader={router.push}
                        showMorphology
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
                          <ResultRow key={entry.location.join(":")} entry={entry} onOpenReader={router.push} />
                        ))
                      : (concordanceData?.groups ?? []).map((group) => (
                          <Card key={`${group.type}:${group.key}`} className="border-dashed">
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
                                  onOpenReader={router.push}
                                  compact
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
          </section>

          <aside
            className="lg:sticky lg:top-[var(--search-side-pane-top)] lg:self-start"
            style={sidePaneVars}
          >
            <Card className="border-primary/40 bg-primary/10">
              <CardHeader>
                <CardTitle className="text-base text-primary text-balance">Linguistic terms</CardTitle>
                <CardDescription className="text-pretty">
                  Quick definitions for the labels shown in Search, Dictionary, and Concordance results.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {LINGUISTIC_TERMS.map((entry) => (
                    <div key={entry.term} className="rounded-md border border-primary/25 bg-background/80 p-2">
                      <dt className="text-sm font-medium text-foreground">{entry.term}</dt>
                      <dd className="text-xs text-muted-foreground text-pretty">{entry.description}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ResultRow({
  entry,
  onOpenReader,
  compact = false,
  showMorphology = false,
}: {
  entry: SearchResponse["results"][number];
  onOpenReader: (href: string) => void;
  compact?: boolean;
  showMorphology?: boolean;
}) {
  const location = entry.location.join(":");
  const readerHref = `/reader/${entry.verseLocation[0]}:${entry.verseLocation[1]}`;

  return (
    <div className={cn("rounded-md border p-3", compact && "border-dashed p-2")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {location}
          </Badge>
          <span className="font-arabic text-xl leading-none">{entry.tokenArabic}</span>
          <span className="text-sm text-muted-foreground">{entry.phonetic}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onOpenReader(readerHref)}>
          Open in reader
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-1 text-sm text-pretty">{entry.gloss}</p>
      {entry.verseTranslation && (
        <p className="mt-1 text-xs text-muted-foreground text-pretty">{entry.verseTranslation}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {entry.lemmas.slice(0, 3).map((lemma) => (
          <Badge key={`lemma-${lemma.key}`} variant="secondary">
            LEM: {lemma.key}
          </Badge>
        ))}
        {entry.roots.slice(0, 3).map((root) => (
          <Badge key={`root-${root.key}`} variant="secondary">
            ROOT: {root.key}
          </Badge>
        ))}
      </div>
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
