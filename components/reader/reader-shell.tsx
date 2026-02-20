"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Layers3,
  Loader2,
  Moon,
  Search,
  Sun,
  Target,
} from "lucide-react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTheme } from "@/hooks/use-theme";
import { getMetadata, getMorphology, getWordMorphology } from "@/lib/api";
import {
  LINGUISTIC_LEGEND,
  getLinguisticColor,
  getLinguisticToneColor,
} from "@/lib/linguistic-colors";
import {
  isTokenLocation,
  normalizeVerseLocation,
  parseLocation,
  toTokenId,
  toVerseId,
} from "@/lib/location";
import type { Chapter, Token, Verse, WordMorphology } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const WINDOW_SIZE = 8;

type Props = {
  locationParam: string;
};

function getArabicToken(token: Token) {
  return token.segments
    .map((segment) => segment.arabic ?? "")
    .join("")
    .trim();
}

function getVerseBoundaries(verses: Verse[], fallbackVerse: number) {
  if (verses.length === 0) {
    return { firstVerse: fallbackVerse, lastVerse: fallbackVerse };
  }

  return {
    firstVerse: verses[0].location[1] ?? fallbackVerse,
    lastVerse: verses[verses.length - 1].location[1] ?? fallbackVerse,
  };
}

function toArabicNumber(value: number) {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(value)
    .split("")
    .map((digit) => digits[Number(digit)] ?? digit)
    .join("");
}

function getFilteredTokenStyle(posTag: string | undefined, highlighted: boolean, selected: boolean) {
  if (!highlighted || selected) {
    return undefined;
  }

  return {
    borderColor: getLinguisticColor(posTag, 0.55),
    backgroundColor: getLinguisticColor(posTag, 0.14),
  };
}

