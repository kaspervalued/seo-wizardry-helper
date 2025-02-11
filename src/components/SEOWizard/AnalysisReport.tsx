
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

export const AnalysisReport = ({
  analyses,
  idealStructure,
  onProceed,
}: AnalysisReportProps) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Separate analyses by content type
  const searchResults = analyses.filter(a => a.source === "search");
  const manualUrls = analyses.filter(a => a.source === "manual");

  return (
    <div className="space-y-8">
      <IdealArticleCard idealStructure={idealStructure} />

      {searchResults.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Search Results Analysis</h3>
          <Accordion type="single" collapsible>
            {searchResults.map((analysis, index) => (
              <AccordionItem key={index} value={`search-${index}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <span>Article #{index + 1}: {analysis.title}</span>
                    <Badge variant="outline" className="ml-2">
                      {analysis.contentType || "article"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ArticleAnalysisContent analysis={analysis} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      {manualUrls.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Manual URL Analysis</h3>
          <Accordion type="single" collapsible>
            {manualUrls.map((analysis, index) => (
              <AccordionItem key={index} value={`manual-${index}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <span>{analysis.title}</span>
                    <Badge variant="secondary" className="ml-2">
                      {analysis.contentType || "article"}
                    </Badge>
                  </div>
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
