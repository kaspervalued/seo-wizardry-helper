
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { IdealStructure, KeywordWithFrequency, ExternalLink } from "@/types/seo";

// Helper function to determine keyword priority class based on frequency
const getKeywordPriorityClass = (frequency: number) => {
  if (frequency >= 3) return "bg-blue-800 text-white"; // High priority - dark blue
  if (frequency === 2) return "bg-blue-500 text-white"; // Medium priority - medium blue
  return "bg-blue-200 text-blue-800"; // Low priority - light blue
};

// Helper function to format frequency text
const formatFrequencyText = (frequency: number, totalMentions: number) => {
  const articleText = `${frequency} article${frequency !== 1 ? 's' : ''}`;
  if (totalMentions > frequency) {
    return `Found in ${articleText} (mentioned ${totalMentions} times)`;
  }
  return `Found in ${articleText}`;
};

interface IdealArticleCardProps {
  idealStructure: IdealStructure;
}

export const IdealArticleCard = ({ idealStructure }: IdealArticleCardProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Ideal Article</h3>
      <ScrollArea className="h-[300px] rounded-md">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Target Length</h4>
            <p className="text-sm">
              Recommended word count: {idealStructure.targetWordCount} words
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Suggested Titles</h4>
            <ul className="space-y-2 text-sm">
              {idealStructure.suggestedTitles.map((title, idx) => (
                <li key={idx} className="p-2 bg-gray-50 rounded-md">
                  {title}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Suggested Descriptions</h4>
            <ul className="space-y-2 text-sm">
              {idealStructure.suggestedDescriptions.map((desc, idx) => (
                <li key={idx} className="p-2 bg-gray-50 rounded-md">
                  {desc}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Recommended Key Phrases</h4>
            <div className="flex flex-wrap gap-2">
              {idealStructure.recommendedKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded-full text-xs ${getKeywordPriorityClass(
                    keyword.frequency
                  )}`}
                >
                  {keyword.text}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Recommended External Links</h4>
            <ul className="space-y-2 text-sm">
              {idealStructure.recommendedExternalLinks.map((link, idx) => (
                <li key={idx}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {link.text || link.domain}
                  </a>{" "}
                  <span className="text-gray-500">
                    ({link.domain}) - {formatFrequencyText(link.frequency, link.totalMentions || link.frequency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
};
