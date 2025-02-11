
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleAnalysis, IdealStructure } from "@/types/seo";
import { IdealArticleCard } from "./IdealArticleCard";
import { ArticleAnalysisContent } from "./ArticleAnalysisContent";

interface AnalysisReportProps {
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure;
  onProceed: () => void;
}

const getContentType = (url: string): 'article' | 'reddit' | 'youtube' => {
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('youtu.be') || url.includes('youtube.com')) return 'youtube';
  return 'article';
};

const ContentTypeBadge = ({ type }: { type: 'article' | 'reddit' | 'youtube' }) => {
  const variants = {
    article: 'bg-blue-100 text-blue-800',
    reddit: 'bg-orange-100 text-orange-800',
    youtube: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={variants[type]} variant="secondary">
      {type}
    </Badge>
  );
};

export const AnalysisReport = ({
  analyses,
  idealStructure,
  onProceed,
}: AnalysisReportProps) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  console.log('All analyses:', analyses);

  // Separate SERP results from manually added URLs
  const serpResults = analyses.filter(analysis => !analysis.url.includes('youtu') && !analysis.url.includes('reddit'));
  const manuallyAddedUrls = analyses.filter(analysis => analysis.url.includes('youtu') || analysis.url.includes('reddit'));

  console.log('SERP results:', serpResults);
  console.log('Manually added URLs:', manuallyAddedUrls);

  return (
    <div className="space-y-8">
      <IdealArticleCard idealStructure={idealStructure} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Article Analysis Reports</h3>
        <Accordion type="single" collapsible>
          {serpResults.map((analysis, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                Article #{index + 1}: {analysis.title}
              </AccordionTrigger>
              <AccordionContent>
                <ArticleAnalysisContent analysis={analysis} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      {manuallyAddedUrls.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Manual URL Analysis Reports</h3>
          <Accordion type="single" collapsible>
            {manuallyAddedUrls.map((analysis, index) => (
              <AccordionItem key={index} value={`manual-${index}`}>
                <AccordionTrigger className="text-left flex items-center gap-3">
                  <ContentTypeBadge type={getContentType(analysis.url)} />
                  {analysis.title}
                </AccordionTrigger>
                <AccordionContent>
                  <ArticleAnalysisContent analysis={analysis} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onProceed}>Proceed to Next Step</Button>
      </div>
    </div>
  );
};
