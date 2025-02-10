# 2. Component-by-Component Breakdown

## Core Components

### 1. SEOWizard
**Location**: `src/components/SEOWizard/`
**Purpose**: Main wizard container managing the analysis workflow

#### Sub-components:
1. **WizardProgress**
   - **Purpose**: Visual progress indicator
   - **Props**:
     ```typescript
     {
       currentStep: number;
       totalSteps: number;
     }
     ```
   - **State Management**: Local state for step tracking

2. **KeywordForm**
   - **Purpose**: Initial keyword and settings input
   - **Data Model**:
     ```typescript
     interface KeywordFormData {
       keyword: string;
       country: string;
       language: string;
     }
     ```
   - **Validation**: Required fields with format checking

3. **ArticleList**
   - **Purpose**: Display and select competitor articles
   - **Props**:
     ```typescript
     {
       articles: Article[];
       onSubmit: (selectedArticles: Article[]) => void;
     }
     ```
   - **State**: Selected articles tracking

4. **AnalysisReport**
   - **Purpose**: Display article analysis results
   - **Data Model**:
     ```typescript
     interface ArticleAnalysis {
       title: string;
       url: string;
       wordCount: number;
       // ... other metrics
     }
     ```
   - **Dependencies**: OpenAI for content analysis

5. **OutlineEditor**
   - **Purpose**: Edit and customize content outline
   - **Data Model**:
     ```typescript
     interface OutlineHeading {
       id: string;
       level: 'h2' | 'h3';
       text: string;
       children?: OutlineHeading[];
     }
     ```

## Edge Functions

### 1. analyze-articles
**Location**: `supabase/functions/analyze-articles/`
**Purpose**: Process and analyze article content

#### Services:
1. **diffbotService**
   ```typescript
   interface DiffbotArticle {
     title?: string;
     text?: string;
     html?: string;
     meta?: {
       description?: string;
     };
     links?: Array<{ href: string; text: string }>;
   }
   ```

2. **serpApiService**
   - **Purpose**: Fetch search results metadata
   - **Rate Limits**: 100 requests/second

3. **openAiService**
   - **Purpose**: Extract key phrases and generate content
   - **Model**: gpt-4-1106-preview
   - **Rate Limits**: Based on OpenAI tier

## Shared Types
**Location**: `src/types/seo.ts`
```typescript
export interface Article {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface IdealStructure {
  targetWordCount: number;
  recommendedKeywords: KeywordWithFrequency[];
  recommendedExternalLinks: ExternalLink[];
  suggestedTitles: string[];
  suggestedDescriptions: string[];
  outline: OutlineHeading[];
}
```

## Security Measures
1. **API Key Management**
   - Stored securely in Supabase environment
   - No client-side exposure
   - Regular rotation recommended

2. **Request Validation**
   - Input sanitization
   - URL validation
   - Rate limiting implementation

## Performance Considerations
1. **Caching Strategy**
   - React Query for API response caching
   - Memoization of expensive computations
   - Lazy loading of components

2. **Error Handling**
   - Exponential backoff for API retries
   - Graceful degradation
   - User-friendly error messages

3. **Optimization**
   - Code splitting
   - Image optimization
   - Bundle size monitoring