export function ReaderShell({ locationParam }: Props) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [metadata, setMetadata] = useState<{
    chapters: Chapter[];
    translations: { key: string; name: string }[];
  } | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [verses, setVerses] = useState<Verse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const [selectedToken, setSelectedToken] = useState<[number, number, number] | null>(null);
  const [wordMorphology, setWordMorphology] = useState<WordMorphology | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTranslations, setSelectedTranslations] = useLocalStorage<string[]>(
    "qc.reader.translations",
    [],
  );
  const [selectedPosTags, setSelectedPosTags] = useLocalStorage<string[]>(
    "qc.reader.pos-filters",
    [],
  );
  const [showPhonetic, setShowPhonetic] = useLocalStorage<boolean>(
    "qc.reader.show-phonetic",
    true,
  );
  const [showTranslations, setShowTranslations] = useLocalStorage<boolean>(
    "qc.reader.show-translations",
    true,
  );
  const [readerView, setReaderView] = useLocalStorage<boolean>(
    "qc.reader.reader-view",
    false,
  );
  const [showHeaderStats, setShowHeaderStats] = useLocalStorage<boolean>(
    "qc.reader.show-header-stats",
    false,
  );

  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const initialAnchorRef = useRef<string>("");
  const readerSessionIdRef = useRef(0);
  const versesRef = useRef<Verse[]>([]);

  const parsedLocation = useMemo(() => parseLocation(locationParam), [locationParam]);

  const [chapterNumber, verseNumber] = useMemo(
    () => normalizeVerseLocation(parsedLocation),
    [parsedLocation],
  );
  const initialTokenSelection = useMemo<[number, number, number] | null>(() => {
    if (!isTokenLocation(parsedLocation)) {
      return null;
    }

    const [tokenChapter, tokenVerse, tokenNumber] = parsedLocation;
    if (tokenChapter !== chapterNumber || tokenVerse !== verseNumber || tokenNumber < 1) {
      return null;
    }

    return [tokenChapter, tokenVerse, tokenNumber];
  }, [chapterNumber, parsedLocation, verseNumber]);

  const activeChapter = useMemo(
    () => metadata?.chapters.find((chapter) => chapter.chapterNumber === chapterNumber),
    [chapterNumber, metadata],
  );

  const verseBoundaries = useMemo(
    () => getVerseBoundaries(verses, verseNumber),
    [verseNumber, verses],
  );
  const showChapterOpeningLine = verses.length > 0 && verseBoundaries.firstVerse === 1;
  const hasBismillah = chapterNumber !== 9;

  const availablePosTags = useMemo(
    () =>
      Array.from(
        new Set(
          verses.flatMap((verse) =>
            verse.tokens.flatMap((token) => token.segments.map((segment) => segment.posTag)),
          ),
        ),
      ).sort(),
    [verses],
  );

  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const hasActiveTokenFilter = normalizedSearch.length > 0 || selectedPosTags.length > 0;
  const selectedTranslationNames = useMemo(() => {
    if (!metadata) {
      return [];
    }

    return selectedTranslations
      .map((key) => metadata.translations.find((translation) => translation.key === key)?.name)
      .filter((name): name is string => Boolean(name));
  }, [metadata, selectedTranslations]);
  const selectedTranslationsLabel = useMemo(() => {
    if (selectedTranslationNames.length === 0) {
      return "Translations";
    }

    const visibleNames = selectedTranslationNames.slice(0, 2).join(", ");
    const remainingCount = selectedTranslationNames.length - 2;
    return remainingCount > 0 ? `${visibleNames}, +${remainingCount}` : visibleNames;
  }, [selectedTranslationNames]);

  const isTokenVisible = useCallback(
    (token: Token) => {
      const matchesPos =
        selectedPosTags.length === 0 ||
        token.segments.some((segment) => selectedPosTags.includes(segment.posTag));
      const matchesSearch =
        normalizedSearch.length === 0 ||
        token.translation.toLowerCase().includes(normalizedSearch) ||
        token.phonetic.toLowerCase().includes(normalizedSearch);
      return matchesPos && matchesSearch;
    },
    [normalizedSearch, selectedPosTags],
  );

  const tokenStats = useMemo(() => {
    const totalTokens = verses.reduce((total, verse) => total + verse.tokens.length, 0);
    const visibleTokens = verses.reduce(
      (total, verse) => total + verse.tokens.filter((token) => isTokenVisible(token)).length,
      0,
    );
    return { totalTokens, visibleTokens };
  }, [isTokenVisible, verses]);

  const loadMetadata = useCallback(async () => {
    try {
      setMetadataError(null);
      const nextMetadata = await getMetadata();
      setMetadata(nextMetadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load metadata.";
      setMetadataError(message);
    }
  }, []);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (!metadata || metadata.translations.length === 0) {
      return;
    }

    const valid = selectedTranslations.filter((key) =>
      metadata.translations.some((translation) => translation.key === key),
    );

    if (valid.length === 0) {
      setSelectedTranslations([metadata.translations[0].key]);
      return;
    }

    if (valid.length !== selectedTranslations.length) {
      setSelectedTranslations(valid);
    }
  }, [metadata, selectedTranslations, setSelectedTranslations]);

  useEffect(() => {
    if (!metadata) {
      return;
    }

    const validTags = selectedPosTags.filter((tag) => availablePosTags.includes(tag));
    if (validTags.length !== selectedPosTags.length) {
      setSelectedPosTags(validTags);
    }
  }, [availablePosTags, metadata, selectedPosTags, setSelectedPosTags]);

  const initializeReader = useCallback(async () => {
    if (!metadata || !activeChapter || selectedTranslations.length === 0) {
      return;
    }

    const sessionId = readerSessionIdRef.current + 1;
    readerSessionIdRef.current = sessionId;

    setReaderError(null);
    setInitialLoading(true);
    setWordMorphology(null);
    setSelectedToken(null);

    try {
      const initialVerses = await getMorphology({
        chapterNumber,
        startVerse: verseNumber,
        count: WINDOW_SIZE,
        translations: selectedTranslations,
      });

      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      const { firstVerse, lastVerse } = getVerseBoundaries(initialVerses, verseNumber);

      setVerses(initialVerses);
      setHasPrevious(firstVerse > 1);
      setHasNext(lastVerse < activeChapter.verseCount);
      if (initialTokenSelection) {
        setSelectedToken(initialTokenSelection);
      }
    } catch (error) {
      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to load verses.";
      setReaderError(message);
      setVerses([]);
      setHasPrevious(false);
      setHasNext(false);
    } finally {
      if (sessionId === readerSessionIdRef.current) {
        setInitialLoading(false);
      }
    }
  }, [
    activeChapter,
    chapterNumber,
    initialTokenSelection,
    metadata,
    selectedTranslations,
    verseNumber,
  ]);

  useEffect(() => {
    void initializeReader();
  }, [initializeReader]);

  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  useEffect(() => {
    if (initialLoading || verses.length === 0) {
      return;
    }

    const anchorKey = `${chapterNumber}:${verseNumber}`;
    if (initialAnchorRef.current === anchorKey) {
      return;
    }

    const anchorElement = document.getElementById(toVerseId(chapterNumber, verseNumber));
    if (!anchorElement) {
      return;
    }

    anchorElement.scrollIntoView({ block: "center", behavior: "auto" });
    initialAnchorRef.current = anchorKey;
  }, [chapterNumber, initialLoading, verseNumber, verses.length]);

  const loadPreviousVerses = useCallback(async () => {
    if (
      !activeChapter ||
      initialLoading ||
      loadingPrevious ||
      verses.length === 0 ||
      !hasPrevious ||
      selectedTranslations.length === 0
    ) {
      return;
    }

    const sessionId = readerSessionIdRef.current;
    setLoadingPrevious(true);
    setReaderError(null);

    try {
      const firstVerse = versesRef.current[0]?.location[1] ?? 1;
      const count = Math.min(WINDOW_SIZE, firstVerse - 1);

      if (count <= 0) {
        setHasPrevious(false);
        return;
      }

      const previousVerses = await getMorphology({
        chapterNumber,
        startVerse: firstVerse - count,
        count,
        translations: selectedTranslations,
      });

      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      if (previousVerses.length === 0) {
        setHasPrevious(false);
        return;
      }

      const mergedVerses = [...previousVerses, ...versesRef.current];
      const { firstVerse: mergedFirstVerse, lastVerse: mergedLastVerse } = getVerseBoundaries(
        mergedVerses,
        verseNumber,
      );

      setVerses(mergedVerses);
      setHasPrevious(mergedFirstVerse > 1);
      setHasNext(mergedLastVerse < activeChapter.verseCount);
    } catch (error) {
      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to load previous verses.";
      setReaderError(message);
    } finally {
      if (sessionId === readerSessionIdRef.current) {
        setLoadingPrevious(false);
      }
    }
  }, [
    activeChapter,
    chapterNumber,
    hasPrevious,
    initialLoading,
    loadingPrevious,
    selectedTranslations,
    verseNumber,
    verses,
  ]);

  const loadNextVerses = useCallback(async () => {
    if (
      !activeChapter ||
      initialLoading ||
      loadingNext ||
      verses.length === 0 ||
      !hasNext ||
      selectedTranslations.length === 0
    ) {
      return;
    }

    const sessionId = readerSessionIdRef.current;
    setLoadingNext(true);
    setReaderError(null);

    try {
      const lastVerse =
        versesRef.current[versesRef.current.length - 1]?.location[1] ?? activeChapter.verseCount;
      const remaining = activeChapter.verseCount - lastVerse;
      const count = Math.min(WINDOW_SIZE, remaining);

      if (count <= 0) {
        setHasNext(false);
        return;
      }

      const nextVerses = await getMorphology({
        chapterNumber,
        startVerse: lastVerse + 1,
        count,
        translations: selectedTranslations,
      });

      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      if (nextVerses.length === 0) {
        setHasNext(false);
        return;
      }

      const mergedVerses = [...versesRef.current, ...nextVerses];
      const { firstVerse: mergedFirstVerse, lastVerse: mergedLastVerse } = getVerseBoundaries(
        mergedVerses,
        verseNumber,
      );

      setVerses(mergedVerses);
      setHasPrevious(mergedFirstVerse > 1);
      setHasNext(mergedLastVerse < activeChapter.verseCount);
    } catch (error) {
      if (sessionId !== readerSessionIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to load more verses.";
      setReaderError(message);
    } finally {
      if (sessionId === readerSessionIdRef.current) {
        setLoadingNext(false);
      }
    }
  }, [
    activeChapter,
    chapterNumber,
    hasNext,
    initialLoading,
    loadingNext,
    selectedTranslations,
    verseNumber,
    verses,
  ]);

  useEffect(() => {
    if (!bottomSentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadNextVerses();
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(bottomSentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loadNextVerses]);

  useEffect(() => {
    if (!selectedToken) {
      setWordMorphology(null);
      setWordError(null);
      return;
    }

    let active = true;

    const run = async () => {
      setWordLoading(true);
      setWordError(null);
      try {
        const result = await getWordMorphology(selectedToken);
        if (active) {
          setWordMorphology(result);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load token analysis.";
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
  }, [selectedToken]);

  const navigateToVerse = useCallback(
    (nextChapter: number, nextVerse: number) => {
      router.push(`/reader/${nextChapter}:${nextVerse}`);
    },
    [router],
  );

  const chapterIndex = useMemo(
    () => metadata?.chapters.findIndex((chapter) => chapter.chapterNumber === chapterNumber) ?? -1,
    [chapterNumber, metadata],
  );

  const canNavigatePreviousVerse = chapterIndex > 0 || verseNumber > 1;
  const canNavigateNextVerse =
    activeChapter != null &&
    (verseNumber < activeChapter.verseCount ||
      (metadata != null && chapterIndex >= 0 && chapterIndex < metadata.chapters.length - 1));

  const goToPreviousVerse = useCallback(() => {
    if (!metadata || chapterIndex < 0) {
      return;
    }

    if (verseNumber > 1) {
      navigateToVerse(chapterNumber, verseNumber - 1);
      return;
    }

    if (chapterIndex > 0) {
      const previousChapter = metadata.chapters[chapterIndex - 1];
      navigateToVerse(previousChapter.chapterNumber, previousChapter.verseCount);
    }
  }, [chapterIndex, chapterNumber, metadata, navigateToVerse, verseNumber]);

  const goToNextVerse = useCallback(() => {
    if (!metadata || chapterIndex < 0 || !activeChapter) {
      return;
    }

    if (verseNumber < activeChapter.verseCount) {
      navigateToVerse(chapterNumber, verseNumber + 1);
      return;
    }

    if (chapterIndex < metadata.chapters.length - 1) {
      const nextChapter = metadata.chapters[chapterIndex + 1];
      navigateToVerse(nextChapter.chapterNumber, 1);
    }
  }, [activeChapter, chapterIndex, chapterNumber, metadata, navigateToVerse, verseNumber]);

  const toggleTranslation = useCallback(
    (translationKey: string) => {
      if (!metadata) {
        return;
      }

      setTranslationError(null);

      if (selectedTranslations.includes(translationKey)) {
        if (selectedTranslations.length === 1) {
          setTranslationError("At least one translation must remain active.");
          return;
        }

        setSelectedTranslations(selectedTranslations.filter((entry) => entry !== translationKey));
        return;
      }

      const nextSet = new Set([...selectedTranslations, translationKey]);
      const ordered = metadata.translations
        .map((translation) => translation.key)
        .filter((key) => nextSet.has(key));
      setSelectedTranslations(ordered);
    },
    [metadata, selectedTranslations, setSelectedTranslations],
  );

  const selectedTokenData = useMemo(() => {
    if (!selectedToken) {
      return null;
    }

    for (const verse of verses) {
      const match = verse.tokens.find(
        (token) =>
          token.location[0] === selectedToken[0] &&
          token.location[1] === selectedToken[1] &&
          token.location[2] === selectedToken[2],
      );

      if (match) {
        return match;
      }
    }

    return null;
  }, [selectedToken, verses]);
  const loadedTokenLocations = useMemo<[number, number, number][]>(
    () =>
      verses.flatMap((verse) =>
        verse.tokens.map((token) => token.location as [number, number, number]),
      ),
    [verses],
  );
  const selectedTokenIndex = useMemo(() => {
    if (!selectedToken) {
      return -1;
    }

    return loadedTokenLocations.findIndex(
      (tokenLocation) =>
        tokenLocation[0] === selectedToken[0] &&
        tokenLocation[1] === selectedToken[1] &&
        tokenLocation[2] === selectedToken[2],
    );
  }, [loadedTokenLocations, selectedToken]);
  const canSelectPreviousToken = selectedTokenIndex > 0;
  const canSelectNextToken =
    selectedTokenIndex >= 0 && selectedTokenIndex < loadedTokenLocations.length - 1;

  const selectedTokenArabic = useMemo(() => {
    if (selectedTokenData) {
      return getArabicToken(selectedTokenData);
    }

    if (wordMorphology?.token) {
      return getArabicToken(wordMorphology.token);
    }

    return "";
  }, [selectedTokenData, wordMorphology]);

  const selectedTokenGloss =
    selectedTokenData?.translation || wordMorphology?.token.translation || "No gloss available.";
  const selectedTokenPhonetic = selectedTokenData?.phonetic || wordMorphology?.token.phonetic || "";

  const jumpToSelectedToken = useCallback(() => {
    if (!selectedToken) {
      return;
    }

    const tokenElement = document.getElementById(toTokenId(selectedToken));
    tokenElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedToken]);
  const selectPreviousToken = useCallback(() => {
    if (!canSelectPreviousToken) {
      return;
    }

    const previousToken = loadedTokenLocations[selectedTokenIndex - 1];
    if (previousToken) {
      setSelectedToken(previousToken);
    }
  }, [canSelectPreviousToken, loadedTokenLocations, selectedTokenIndex]);
  const selectNextToken = useCallback(() => {
    if (!canSelectNextToken) {
      return;
    }

    const nextToken = loadedTokenLocations[selectedTokenIndex + 1];
    if (nextToken) {
      setSelectedToken(nextToken);
    }
  }, [canSelectNextToken, loadedTokenLocations, selectedTokenIndex]);

  const headerApi = "/api/quranic";

  return (
    <WorkbenchShell
      title="Quranic Corpus Reader"
      description="Console-style study surface for token-level morphology and verse navigation."
      leftLabel="Navigation & Filters"
      mainLabel="Reader Stream"
      rightLabel="Token Inspector"
      rightContentClassName="lg:overflow-visible"
      actions={(
        <>
          <Badge variant="secondary" className="hidden tabular-nums sm:inline-flex">
            API proxy: {headerApi}
          </Badge>
          <Button type="button" variant="outline" onClick={() => router.push("/search")}>
            <Search className="size-4" aria-hidden="true" />
            <span className="sm:hidden">Search</span>
            <span className="hidden sm:inline">Search tools</span>
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
            <CardTitle className="text-base text-balance">Session controls</CardTitle>
            <CardDescription className="text-pretty">
              Keep chapter navigation, translation selection, and token filters docked while reading.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Select
                value={String(chapterNumber)}
                onValueChange={(value) => navigateToVerse(Number(value), 1)}
                disabled={!metadata || metadata.chapters.length === 0}
              >
                <SelectTrigger aria-label="Select chapter" className="truncate">
                  <SelectValue placeholder="Chapter" />
                </SelectTrigger>
                <SelectContent>
                  {metadata?.chapters.map((chapter) => (
                    <SelectItem
                      key={chapter.chapterNumber}
                      value={String(chapter.chapterNumber)}
                      className="tabular-nums"
                    >
                      {chapter.chapterNumber}. {chapter.phonetic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Go to previous verse"
                  onClick={goToPreviousVerse}
                  disabled={!canNavigatePreviousVerse}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Go to next verse"
                  onClick={goToNextVerse}
                  disabled={!canNavigateNextVerse}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Select
                  value={String(verseNumber)}
                  onValueChange={(value) => navigateToVerse(chapterNumber, Number(value))}
                  disabled={!activeChapter}
                >
                  <SelectTrigger aria-label="Select verse" className="tabular-nums">
                    <SelectValue placeholder="#" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeChapter &&
                      Array.from({ length: activeChapter.verseCount }, (_, index) => {
                        const value = index + 1;
                        return (
                          <SelectItem key={value} value={String(value)} className="tabular-nums">
                            {value}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <BookText className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate text-left">{selectedTranslationsLabel}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <span className="text-xs tabular-nums">({selectedTranslations.length})</span>
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72" align="start">
                  <DropdownMenuLabel>Active translations</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {metadata?.translations.map((translation) => (
                    <DropdownMenuCheckboxItem
                      key={translation.key}
                      checked={selectedTranslations.includes(translation.key)}
                      onCheckedChange={() => toggleTranslation(translation.key)}
                    >
                      {translation.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  aria-label="Search token gloss or transliteration"
                  placeholder="Search token"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Button
                variant={showTranslations ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTranslations((current) => !current)}
                disabled={readerView}
              >
                Translations
              </Button>
              <Button
                variant={showPhonetic ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPhonetic((current) => !current)}
                disabled={readerView}
              >
                Phonetic lines
              </Button>
              <Button
                variant={readerView ? "default" : "outline"}
                size="sm"
                onClick={() => setReaderView((current) => !current)}
              >
                Reader view
              </Button>
              <Button
                variant={showHeaderStats ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHeaderStats((current) => !current)}
              >
                Stats
              </Button>
            </div>

            {availablePosTags.length > 0 && (
              <div className="space-y-2 rounded-md border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">POS filter ({selectedPosTags.length})</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPosTags([])}
                    disabled={selectedPosTags.length === 0}
                  >
                    Clear POS
                  </Button>
                </div>
                <ToggleGroup
                  type="multiple"
                  value={selectedPosTags}
                  onValueChange={setSelectedPosTags}
                  className="flex w-full flex-wrap justify-start"
                >
                  {availablePosTags.map((tag) => (
                    <ToggleGroupItem
                      key={tag}
                      value={tag}
                      variant="outline"
                      size="sm"
                      className="tabular-nums"
                    >
                      {tag}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="space-y-1 rounded-md border border-dashed p-2">
                  <p className="text-xs text-muted-foreground">POS color key</p>
                  <div className="flex flex-wrap gap-1">
                    {LINGUISTIC_LEGEND.map((entry) => (
                      <Badge
                        key={entry.tone}
                        variant="outline"
                        style={{
                          borderColor: getLinguisticToneColor(entry.tone, 0.45),
                          backgroundColor: getLinguisticToneColor(entry.tone, 0.14),
                          color: getLinguisticToneColor(entry.tone),
                        }}
                      >
                        {entry.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {readerView && (
              <p className="text-xs text-muted-foreground text-pretty">
                Reader view mirrors the legacy flow and focuses on Arabic token stream.
              </p>
            )}
            {hasActiveTokenFilter && (
              <p className="text-xs text-muted-foreground text-pretty">
                Highlighted tokens match active POS/search filters. Non-matching tokens are dimmed.
              </p>
            )}

            {translationError && <p className="text-sm text-destructive text-pretty">{translationError}</p>}
            {metadataError && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive text-pretty">{metadataError}</p>
                <Button variant="outline" size="sm" onClick={() => void loadMetadata()}>
                  Retry metadata
                </Button>
              </div>
            )}
            {readerError && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive text-pretty">{readerError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void initializeReader()}
                  disabled={initialLoading}
                >
                  Retry verses
                </Button>
              </div>
            )}

            {showHeaderStats && (
              <div className="grid gap-2">
                <Card className="bg-background/80">
                  <CardContent className="flex items-center gap-2 p-3">
                    <Layers3 className="size-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">Loaded verses</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {verses.length === 0 ? "-" : `${verseBoundaries.firstVerse}-${verseBoundaries.lastVerse}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background/80">
                  <CardContent className="flex items-center gap-2 p-3">
                    <Target className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">Visible tokens</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {tokenStats.visibleTokens}/{tokenStats.totalTokens}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background/80">
                  <CardContent className="flex items-center gap-2 p-3">
                    <Filter className="size-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-muted-foreground">POS filters</p>
                      <p className="text-sm font-semibold tabular-nums">{selectedPosTags.length}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      main={(
        <Card className="bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-balance">Reader stream</CardTitle>
            <CardDescription className="text-pretty">
              Load additional verses while staying anchored to token-level morphology work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPreviousVerses()}
                disabled={initialLoading || loadingPrevious || !hasPrevious}
              >
                {loadingPrevious && <Loader2 className="size-4" aria-hidden="true" />}
                <ChevronUp className="size-4" aria-hidden="true" />
                Load previous verses
              </Button>
              <div className="text-xs text-muted-foreground tabular-nums">
                Chapter {chapterNumber} of {metadata?.chapters.length ?? 114}
              </div>
            </div>

            <Separator />

            {initialLoading ? (
              <VerseSkeletonList />
            ) : (
              <div className="space-y-3">
                {showChapterOpeningLine && (
                  <div className="rounded-md border border-dashed px-4 py-3">
                    {hasBismillah ? (
                      <div className="space-y-1">
                        <p dir="rtl" className="font-arabic text-3xl leading-none text-center">
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center text-pretty">
                        No Bismillah for this surah (At-Tawbah).
                      </p>
                    )}
                  </div>
                )}

                {readerView ? (
                  <ReaderVerseStream
                    verses={verses}
                    selectedToken={selectedToken}
                    isTokenVisible={isTokenVisible}
                    hasActiveTokenFilter={hasActiveTokenFilter}
                    onSelectToken={setSelectedToken}
                  />
                ) : (
                  <div className="space-y-3">
                    {verses.map((verse) => {
                      const [chapter, verseNo] = verse.location;

                      return (
                        <Card
                          key={`${chapter}:${verseNo}`}
                          id={toVerseId(chapter, verseNo)}
                          className="border-dashed bg-background/80"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-sm font-semibold tabular-nums">
                                {chapter}:{verseNo}
                              </CardTitle>
                              <div className="flex items-center gap-1">
                                {verse.verseMark && (
                                  <Badge variant="secondary" className="tabular-nums">
                                    {verse.verseMark}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="tabular-nums">
                                  {verse.tokens.length} tokens
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div dir="rtl" className="flex flex-wrap justify-start gap-2">
                              {verse.tokens.map((token) => {
                                const arabicToken = getArabicToken(token);
                                const tokenLocation = token.location as [number, number, number];
                                const posTag = token.segments[0]?.posTag;
                                const selected =
                                  selectedToken?.[0] === tokenLocation[0] &&
                                  selectedToken?.[1] === tokenLocation[1] &&
                                  selectedToken?.[2] === tokenLocation[2];
                                const isVisible = isTokenVisible(token);
                                const shouldDim = !isVisible && !selected;
                                const tokenHighlightStyle = getFilteredTokenStyle(
                                  posTag,
                                  hasActiveTokenFilter && isVisible,
                                  selected,
                                );

                                return (
                                  <button
                                    key={token.location.join(":")}
                                    id={toTokenId(tokenLocation)}
                                    type="button"
                                    onClick={() => setSelectedToken(tokenLocation)}
                                    className={cn(
                                      "flex min-w-16 flex-col items-end rounded-md border px-2 py-1.5 text-right shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                      "gap-1",
                                      selected
                                        ? "border-primary bg-primary/20 ring-2 ring-primary/60 ring-offset-1 ring-offset-background"
                                        : "border-border bg-background hover:bg-accent",
                                      shouldDim && "opacity-30",
                                    )}
                                    style={tokenHighlightStyle}
                                  >
                                    <span className="font-arabic text-2xl leading-none">
                                      {arabicToken.length > 0 ? arabicToken : token.translation}
                                    </span>
                                    {showPhonetic && (
                                      <span className="max-w-40 truncate text-[11px] text-muted-foreground">
                                        {token.phonetic}
                                      </span>
                                    )}
                                    {showTranslations && (
                                      <span className="max-w-40 truncate text-[11px] text-muted-foreground">
                                        {token.translation}
                                      </span>
                                    )}
                                    <span
                                      className="text-[10px] font-semibold tabular-nums"
                                      style={{ color: getLinguisticColor(posTag) }}
                                    >
                                      {posTag ?? "-"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {showTranslations && verse.translations && verse.translations.length > 0 && (
                              <div className="space-y-2">
                                <Separator />
                                <div className="space-y-1.5">
                                  {verse.translations.map((translation) => (
                                    <p key={translation.name} className="text-sm text-pretty">
                                      <span className="font-semibold">{translation.name}:</span>{" "}
                                      {translation.translation}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div ref={bottomSentinelRef} className="h-1" />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadNextVerses()}
                disabled={initialLoading || loadingNext || !hasNext}
              >
                {loadingNext && <Loader2 className="size-4" aria-hidden="true" />}
                <ChevronDown className="size-4" aria-hidden="true" />
                Load next verses
              </Button>
              {!hasNext && !initialLoading && (
                <p className="text-xs text-muted-foreground text-pretty">
                  End of chapter reached. Change chapter or verse anchor to continue.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      right={(
        <div className="lg:sticky lg:top-0">
          <Card className="bg-card/90 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-hidden">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base text-balance">Token details</CardTitle>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Select previous token"
                    onClick={selectPreviousToken}
                    disabled={!canSelectPreviousToken}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Select next token"
                    onClick={selectNextToken}
                    disabled={!canSelectNextToken}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={jumpToSelectedToken}
                  disabled={!selectedToken}
                >
                  Show token
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
              {!selectedToken && (
                <div className="space-y-3 rounded-md border border-dashed p-4">
                  <p className="text-sm text-muted-foreground text-pretty">
                    No token selected. Select a highlighted token in the reader to start analysis.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const candidate = verses[0]?.tokens[0]?.location as
                        | [number, number, number]
                        | undefined;
                      if (candidate) {
                        setSelectedToken(candidate);
                      }
                    }}
                    disabled={verses.length === 0}
                  >
                    Select first loaded token
                  </Button>
                </div>
              )}

              {selectedToken && (
                <div className="space-y-3">
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Selected location</p>
                        <p className="text-sm font-semibold tabular-nums">{selectedToken.join(":")}</p>
                      </div>
                      {selectedTokenData && (
                        <Badge variant="outline" className="tabular-nums">
                          {selectedTokenData.segments.length} segments
                        </Badge>
                      )}
                    </div>
                    {selectedTokenArabic.length > 0 && (
                      <p className="font-arabic text-2xl leading-none">{selectedTokenArabic}</p>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground text-pretty">{selectedTokenGloss}</p>
                      {selectedTokenPhonetic.length > 0 && (
                        <p className="text-xs text-muted-foreground text-pretty">{selectedTokenPhonetic}</p>
                      )}
                    </div>
                  </div>

                  {wordError && (
                    <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                      <p className="text-sm text-destructive text-pretty">{wordError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedToken) {
                            setSelectedToken([...selectedToken] as [number, number, number]);
                          }
                        }}
                      >
                        Retry analysis
                      </Button>
                    </div>
                  )}

                  {wordLoading && <WordSkeleton />}

                  {!wordLoading && wordMorphology && (
                    <div className="overflow-hidden rounded-md border">
                      <section className="space-y-1.5 p-3">
                        <p className="text-xs text-muted-foreground">Summary</p>
                        <p className="text-sm text-pretty">{wordMorphology.summary}</p>
                      </section>
                      <Separator />
                      <section className="space-y-1.5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">Segments</p>
                          <Badge variant="outline" className="tabular-nums">
                            {wordMorphology.segmentDescriptions.length}
                          </Badge>
                        </div>
                        {wordMorphology.segmentDescriptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-pretty">
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
                        <p className="text-xs text-muted-foreground">Arabic grammar</p>
                        <p className="text-sm text-pretty">{wordMorphology.arabicGrammar}</p>
                      </section>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    />
  );
}

type ReaderVerseStreamProps = {
  verses: Verse[];
  selectedToken: [number, number, number] | null;
  isTokenVisible: (token: Token) => boolean;
  hasActiveTokenFilter: boolean;
  onSelectToken: (tokenLocation: [number, number, number]) => void;
};

function ReaderVerseStream({
  verses,
  selectedToken,
  isTokenVisible,
  hasActiveTokenFilter,
  onSelectToken,
}: ReaderVerseStreamProps) {
  return (
    <div dir="rtl" className="rounded-md border border-dashed p-4">
      <div className="flex flex-wrap items-end justify-start gap-x-2 gap-y-3">
        {verses.map((verse) => {
          const [chapter, verseNo] = verse.location as [number, number];
          return (
            <div
              key={`${chapter}:${verseNo}`}
              id={toVerseId(chapter, verseNo)}
              className="inline-flex flex-wrap items-end gap-1"
            >
              {verse.verseMark === "section" && (
                <span className="font-arabic text-3xl leading-none text-muted-foreground">۞</span>
              )}
              {verse.tokens.map((token) => {
                const tokenLocation = token.location as [number, number, number];
                const posTag = token.segments[0]?.posTag;
                const selected =
                  selectedToken?.[0] === tokenLocation[0] &&
                  selectedToken?.[1] === tokenLocation[1] &&
                  selectedToken?.[2] === tokenLocation[2];
                const isVisible = isTokenVisible(token);
                const shouldDim = !isVisible && !selected;
                const arabicToken = getArabicToken(token);
                const tokenHighlightStyle = getFilteredTokenStyle(
                  posTag,
                  hasActiveTokenFilter && isVisible,
                  selected,
                );

                return (
                  <button
                    key={token.location.join(":")}
                    id={toTokenId(tokenLocation)}
                    type="button"
                    onClick={() => onSelectToken(tokenLocation)}
                    aria-label={`Token ${tokenLocation.join(":")} ${token.translation}`}
                    className={cn(
                      "rounded-sm border border-transparent px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary bg-primary/20 ring-2 ring-primary/60 ring-offset-1 ring-offset-background"
                        : "hover:bg-accent",
                      shouldDim && "opacity-30",
                    )}
                    style={tokenHighlightStyle}
                  >
                    <span className="font-arabic text-3xl leading-none">
                      {arabicToken.length > 0 ? arabicToken : token.translation}
                    </span>
                  </button>
                );
              })}
              {verse.verseMark === "sajdah" && (
                <span className="font-arabic text-3xl leading-none text-muted-foreground">۩</span>
              )}
              <span
                className="font-arabic text-2xl leading-none"
                style={{ color: getLinguisticToneColor("particle", 0.9) }}
              >
                {toArabicNumber(verseNo)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerseSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, tokenIndex) => (
                <Skeleton key={tokenIndex} className="h-16 w-16 rounded-md" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WordSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
