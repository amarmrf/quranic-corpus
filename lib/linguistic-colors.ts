export type LinguisticTone = "noun" | "verb" | "particle" | "pronoun" | "other";

const toneVariables: Record<LinguisticTone, string> = {
  noun: "--ling-noun",
  verb: "--ling-verb",
  particle: "--ling-particle",
  pronoun: "--ling-pronoun",
  other: "--ling-other",
};

export const LINGUISTIC_LEGEND: ReadonlyArray<{ tone: LinguisticTone; label: string }> = [
  { tone: "noun", label: "Noun" },
  { tone: "verb", label: "Verb" },
  { tone: "particle", label: "Particle" },
  { tone: "pronoun", label: "Pronoun" },
  { tone: "other", label: "Other" },
];

const nounPattern = /^(N|PN|ADJ|NOUN|NSUFF|PROPN)|SUBJ|OBJ|PRED|MUBTADA|KHABAR/i;
const verbPattern = /^(V|IV|PV|CV|VN|VERB)|IMPV|PERF|IMPF/i;
const particlePattern = /^(P|PREP|CONJ|PART|NEG|DET|INTG|SUB)|COORD|LINK|ACC|GEN/i;
const pronounPattern = /PRON|DEM|REL/i;

export function getLinguisticTone(tag?: string | null): LinguisticTone {
  if (tag == null || tag.trim().length === 0) {
    return "other";
  }

  if (verbPattern.test(tag)) {
    return "verb";
  }
  if (nounPattern.test(tag)) {
    return "noun";
  }
  if (particlePattern.test(tag)) {
    return "particle";
  }
  if (pronounPattern.test(tag)) {
    return "pronoun";
  }
  return "other";
}

export function getLinguisticToneColor(tone: LinguisticTone, alpha = 1): string {
  return `hsl(var(${toneVariables[tone]}) / ${alpha})`;
}

export function getLinguisticColor(tag?: string | null, alpha = 1): string {
  return getLinguisticToneColor(getLinguisticTone(tag), alpha);
}
