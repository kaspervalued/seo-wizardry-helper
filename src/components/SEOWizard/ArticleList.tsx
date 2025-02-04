import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Article } from "@/types/seo";

interface ArticleListProps {
  articles: Article[];
  onSubmit: (selectedArticles: Article[]) => void;
}

export const ArticleList = ({ articles, onSubmit }: ArticleListProps) => {
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const { toast } = useToast();

  const handleToggleArticle = (article: Article) => {
    setSelectedArticles((prev) => {
      const isSelected = prev.some((a) => a.url === article.url);
      if (isSelected) {
        return prev.filter((a) => a.url !== article.url);
      }
      if (prev.length >= 5) {
        toast({
          title: "Maximum Selection Reached",
          description: "You can select up to 5 articles",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, article];
    });
  };

  const handleSubmit = () => {
    if (selectedArticles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one article",
        variant: "destructive",
      });
      return;
    }
    onSubmit(selectedArticles);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="space-y-4">
            {articles.map((article, index) => (
              <div
                key={article.url}
                className="flex items-start space-x-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Checkbox
                  checked={selectedArticles.some((a) => a.url === article.url)}
                  onCheckedChange={() => handleToggleArticle(article)}
                />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-sm text-primary">
                    Rank #{index + 1}
                  </p>
                  <h3 className="font-medium">{article.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {article.snippet}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {article.url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {selectedArticles.length}/5 articles selected
        </p>
        <Button onClick={handleSubmit}>Analyze Selected Articles</Button>
      </div>
    </div>
  );
};