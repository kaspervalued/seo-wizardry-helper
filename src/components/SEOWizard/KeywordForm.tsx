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

interface KeywordFormProps {
  onSubmit: (data: {
    keyword: string;
    country: string;
    language: string;
  }) => void;
}

export const KeywordForm = ({ onSubmit }: KeywordFormProps) => {
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keyword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a focus keyword",
        variant: "destructive",
      });
      return;
    }
    
    if (!country) {
      toast({
        title: "Error",
        description: "Please select a country",
        variant: "destructive",
      });
      return;
    }
    
    if (!language) {
      toast({
        title: "Error",
        description: "Please select a language",
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

      <Button type="submit" className="w-full">
        Proceed to Analysis
      </Button>
    </form>
  );
};