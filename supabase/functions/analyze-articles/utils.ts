export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain:', error);
    return '';
  }
};

export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).length;
};

export const countCharacters = (text: string): number => {
  return text.length;
};

export const extractExternalLinks = (html: string, currentDomain: string): Array<{ url: string; text: string; domain: string }> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  
  return links
    .map(link => ({
      url: link.href,
      text: link.textContent || '',
      domain: extractDomain(link.href)
    }))
    .filter(link => link.domain && link.domain !== currentDomain);
};

export const calculateReadabilityScore = (text: string): number => {
  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?]+/);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgCharactersPerWord = text.length / words.length;
  
  // Simple readability score based on sentence and word length
  return Math.round(100 - (avgWordsPerSentence * 0.5 + avgCharactersPerWord * 0.5));
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};