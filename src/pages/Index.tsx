import { useState } from "react";
import { WizardProgress } from "@/components/SEOWizard/WizardProgress";
import { KeywordForm } from "@/components/SEOWizard/KeywordForm";
import { ArticleList } from "@/components/SEOWizard/ArticleList";
import { AnalysisReport } from "@/components/SEOWizard/AnalysisReport";
import { supabase } from "@/integrations/supabase/client";
import type { Article, ArticleAnalysis, IdealStructure } from "@/types/seo";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TOTAL_STEPS = 7;

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [analyses, setAnalyses] = useState<ArticleAnalysis[]>([]);
  const [idealStructure, setIdealStructure] = useState<IdealStructure | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const { toast } = useToast();

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
    setIsAnalyzing(true);
    setCurrentStep(3);
    
    try {
      setAnalysisStatus("Fetching article contents... (This might take 1-2 minutes)\nDon't close this tab, we're analyzing everything in detail!");
      const { data, error } = await supabase.functions.invoke('analyze-articles', {
        body: { 
          urls: selected.map(article => article.url),
          keyword: keyword
        }
      });

      if (error) throw error;

      setAnalyses(data.analyses);
      setIdealStructure(data.idealStructure);
      setCurrentStep(4);
    } catch (error) {
      console.error('Error analyzing articles:', error);
      toast({
        title: "Error",
        description: "Failed to analyze the selected articles. Please try again.",
        variant: "destructive",
      });
      setCurrentStep(2);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus("");
    }
  };

  const LoadingState = () => (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="pl-12">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{analysisStatus}</p>
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );

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

          {currentStep === 3 && isAnalyzing && <LoadingState />}

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