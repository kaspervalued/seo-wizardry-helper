
# 4. Integration Points

## External System Connections

### 1. OpenAI Integration
```typescript
interface OpenAIConfig {
  model: 'gpt-4-1106-preview';
  temperature: number;
  max_tokens?: number;
}
```

#### Data Flow
1. Content analysis request
2. API processing
3. Response parsing
4. Result integration

#### Rate Limits
- Tokens per minute: Based on tier
- Requests per minute: Tier dependent
- Retry strategy: Exponential backoff

### 2. Diffbot Integration
```typescript
interface DiffbotConfig {
  token: string;
  apiVersion: 'v3';
  endpoint: 'article';
}
```

#### Data Flow
1. URL submission
2. Content extraction
3. Metadata parsing
4. Structure analysis

#### Rate Limits
- Requests per second: 100
- Concurrent requests: 50
- Monthly article limit: Plan dependent

### 3. SerpAPI Integration
```typescript
interface SerpAPIConfig {
  engine: 'google';
  apiKey: string;
  country?: string;
}
```

#### Data Flow
1. Search query
2. Results retrieval
3. Metadata extraction
4. Data integration

## Authentication Methods

### 1. API Key Authentication
- Secure storage in Supabase
- No client exposure
- Regular rotation required

### 2. Request Authentication
```typescript
interface AuthHeaders {
  'Authorization': `Bearer ${string}`;
  'Content-Type': 'application/json';
}
```

## Data Flow Diagrams

### Analysis Workflow
```
[User Input] -> [Keyword Form]
    ↓
[Article Selection] -> [Diffbot Extraction]
    ↓
[Content Analysis] -> [OpenAI Processing]
    ↓
[Results Aggregation] -> [UI Display]
```

### Content Processing
```
[URL] -> [Diffbot API]
    ↓
[Raw Content] -> [Text Processing]
    ↓
[Structured Data] -> [Analysis Pipeline]
    ↓
[OpenAI Enhancement] -> [Final Output]
```

## API Specifications

### 1. analyze-articles Function
```typescript
interface AnalyzeRequest {
  urls: string[];
  keyword: string;
}

interface AnalyzeResponse {
  analyses: ArticleAnalysis[];
  idealStructure: IdealStructure;
}
```

### 2. External API Formats

#### OpenAI Request
```typescript
interface OpenAIRequest {
  model: string;
  messages: {
    role: 'system' | 'user';
    content: string;
  }[];
  temperature: number;
}
```

#### Diffbot Request
```typescript
interface DiffbotRequest {
  token: string;
  url: string;
}
```

## Error Handling

### 1. API Error Responses
```typescript
interface APIError {
  status: number;
  message: string;
  details?: unknown;
}
```

### 2. Retry Mechanisms
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}
```

## Rate Limiting

### 1. Implementation
```typescript
interface RateLimiter {
  windowMs: number;
  maxRequests: number;
  errorMessage: string;
}
```

### 2. Monitoring
- Request tracking
- Usage analytics
- Error logging

