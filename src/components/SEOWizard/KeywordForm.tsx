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

interface KeywordFormProps {
  onSubmit: (data: {
    keyword: string;
    country: string;
    language: string;
  }) => void;
}

const fetchSerpResults = async (keyword: string) => {
  try {
    const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&location=United States&hl=en&api_key=${process.env.SERPAPI_API_KEY}`);
    if (!response.ok) {
      throw new Error('Failed to fetch SERP results');
    }
    const data = await response.json();
    return data.organic_results || [];
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

  const { data: serpResults, isLoading, error } = useQuery({
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

    onSubmit({ keyword, country, language });
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