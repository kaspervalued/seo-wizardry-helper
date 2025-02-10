
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleAnalysis } from "@/types/seo";

interface ArticleAnalysisContentProps {
  analysis: ArticleAnalysis;
}

export const ArticleAnalysisContent = ({ analysis }: ArticleAnalysisContentProps) => {
  return (
    <ScrollArea className="h-[300px] rounded-md">
      <div className="space-y-4 p-4">
        <div>
          <h4 className="font-medium mb-2">Article Information</h4>
          <ul className="space-y-2 text-sm">
            <li>Domain: {analysis.domain}</li>
            <li>
              URL:{" "}
              <a
                href={analysis.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View Article
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2">Content Statistics</h4>
          <ul className="space-y-2 text-sm">
            <li>Word Count: {analysis.wordCount}</li>
            <li>Character Count: {analysis.characterCount}</li>
            <li>Headings: {analysis.headingsCount}</li>
            <li>Paragraphs: {analysis.paragraphsCount}</li>
            <li>Images: {analysis.imagesCount}</li>
            <li>Videos: {analysis.videosCount}</li>
            <li>External Links: {analysis.externalLinksCount}</li>
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2">Meta Information</h4>
          <ul className="space-y-2 text-sm">
            <li>Title: {analysis.metaTitle}</li>
            <li>Description: {analysis.metaDescription}</li>
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2">Key Phrases</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">External Links</h4>
          <ul className="space-y-2 text-sm">
            {analysis.externalLinks.map((link, idx) => (
              <li key={idx}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {link.text || link.domain}
                </a>{" "}
                <span className="text-gray-500">({link.domain})</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2">Heading Structure</h4>
          <ul className="space-y-2 text-sm">
            {analysis.headingStructure.map((heading, idx) => (
              <li
                key={idx}
                className="pl-4"
                style={{
                  marginLeft: `${(parseInt(heading.level.slice(1)) - 1) * 16}px`,
                }}
              >
                <span className="text-gray-500">{heading.level}:</span>{" "}
                {heading.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
};
