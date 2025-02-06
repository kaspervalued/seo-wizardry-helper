import { useWizard } from "@/contexts/WizardContext";
import { WizardProgress } from "./WizardProgress";
import { KeywordForm } from "./KeywordForm";
import { ArticleList } from "./ArticleList";
import { AnalysisReport } from "./AnalysisReport";
import { OutlineEditor } from "./OutlineEditor";
import { WizardLoading } from "./WizardLoading";
import { WizardError } from "./WizardError";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { Article } from "@/types/seo";

const TOTAL_STEPS = 7;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export const WizardContainer = () => {
  const {
    currentStep,
    setCurrentStep,
    setKeyword,
    setCountry,
    setLanguage,
    setArticles,
    setSelectedArticles,
    setAnalyses,
    setIdealStructure,
    setIsAnalyzing,
    setAnalysisStatus,
    setError,
    isAnalyzing,
    analysisStatus,
    error,
    articles,
    analyses,
    idealStructure,
    keyword
  } = useWizard();
  
  const { toast } = useToast();

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const invokeAnalysisFunction = async (articles: Article[], keyword: string, retryCount = 0) => {
    if (!articles?.length || !keyword) {
      throw new Error('Please select at least one article and provide a keyword');
    }

    try {
      const { data, error: functionError } = await supabase.functions.invoke('analyze-articles', {
        body: { 
          urls: articles.map(article => article.url),
          keyword: keyword
        }
      });

      if (functionError) throw new Error(functionError.message || 'Failed to analyze articles');
      if (!data) throw new Error('No data received from analysis');

      return data;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY * (retryCount + 1));
        return invokeAnalysisFunction(articles, keyword, retryCount + 1);
      }
      throw error;
    }
  };

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
    if (!selected?.length) {
      toast({
        title: "Selection Error",
        description: "Please select at least one article to analyze",
        variant: "destructive",
      });
      return;
    }

    const articlesToAnalyze = [...selected];
    const currentKeyword = keyword;

    setSelectedArticles(articlesToAnalyze);
    setError(null);
    setIsAnalyzing(true);
    setCurrentStep(3);
    
    try {
      setAnalysisStatus("Fetching article contents... (This might take 1-2 minutes)\nDon't close this tab, we're analyzing everything in detail!");
      
      const data = await invokeAnalysisFunction(articlesToAnalyze, currentKeyword);

      setAnalyses(data.analyses);
      setIdealStructure(data.idealStructure);
      setCurrentStep(4);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to analyze articles');
      toast({
        title: "Analysis Error",
        description: "Failed to analyze the selected articles. Please try again in a few moments.",
        variant: "destructive",
      });
      setCurrentStep(2);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus("");
    }
  };

  const handleError = () => {
    setError(null);
    setCurrentStep(2);
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

          {currentStep === 3 && isAnalyzing && <WizardLoading status={analysisStatus} />}

          {error && <WizardError error={error} onRetry={handleError} />}

          {currentStep === 4 && idealStructure && !error && (
            <AnalysisReport
              analyses={analyses}
              idealStructure={idealStructure}
              onProceed={() => setCurrentStep(5)}
            />
          )}

          {currentStep === 5 && idealStructure && !error && (
            <OutlineEditor
              analyses={analyses}
              idealStructure={idealStructure}
              onProceed={() => setCurrentStep(6)}
            />
          )}
        </div>
      </div>
    </div>
  );
};