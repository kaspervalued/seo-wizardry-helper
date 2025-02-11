
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
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

const ContentStatusBadge = ({ status }: { status: 'success' | 'error' }) => {
  const variants = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={variants[status]} variant="secondary">
      {status === 'success' ? 'Content Available' : 'Content Unavailable'}
    </Badge>
  );
};

export const AnalysisReport = ({
  analyses,
  idealStructure,
  onProceed,
}: AnalysisReportProps) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Separate SERP results from manually added URLs
  const serpResults = analyses.filter(analysis => !analysis.url.includes('youtu') && !analysis.url.includes('reddit'));
  const manuallyAddedUrls = analyses.filter(analysis => analysis.url.includes('youtu') || analysis.url.includes('reddit'));

  const isContentAvailable = (analysis: ArticleAnalysis) => {
    const type = getContentType(analysis.url);
    if (type === 'youtube') {
      return analysis.transcript && analysis.transcript.length > 50;
    }
    if (type === 'reddit') {
      return analysis.content && analysis.content.length > 50;
    }
    return true;
  };

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
          {manuallyAddedUrls.map((analysis, index) => {
            const type = getContentType(analysis.url);
            const contentAvailable = isContentAvailable(analysis);

            return (
              <div key={index} className="mb-6 last:mb-0">
                <div className="flex items-center gap-3 mb-3">
                  <ContentTypeBadge type={type} />
                  <ContentStatusBadge status={contentAvailable ? 'success' : 'error'} />
                </div>

                {!contentAvailable && (
                  <Alert variant="warning" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {type === 'youtube' 
                        ? "Could not retrieve video transcript. The content shown is limited to basic video information."
                        : "Could not access the Reddit post content. This might be due to the post being private or deleted."}
                    </AlertDescription>
                  </Alert>
                )}

                <Accordion type="single" collapsible>
                  <AccordionItem value={`manual-${index}`}>
                    <AccordionTrigger className="text-left">
                      {analysis.title || analysis.url}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ArticleAnalysisContent analysis={analysis} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onProceed}>Proceed to Next Step</Button>
      </div>
    </div>
  );
};
