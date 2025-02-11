
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Article } from "@/types/seo";
import { Textarea } from "@/components/ui/textarea";

interface ArticleListProps {
  articles: Article[];
  onSubmit: (selectedArticles: Article[]) => void;
}

export const ArticleList = ({ articles, onSubmit }: ArticleListProps) => {
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [customUrls, setCustomUrls] = useState<string>("");
  const { toast } = useToast();

  const handleToggleArticle = (article: Article) => {
    setSelectedArticles((prev) => {
      const isSelected = prev.some((a) => a.url === article.url);
      if (isSelected) {
        return prev.filter((a) => a.url !== article.url);
      }
      return [...prev, article];
    });
  };

  const handleToggleAll = (checked: boolean) => {
    setSelectedArticles(checked ? [...articles] : []);
  };

  const handleSubmit = async () => {
    const urlsToAdd = customUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url !== '')
      .map((url, index) => ({
        url,
        title: `Custom Article ${index + 1}`,
        snippet: url,
        rank: articles.length + index + 1
      }));

    if (selectedArticles.length === 0 && urlsToAdd.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one article or add custom URLs",
        variant: "destructive",
      });
      return;
    }

    const allArticles = [
      ...selectedArticles,
      ...urlsToAdd.filter(newArticle => 
        !selectedArticles.some(selected => selected.url === newArticle.url)
      )
    ];

    onSubmit(allArticles);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={selectedArticles.length === articles.length}
              onCheckedChange={(checked) => handleToggleAll(checked as boolean)}
            />
            <span className="text-sm font-medium">Select All Articles</span>
          </div>
        </div>
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

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Add Custom URLs</label>
          <Textarea
            placeholder="Enter URLs (one per line)"
            value={customUrls}
            onChange={(e) => setCustomUrls(e.target.value)}
            className="h-32"
          />
          <p className="text-sm text-gray-500">
            Add your own article URLs, one per line
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {selectedArticles.length} articles selected
          {customUrls.split('\n').filter(url => url.trim() !== '').length > 0 && 
            ` + ${customUrls.split('\n').filter(url => url.trim() !== '').length} custom URLs`}
        </p>
        <Button onClick={handleSubmit}>Analyze Selected Articles</Button>
      </div>
    </div>
  );
};
