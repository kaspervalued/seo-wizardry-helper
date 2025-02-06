import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Article } from "@/types/seo";
import { supabase } from "@/integrations/supabase/client";

interface KeywordFormProps {
  onSubmit: (data: {
    keyword: string;
    country: string;
    language: string;
    articles: Article[];
  }) => void;
}

interface SerpApiResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

const fetchSerpResults = async (keyword: string): Promise<Article[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-serp', {
      body: { keyword }
    });

    if (error) throw error;

    return (data.organic_results || []).map((result: SerpApiResult) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      rank: result.position
    }));
  } catch (error) {
    console.error('Error fetching SERP results:', error);
    throw error;
  }
};

export const KeywordForm = ({ onSubmit }: KeywordFormProps) => {
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("us"); // Default to United States
  const [language, setLanguage] = useState("en"); // Default to English
  const { toast } = useToast();

  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['serpResults', keyword],
    queryFn: () => fetchSerpResults(keyword),
    enabled: false, // Don't fetch automatically
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keyword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a focus keyword",
        variant: "destructive",
      });
      return;
    }

    // Trigger the query
    const result = await refetch();
    
    if (result.data) {
      onSubmit({ 
        keyword, 
        country, 
        language,
        articles: result.data
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="keyword"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Focus Keyword
        </label>
        <Input
          id="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Enter your main keyword..."
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Country
          </label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Language
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? "Fetching Results..." : "Proceed to Analysis"}
      </Button>

      {error && (
        <p className="text-red-500 text-sm">
          Error fetching search results. Please try again.
        </p>
      )}
    </form>
  );
};