export interface Article {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface HeadingStructure {
  level: string; // "h1", "h2", "h3", "h4"
  text: string;
}

export interface ArticleAnalysis {
  title: string;
  url: string;
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
  readabilityScore: number;
  headingStructure: HeadingStructure[];
}

export interface IdealStructure {
  targetWordCount: number;
  targetParagraphCount: number;
  targetImageCount: number;
  recommendedHeadingsCount: number;
  recommendedKeywords: string[];
  suggestedHeadingStructure: HeadingStructure[];
}