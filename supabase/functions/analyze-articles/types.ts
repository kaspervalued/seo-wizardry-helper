export interface ArticleContent {
  title: string;
  url: string;
  domain: string;
  text: string;
  html: string;
  meta: {
    title: string;
    description: string;
  };
  images: Array<{
    url: string;
    title?: string;
  }>;
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
  recommendedKeywords: Array<{ text: string; frequency: number }>;
  recommendedExternalLinks: ExternalLink[];
  suggestedTitles: string[];
  suggestedDescriptions: string[];
}