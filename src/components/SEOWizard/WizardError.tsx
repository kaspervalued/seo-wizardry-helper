import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface WizardErrorProps {
  error: string;
  onRetry: () => void;
}

export const WizardError = ({ error, onRetry }: WizardErrorProps) => {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h3 className="text-lg font-semibold">Analysis Failed</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={onRetry} variant="outline">
          Try Again
        </Button>
      </div>
    </Card>
  );
};