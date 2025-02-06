export interface Article {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface ArticleContent {
  title: string;
  text: string;
  html: string;
  meta: {
    description?: string;
  };
}

export interface AnalysisResult {
  title: string;
  url: string;
  domain: string;
  wordCount: number;
  characterCount: number;
  headingsCount: number;
  paragraphsCount: number;
  imagesCount: number;
  videosCount: number;
  externalLinks: Array<{
    url: string;
    text: string;
    domain: string;
  }>;
  externalLinksCount: number;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  readabilityScore: number;
  headingStructure: Array<{
    level: string;
    text: string;
  }>;
}

export interface IdealStructure {
  targetWordCount: number;
  recommendedKeywords: Array<{
    text: string;
    frequency: number;
  }>;
  recommendedExternalLinks: Array<{
    url: string;
    text: string;
    domain: string;
    frequency: number;
  }>;
  suggestedTitles: string[];
  suggestedDescriptions: string[];
}

export interface AnalysisResponse {
  analyses: AnalysisResult[];
  idealStructure: IdealStructure;
}