
# 5. User Interface Elements

## Component Hierarchy

```
SEOWizard
├── WizardProgress
├── KeywordForm
├── ArticleList
│   ├── ArticleCard
│   └── SelectionControls
├── AnalysisReport
│   ├── MetricsDisplay
│   └── RecommendationsList
└── OutlineEditor
    ├── HeadingStructure
    └── ContentSuggestions
```

## Style Guide

### 1. Colors
```typescript
const colors = {
  primary: {
    DEFAULT: 'rgb(var(--primary))',
    foreground: 'rgb(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'rgb(var(--secondary))',
    foreground: 'rgb(var(--secondary-foreground))',
  },
  background: 'rgb(var(--background))',
  foreground: 'rgb(var(--foreground))',
  muted: {
    DEFAULT: 'rgb(var(--muted))',
    foreground: 'rgb(var(--muted-foreground))',
  },
};
```

### 2. Typography
```typescript
const typography = {
  fontFamily: {
    sans: ['Inter', 'sans-serif'],
    mono: ['Roboto Mono', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
  },
};
```

### 3. Spacing
```typescript
const spacing = {
  px: '1px',
  0: '0px',
  0.5: '0.125rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
};
```

## Responsive Design Specifications

### 1. Breakpoints
```typescript
const screens = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
```

### 2. Grid System
```typescript
const grid = {
  container: {
    center: true,
    padding: {
      DEFAULT: '1rem',
      sm: '2rem',
      lg: '4rem',
      xl: '5rem',
      '2xl': '6rem',
    },
  },
};
```

## Component Specifications

### 1. WizardProgress
```typescript
interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}
```

### 2. KeywordForm
```typescript
interface KeywordFormProps {
  onSubmit: (data: {
    keyword: string;
    country: string;
    language: string;
    articles: Article[];
  }) => void;
}
```

### 3. ArticleList
```typescript
interface ArticleListProps {
  articles: Article[];
  onSubmit: (selectedArticles: Article[]) => void;
}
```

## Accessibility Considerations

### 1. ARIA Attributes
```typescript
const ariaLabels = {
  wizard: 'SEO Content Wizard',
  progress: 'Analysis Progress',
  form: 'Keyword Analysis Form',
  articleList: 'Competitor Articles List',
  results: 'Analysis Results',
};
```

### 2. Keyboard Navigation
- Tab index management
- Focus indicators
- Skip links
- Keyboard shortcuts

### 3. Screen Reader Support
- Descriptive alt text
- ARIA landmarks
- Semantic HTML
- Status announcements

## Animation Specifications

### 1. Transitions
```typescript
const transitions = {
  DEFAULT: 'all 0.15s ease',
  slow: 'all 0.3s ease',
  fast: 'all 0.1s ease',
};
```

### 2. Animations
```typescript
const animations = {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  'fade-in': 'fade-in 0.3s ease-out',
  'fade-out': 'fade-out 0.3s ease-out',
};
```

## Error States

### 1. Form Validation
```typescript
interface ValidationError {
  type: 'required' | 'format' | 'server';
  message: string;
  field?: string;
}
```

### 2. Loading States
```typescript
interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}
```
