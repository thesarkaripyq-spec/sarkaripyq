import {
  BookOpenCheck,
  Brain,
  Calculator,
  ClipboardList,
  GraduationCap,
  Globe2,
  Languages,
  Layers,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// Amazon product pages need a real ASIN, which we don't have verified data
// for — a guessed one risks a dead or wrong link. Search-result links don't
// have that problem: they're always valid, and a purchase made after
// clicking one still earns commission under the standard Amazon Associates
// cookie, so this degrades gracefully even before a real tag is configured.
const AFFILIATE_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;

export function amazonSearchLink(query: string): string {
  const params = new URLSearchParams({ k: query });
  if (AFFILIATE_TAG) params.set("tag", AFFILIATE_TAG);
  return `https://www.amazon.in/s?${params.toString()}`;
}

export interface BookRecommendation {
  title: string;
  author: string;
  note: string;
  query: string;
  icon: LucideIcon;
}

export const EXAM_BOOKS: Record<string, BookRecommendation> = {
  cgl: {
    title: "SSC CGL Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Chapter-wise, topic-wise solved papers covering Tier 1 and Tier 2.",
    query: "Kiran SSC CGL Previous Year Papers",
    icon: GraduationCap,
  },
  chsl: {
    title: "SSC CHSL Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Year-wise solved papers for the CHSL Tier 1 exam.",
    query: "Kiran SSC CHSL Previous Year Papers",
    icon: BookOpenCheck,
  },
  mts: {
    title: "SSC MTS Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Full solved papers for the Multi Tasking Staff exam.",
    query: "Kiran SSC MTS Previous Year Papers",
    icon: ClipboardList,
  },
  cpo: {
    title: "SSC CPO Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Solved papers for the Central Police Organization SI exam.",
    query: "Kiran SSC CPO Previous Year Papers",
    icon: Trophy,
  },
  gd: {
    title: "SSC GD Constable Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Solved papers for the GD Constable exam.",
    query: "Kiran SSC GD Constable Previous Year Papers",
    icon: Layers,
  },
  steno: {
    title: "SSC Stenographer Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Solved papers for the Stenographer Grade C & D exam.",
    query: "Kiran SSC Stenographer Previous Year Papers",
    icon: Languages,
  },
  "selection-post": {
    title: "SSC Selection Post Previous Years Solved Papers",
    author: "Kiran Prakashan",
    note: "Solved papers for the Phase Selection Post exam.",
    query: "Kiran SSC Selection Post Previous Year Papers",
    icon: Sparkles,
  },
};

export const CORE_SUBJECT_BOOKS: BookRecommendation[] = [
  {
    title: "Fast Track Objective Arithmetic",
    author: "Rajesh Verma (Arihant)",
    note: "The standard quantitative aptitude reference for SSC exams.",
    query: "Fast Track Objective Arithmetic Rajesh Verma",
    icon: Calculator,
  },
  {
    title: "Advanced Maths for SSC",
    author: "Rakesh Yadav",
    note: "Deeper practice set for the Tier 2 advanced maths section.",
    query: "Rakesh Yadav Advanced Maths SSC",
    icon: Calculator,
  },
  {
    title: "A Modern Approach to Verbal & Non-Verbal Reasoning",
    author: "R.S. Aggarwal",
    note: "The most widely used reasoning book across SSC and banking exams.",
    query: "RS Aggarwal Verbal Non-Verbal Reasoning",
    icon: Brain,
  },
  {
    title: "Objective General English",
    author: "S.P. Bakshi (Arihant)",
    note: "Grammar, vocabulary and comprehension practice for the English section.",
    query: "SP Bakshi Objective General English Arihant",
    icon: Languages,
  },
  {
    title: "Lucent's General Knowledge",
    author: "Lucent Publication",
    note: "The standard general awareness reference for Indian competitive exams.",
    query: "Lucent's General Knowledge",
    icon: Globe2,
  },
];
