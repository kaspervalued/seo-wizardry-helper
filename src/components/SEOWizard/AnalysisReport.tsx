
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  return (
    <div className="space-y-8">
      <IdealArticleCard idealStructure={idealStructure} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Article Analysis Reports</h3>
        <Accordion type="single" collapsible>
          {analyses.map((analysis, index) => (
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

      <div className="flex justify-end">
        <Button onClick={onProceed}>Proceed to Next Step</Button>
      </div>
    </div>
  );
};
