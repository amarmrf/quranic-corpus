export type Location = number[];

export type Chapter = {
  chapterNumber: number;
  verseCount: number;
  translation: string;
  phonetic: string;
  city: string;
};

export type Translation = {
  key: string;
  name: string;
};

export type Segment = {
  arabic?: string;
  posTag: string;
  pronounType?: string;
  morphology?: string;
};

export type Token = {
  location: Location;
  translation: string;
  phonetic: string;
  segments: Segment[];
};

export type VerseTranslation = {
  name: string;
  translation: string;
};

export type VerseMark = "section" | "sajdah";

export type Verse = {
  location: Location;
  tokens: Token[];
  translations: VerseTranslation[] | null;
  verseMark?: VerseMark;
};

export type WordMorphology = {
  token: Token;
  summary: string;
  segmentDescriptions: string[];
  arabicGrammar: string;
};

export type SyntaxWordType = "token" | "elided";

export type SyntaxWord = {
  type: SyntaxWordType;
  token: Token | null;
  elidedText: string | null;
  elidedPosTag: string | null;
  startNode: number;
  endNode: number;
};

export type SyntaxEdge = {
  startNode: number;
  endNode: number;
  dependencyTag: string;
};

export type SyntaxPhraseNode = {
  startNode: number;
  endNode: number;
  phraseTag: string;
};

export type GraphLocation = {
  location: [number, number];
  graphNumber: number;
};

export type SyntaxGraph = {
  graphNumber: number;
  graphCount: number;
  legacyCorpusGraphNumber: number;
  prev: GraphLocation | null;
  next: GraphLocation | null;
  words: SyntaxWord[];
  edges: SyntaxEdge[];
  phraseNodes: SyntaxPhraseNode[] | null;
};

export type Metadata = {
  chapters: Chapter[];
  translations: Translation[];
};

export type SearchMode = "surface" | "lemma" | "root" | "translation" | "morpheme";
export type SearchSort = "relevance" | "location";
export type SearchGroupBy = "none" | "lemma" | "root";
export type MorphemeSegmentType = "prefix" | "stem" | "suffix";

export type LexemeRef = {
  key: string;
  arabic: string;
};

export type SearchQuery = {
  q: string;
  mode: SearchMode;
  translation: string;
  chapter: number | null;
  from: string | null;
  to: string | null;
  exact: boolean;
  diacritics: boolean;
  limit: number;
  offset: number;
  sort: SearchSort;
  groupBy: SearchGroupBy;
  segmentType: MorphemeSegmentType | null;
  pos: string | null;
  lemma: string | null;
  root: string | null;
  feature: string | null;
};

export type SearchResult = {
  location: [number, number, number];
  verseLocation: [number, number];
  tokenArabic: string;
  verseArabicTokens?: string[];
  matchedTokenIndex?: number;
  phonetic: string;
  gloss: string;
  lemmas: LexemeRef[];
  roots: LexemeRef[];
  posTags: string[];
  morphology: string[];
  verseTranslation: string | null;
  matchField: string;
  matchedSegmentIndex: number | null;
  matchedSegmentType: MorphemeSegmentType | null;
  matchedSegmentArabic: string | null;
  matchedMorphemeTag: string | null;
};

export type SearchResponse = {
  query: SearchQuery;
  total: number;
  tookMs: number;
  results: SearchResult[];
};

export type DictionaryEntry = {
  key: string;
  arabic: string;
  type: "lemma" | "root";
  occurrences: number;
  formsCount: number;
  glosses: string[];
  sample: SearchResult[];
};

export type DictionaryResponse = {
  query: SearchQuery;
  totalEntries: number;
  tookMs: number;
  entries: DictionaryEntry[];
};

export type ConcordanceGroup = {
  key: string;
  arabic: string;
  type: "lemma" | "root";
  count: number;
  glosses: string[];
  occurrences: SearchResult[];
  occurrencesTruncated: boolean;
};

export type ConcordanceResponse = {
  query: SearchQuery;
  totalGroups: number;
  totalOccurrences: number;
  tookMs: number;
  groups: ConcordanceGroup[];
  results: SearchResult[];
};

export type SearchRequest = {
  q: string;
  mode?: SearchMode;
  translation?: string;
  chapter?: number;
  from?: string;
  to?: string;
  exact?: boolean;
  diacritics?: boolean;
  limit?: number;
  offset?: number;
  sort?: SearchSort;
  groupBy?: SearchGroupBy;
  segmentType?: MorphemeSegmentType;
  pos?: string;
  lemma?: string;
  root?: string;
  feature?: string;
};

export type ConcordanceRequest = SearchRequest & {
  occurrenceLimit?: number;
};

export type DictionaryIndexType = "lemma" | "root";

export type DictionaryIndexEntry = {
  key: string;
  arabic: string;
  type: DictionaryIndexType;
  count: number;
};

export type DictionaryIndexResponse = {
  type: DictionaryIndexType;
  startsWith: string | null;
  contains: string | null;
  total: number;
  tookMs: number;
  entries: DictionaryIndexEntry[];
};
