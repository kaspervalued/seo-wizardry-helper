import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  GripVertical,
  Pencil, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Check,
  X
} from "lucide-react";
import { ArticleAnalysis, IdealStructure, OutlineHeading } from "@/types/seo";
import { useToast } from "@/components/ui/use-toast";

interface OutlineEditorProps {
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure;
  onProceed: () => void;
}

export const OutlineEditor = ({
  analyses,
  idealStructure,
  onProceed,
}: OutlineEditorProps) => {
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [generationStep, setGenerationStep] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    generateOutline();
  }, []);

  const generateOutline = async () => {
    try {
      // This will be implemented in the edge function
      setGenerationStep(1);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating analysis
      setGenerationStep(2);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating ideal outline
      setGenerationStep(3);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating master outline
      
      // Temporary mock data
      setHeadings([
        {
          id: "1",
          level: "h2",
          text: "Introduction",
          children: [
            { id: "1.1", level: "h3", text: "What is SAST?" },
            { id: "1.2", level: "h3", text: "Why is Security Testing Important?" }
          ]
        },
        {
          id: "2",
          level: "h2",
          text: "Understanding SAST",
          children: [
            { id: "2.1", level: "h3", text: "How SAST Works" },
            { id: "2.2", level: "h3", text: "Key Features and Benefits" }
          ]
        }
      ]);
      setIsGenerating(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate outline. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const addHeading = (level: 'h2' | 'h3', parentId?: string) => {
    const newHeading: OutlineHeading = {
      id: Date.now().toString(),
      level,
      text: "New Heading",
    };

    if (!parentId) {
      setHeadings([...headings, newHeading]);
    } else {
      setHeadings(prevHeadings => {
        const updateChildren = (heading: OutlineHeading): OutlineHeading => {
          if (heading.id === parentId) {
            return {
              ...heading,
              children: [...(heading.children || []), newHeading]
            };
          }
          if (heading.children) {
            return {
              ...heading,
              children: heading.children.map(updateChildren)
            };
          }
          return heading;
        };
        return prevHeadings.map(updateChildren);
      });
    }
  };

  const startEditing = (heading: OutlineHeading) => {
    setEditingId(heading.id);
    setEditText(heading.text);
  };

  const saveEditing = () => {
    if (!editingId) return;

    setHeadings(prevHeadings => {
      const updateHeading = (heading: OutlineHeading): OutlineHeading => {
        if (heading.id === editingId) {
          return { ...heading, text: editText };
        }
        if (heading.children) {
          return {
            ...heading,
            children: heading.children.map(updateHeading)
          };
        }
        return heading;
      };
      return prevHeadings.map(updateHeading);
    });

    setEditingId(null);
    setEditText("");
  };

  const toggleLevel = (headingId: string) => {
    setHeadings(prevHeadings => {
      const updateHeading = (heading: OutlineHeading): OutlineHeading => {
        if (heading.id === headingId) {
          return {
            ...heading,
            level: heading.level === 'h2' ? 'h3' : 'h2'
          };
        }
        if (heading.children) {
          return {
            ...heading,
            children: heading.children.map(updateHeading)
          };
        }
        return heading;
      };
      return prevHeadings.map(updateHeading);
    });
  };

  const deleteHeading = (headingId: string) => {
    setHeadings(prevHeadings => {
      const filterHeadings = (headings: OutlineHeading[]): OutlineHeading[] => {
        return headings
          .filter(h => h.id !== headingId)
          .map(h => ({
            ...h,
            children: h.children ? filterHeadings(h.children) : undefined
          }));
      };
      return filterHeadings(prevHeadings);
    });
  };

  const renderHeading = (heading: OutlineHeading, depth = 0) => (
    <div
      key={heading.id}
      className={`flex items-center gap-2 py-2 ${
        depth > 0 ? 'ml-6' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 text-gray-400" />
      
      {editingId === heading.id ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={saveEditing}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditingId(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium flex-1">{heading.text}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleLevel(heading.id)}
          >
            {heading.level === 'h2' ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => startEditing(heading)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteHeading(heading.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {heading.level === 'h2' && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => addHeading('h3', heading.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );

  if (isGenerating) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4 min-h-[400px]">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-lg font-medium">Generating Perfect Outline</p>
          <p className="text-sm text-muted-foreground">
            {generationStep === 1 && "Analyzing top-ranking articles..."}
            {generationStep === 2 && "Creating SEO-optimized outline..."}
            {generationStep === 3 && "Finalizing master outline..."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Article Outline</h3>
          <Button 
            variant="outline"
            onClick={() => addHeading('h2')}
          >
            Add H2
          </Button>
        </div>

        <ScrollArea className="h-[500px] rounded-md">
          <div className="space-y-1">
            {headings.map(heading => (
              <div key={heading.id}>
                {renderHeading(heading)}
                {heading.children?.map(child => renderHeading(child, 1))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onProceed}>
          Proceed to Next Step
        </Button>
      </div>
    </div>
  );
};
