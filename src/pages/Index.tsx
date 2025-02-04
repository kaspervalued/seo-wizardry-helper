import { useState } from "react";
import { WizardProgress } from "@/components/SEOWizard/WizardProgress";
import { KeywordForm } from "@/components/SEOWizard/KeywordForm";
import { ArticleList } from "@/components/SEOWizard/ArticleList";
import { AnalysisReport } from "@/components/SEOWizard/AnalysisReport";
import type { Article, ArticleAnalysis, IdealStructure } from "@/types/seo";

const TOTAL_STEPS = 7;

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [analyses, setAnalyses] = useState<ArticleAnalysis[]>([]);
  const [idealStructure, setIdealStructure] = useState<IdealStructure | null>(
    null
  );

  const handleKeywordSubmit = async (data: {
    keyword: string;
    country: string;
    language: string;
    articles: Article[];
  }) => {
    setKeyword(data.keyword);
    setCountry(data.country);
    setLanguage(data.language);
    setArticles(data.articles);
    setCurrentStep(2);
  };

  const handleArticleSelection = async (selected: Article[]) => {
    setSelectedArticles(selected);
    
    // TODO: Implement real article analysis
    // For now, using mock data for analysis
    const mockAnalyses: ArticleAnalysis[] = selected.map((article) => ({
      title: article.title,
      url: article.url,
      wordCount: 1500,
      characterCount: 7500,
      headingsCount: 8,
      paragraphsCount: 12,
      imagesCount: 3,
      videosCount: 1,
      externalLinksCount: 5,
      metaTitle: article.title,
      metaDescription: article.snippet,
      keywords: ["seo", "search engine", "optimization"],
      readabilityScore: 75,
      headingStructure: [
        { level: "h1", text: "Main Title" },
        { level: "h2", text: "First Section" },
        { level: "h3", text: "Subsection" },
      ],
    }));

    const mockIdealStructure: IdealStructure = {
      targetWordCount: 2000,
      targetParagraphCount: 15,
      targetImageCount: 4,
      recommendedHeadingsCount: 10,
      recommendedKeywords: ["seo", "optimization", "guide"],
      suggestedHeadingStructure: [
        { level: "h1", text: "Complete Guide to SEO" },
        { level: "h2", text: "Understanding SEO Basics" },
        { level: "h2", text: "Key Optimization Techniques" },
      ],
    };

    setAnalyses(mockAnalyses);
    setIdealStructure(mockIdealStructure);
    setCurrentStep(4);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          SEO Content Wizard
        </h1>

        <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {currentStep === 1 && <KeywordForm onSubmit={handleKeywordSubmit} />}

          {currentStep === 2 && articles.length > 0 && (
            <ArticleList articles={articles} onSubmit={handleArticleSelection} />
          )}

          {currentStep === 4 && idealStructure && (
            <AnalysisReport
              analyses={analyses}
              idealStructure={idealStructure}
              onProceed={() => setCurrentStep(5)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;