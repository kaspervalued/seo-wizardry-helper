
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleAnalysis, IdealStructure } from "@/types/seo";

interface AnalysisReportProps {
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure;
  onProceed: () => void;
}

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

export const AnalysisReport = ({
  analyses,
  idealStructure,
  onProceed,
}: AnalysisReportProps) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  return (
    <div className="space-y-8">
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
                    className={`px-2 py-1 rounded-full text-xs ${getKeywordPriorityClass(keyword.frequency)}`}
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
                    </a>
                    {" "}
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

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Article Analysis Reports</h3>
        <Accordion type="single" collapsible>
          {analyses.map((analysis, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                Article #{index + 1}: {analysis.title}
              </AccordionTrigger>
              <AccordionContent>
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
                            </a>
                            {" "}
                            <span className="text-gray-500">
                              ({link.domain})
                            </span>
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
                              marginLeft: `${
                                (parseInt(heading.level.slice(1)) - 1) * 16
                              }px`,
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onProceed}>Proceed to Next Step</Button>
      </div>
    </div>
  );
};
