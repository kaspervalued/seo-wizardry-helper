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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OutlineEditorProps {
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure;
  onProceed: () => void;
}

interface SortableHeadingProps {
  heading: OutlineHeading;
  depth?: number;
  onEdit: (heading: OutlineHeading) => void;
  onDelete: (id: string) => void;
  onToggleLevel: (id: string) => void;
  onAddSubheading?: (parentId: string) => void;
}

const SortableHeading = ({ 
  heading,
  depth = 0,
  onEdit,
  onDelete,
  onToggleLevel,
  onAddSubheading
}: SortableHeadingProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: heading.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2 ${depth > 0 ? 'ml-6' : ''}`}
    >
      <div {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
      </div>
      
      <span className="text-sm font-medium flex-1">{heading.text}</span>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onToggleLevel(heading.id)}
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
        onClick={() => onEdit(heading)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onDelete(heading.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {heading.level === 'h2' && onAddSubheading && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onAddSubheading(heading.id)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    generateOutline();
  }, []);

  const generateOutline = async () => {
    try {
      setGenerationStep(1);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (idealStructure?.outline) {
        setHeadings(idealStructure.outline);
      } else {
        throw new Error('No outline data available');
      }
      
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setHeadings((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={headings.map(h => h.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {headings.map(heading => (
                  <div key={heading.id}>
                    {editingId === heading.id ? (
                      <div className="flex items-center gap-2 py-2">
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
                        <SortableHeading
                          heading={heading}
                          onEdit={startEditing}
                          onDelete={deleteHeading}
                          onToggleLevel={toggleLevel}
                          onAddSubheading={heading.level === 'h2' ? (id) => addHeading('h3', id) : undefined}
                        />
                        {heading.children?.map(child => (
                          <SortableHeading
                            key={child.id}
                            heading={child}
                            depth={1}
                            onEdit={startEditing}
                            onDelete={deleteHeading}
                            onToggleLevel={toggleLevel}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
