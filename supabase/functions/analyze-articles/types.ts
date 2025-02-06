export interface Article {
  title: string;
  url: string;
  snippet: string;
  rank: number;
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
  externalLinksCount: number;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  externalLinks: {
    url: string;
    text: string;
    domain: string;
  }[];
  headingStructure: {
    level: string;
    text: string;
  }[];
}

export interface IdealStructure {
  targetWordCount: number;
  suggestedTitles: string[];
  suggestedDescriptions: string[];
  recommendedKeywords: {
    text: string;
    frequency: number;
  }[];
  recommendedExternalLinks: {
    url: string;
    text: string;
    domain: string;
    frequency: number;
  }[];
  outline: {
    level: string;
    text: string;
  }[];
}