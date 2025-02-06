import { createContext, useContext, useState, ReactNode } from "react";
import { Article, ArticleAnalysis, IdealStructure } from "@/types/seo";

interface WizardContextType {
  currentStep: number;
  keyword: string;
  country: string;
  language: string;
  articles: Article[];
  selectedArticles: Article[];
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure | null;
  isAnalyzing: boolean;
  analysisStatus: string;
  error: string | null;
  setCurrentStep: (step: number) => void;
  setKeyword: (keyword: string) => void;
  setCountry: (country: string) => void;
  setLanguage: (language: string) => void;
  setArticles: (articles: Article[]) => void;
  setSelectedArticles: (articles: Article[]) => void;
  setAnalyses: (analyses: ArticleAnalysis[]) => void;
  setIdealStructure: (structure: IdealStructure | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisStatus: (status: string) => void;
  setError: (error: string | null) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
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
  const [error, setError] = useState<string | null>(null);

  const value = {
    currentStep,
    keyword,
    country,
    language,
    articles,
    selectedArticles,
    analyses,
    idealStructure,
    isAnalyzing,
    analysisStatus,
    error,
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
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}