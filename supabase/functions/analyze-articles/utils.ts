export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
};

export const extractLinksFromHTML = (html: string): { href: string; text: string }[] => {
  const links: { href: string; text: string }[] = [];
  
  // Method 1: Standard anchor tags
  const standardLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = standardLinkRegex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: match[2].trim()
    });
  }
  
  // Method 2: Links with nested elements
  const nestedLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  while ((match = nestedLinkRegex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && !links.some(l => l.href === match[1])) {
      links.push({
        href: match[1],
        text: text
      });
    }
  }
  
  // Method 3: Look for URLs in text content
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const textContent = html.replace(/<[^>]+>/g, ' ');
  const urlMatches = textContent.match(urlRegex) || [];
  urlMatches.forEach(url => {
    if (!links.some(l => l.href === url)) {
      links.push({
        href: url,
        text: url
      });
    }
  });
  
  return links;
};