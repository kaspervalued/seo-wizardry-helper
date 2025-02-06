export interface Article {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface HeadingStructure {
  level: string;
  text: string;
}

export interface ExternalLink {
  url: string;
  text: string;
  domain: string;
  frequency?: number;
}

export interface KeywordWithFrequency {
  text: string;
  frequency: number;
}

export interface ArticleAnalysis {
  title: string;
  url: string;
  domain: string;
  wordCount: number;
  characterCount: number;
  headingsCount: number;
  paragraphsCount: number;
  imagesCount: number;
  videosCount: number;
  externalLinks: ExternalLink[];
  externalLinksCount: number;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  readabilityScore: number;
  headingStructure: HeadingStructure[];
  error?: string;
}

export interface IdealStructure {
  targetWordCount: number;
  recommendedKeywords: KeywordWithFrequency[];
  recommendedExternalLinks: ExternalLink[];
  suggestedTitles: string[];
  suggestedDescriptions: string[];
}