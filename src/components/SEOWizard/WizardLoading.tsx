import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface WizardLoadingProps {
  status: string;
}

export const WizardLoading = ({ status }: WizardLoadingProps) => {
  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="pl-12">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{status}</p>
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};