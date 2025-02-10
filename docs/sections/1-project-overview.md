
# 1. Project Overview

## Project Information
- **Name**: SEO Content Wizard
- **Purpose**: Advanced content analysis and optimization tool for SEO professionals
- **Core Objectives**:
  - Analyze competing articles for SEO performance
  - Generate optimized content outlines
  - Provide actionable SEO recommendations
  - Extract and rank relevant keywords
  - Identify valuable external links

## Target Users/Audience
- Content Writers
- SEO Specialists
- Digital Marketing Professionals
- Content Strategists
- Website Owners

## Key Features and Functionality
1. **Article Analysis**
   - Word count and readability metrics
   - Heading structure analysis
   - External link extraction
   - Meta description evaluation
   - Key phrase identification

2. **Content Optimization**
   - AI-powered outline generation
   - Keyword density analysis
   - Competitor benchmarking
   - SEO-optimized title suggestions
   - Meta description recommendations

3. **Multi-Step Wizard Interface**
   - Progressive content analysis workflow
   - Interactive article selection
   - Real-time analysis feedback
   - Visual progress tracking
   - Error handling and recovery

## Technical Architecture

### Frontend Architecture
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Query (Tanstack Query)
- **Routing**: React Router DOM

### Backend Architecture
- **Platform**: Supabase Edge Functions
- **Runtime**: Deno
- **Database**: PostgreSQL (Supabase)
- **APIs Integration**:
  - OpenAI GPT-4
  - Diffbot Article Extraction
  - SerpAPI Search Results

### External Services
1. **OpenAI Integration**
   - Model: gpt-4-1106-preview
   - Usage: Content analysis and generation

2. **Diffbot Integration**
   - Service: Article API
   - Usage: Web content extraction

3. **SerpAPI Integration**
   - Service: Search Results API
   - Usage: Meta description retrieval

## Dependencies and System Requirements

### Core Dependencies
```json
{
  "@tanstack/react-query": "^5.56.2",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "@supabase/supabase-js": "^2.48.1",
  "tailwindcss": "latest",
  "typescript": "latest"
}
```

### System Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v7.0.0 or higher
- **Memory**: 4GB RAM minimum
- **Storage**: 1GB available space
- **Browser Support**: 
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+

### Development Tools
- TypeScript 5.0+
- Git
- Code Editor (VS Code recommended)
- Node.js runtime
- npm package manager
