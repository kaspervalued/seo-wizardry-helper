
# 3. Setup and Installation

## Environment Setup

### Prerequisites
1. Install Node.js (v18.0.0 or higher)
2. Install npm (v7.0.0 or higher)
3. Git for version control
4. Code editor (VS Code recommended)

### Development Environment Setup
1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Connect to Supabase through the Lovable interface:
   1. Click on the Supabase menu in the top right
   2. Follow the connection wizard
   3. Verify connection status

### Required API Keys and Services

1. **OpenAI API**
   - Create account at [OpenAI Platform](https://platform.openai.com)
   - Generate API key
   - Add to Supabase secrets via project settings

2. **Diffbot API**
   - Sign up at [Diffbot](https://www.diffbot.com)
   - Obtain API token
   - Add to Supabase secrets

3. **SerpAPI**
   - Register at [SerpAPI](https://serpapi.com)
   - Get API key
   - Add to Supabase secrets

### Development Server
1. **Start Local Development**
   ```bash
   npm run dev
   ```
   - Server runs on `http://localhost:8080`
   - Hot reload enabled
   - Console logging available

### Troubleshooting Guide

#### Common Issues and Solutions

1. **Build Failures**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules: `rm -rf node_modules`
   - Reinstall dependencies: `npm install`

2. **API Connection Issues**
   - Verify API keys in Supabase secrets
   - Check Edge Function logs
   - Confirm network connectivity

3. **Type Errors**
   - Update TypeScript version
   - Rebuild project: `npm run build`
   - Check type definitions

4. **Performance Issues**
   - Monitor browser console
   - Check network tab for slow requests
   - Verify API rate limits

### Deployment Checklist
1. **Pre-deployment Verification**
   - Run tests: `npm test`
   - Build project: `npm run build`
   - Check console for warnings

2. **Environment Variables**
   - Confirm all API keys are set
   - Verify Supabase connection
   - Check environment configurations

3. **Post-deployment**
   - Verify Edge Functions
   - Test all API integrations
   - Monitor error logs

