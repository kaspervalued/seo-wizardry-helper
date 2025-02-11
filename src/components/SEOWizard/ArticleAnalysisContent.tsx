
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleAnalysis } from "@/types/seo";

interface ArticleAnalysisContentProps {
  analysis: ArticleAnalysis;
}

const RedditContent = ({ analysis }: { analysis: ArticleAnalysis }) => {
  if (!analysis.redditContent) return null;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Original Post Summary</h4>
        <p className="text-sm">{analysis.redditContent.content}</p>
      </div>
      
      {analysis.redditContent.comments && analysis.redditContent.comments.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Responses Summary</h4>
          <ul className="space-y-2 text-sm">
            {analysis.redditContent.comments.map((comment, idx) => (
              <li key={idx} className="pl-4 border-l-2 border-gray-200">
                {comment}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.keywords && analysis.keywords.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Key Discussion Points</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const YouTubeContent = ({ analysis }: { analysis: ArticleAnalysis }) => {
  const hasTranscript = analysis.transcript && analysis.transcript.length > 50;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Video Information</h4>
        <ul className="space-y-2 text-sm">
          <li>Title: {analysis.title || 'N/A'}</li>
          <li>
            URL:{" "}
            <a
              href={analysis.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Watch Video
            </a>
          </li>
        </ul>
      </div>

      {hasTranscript ? (
        <div>
          <h4 className="font-medium mb-2">Video Transcript</h4>
          <div className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded">
            {analysis.transcript}
          </div>
        </div>
      ) : (
        <div className="text-sm text-amber-600 bg-amber-50 p-4 rounded">
          Full transcript could not be retrieved. This might be due to:
          <ul className="list-disc pl-4 mt-2">
            <li>Video language not supported</li>
            <li>Closed captions not available</li>
            <li>Private or restricted video access</li>
          </ul>
        </div>
      )}

      {analysis.keywords && analysis.keywords.length > 0 && hasTranscript && (
        <div>
          <h4 className="font-medium mb-2">Key Topics Discussed</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StandardContent = ({ analysis }: { analysis: ArticleAnalysis }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium mb-2">Article Information</h4>
      <ul className="space-y-2 text-sm">
        <li>Domain: {analysis.domain}</li>
        <li>
          URL:{" "}
          <a
            href={analysis.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            View Article
          </a>
        </li>
      </ul>
    </div>

    <div>
      <h4 className="font-medium mb-2">Content Statistics</h4>
      <ul className="space-y-2 text-sm">
        <li>Word Count: {analysis.wordCount}</li>
        <li>Character Count: {analysis.characterCount}</li>
        <li>Headings: {analysis.headingsCount}</li>
        <li>Paragraphs: {analysis.paragraphsCount}</li>
        <li>Images: {analysis.imagesCount}</li>
        <li>Videos: {analysis.videosCount}</li>
        <li>External Links: {analysis.externalLinksCount}</li>
      </ul>
    </div>

    <div>
      <h4 className="font-medium mb-2">Meta Information</h4>
      <ul className="space-y-2 text-sm">
        <li>Title: {analysis.metaTitle || 'N/A'}</li>
        <li>Description: {analysis.metaDescription || 'N/A'}</li>
      </ul>
    </div>

    {analysis.keywords && analysis.keywords.length > 0 && (
      <div>
        <h4 className="font-medium mb-2">Key Phrases</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.keywords.map((keyword, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
    )}

    {analysis.externalLinks && analysis.externalLinks.length > 0 && (
      <div>
        <h4 className="font-medium mb-2">External Links</h4>
        <ul className="space-y-2 text-sm">
          {analysis.externalLinks.map((link, idx) => (
            <li key={idx}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {link.text || link.domain}
              </a>{" "}
              <span className="text-gray-500">({link.domain})</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {analysis.headingStructure && analysis.headingStructure.length > 0 && (
      <div>
        <h4 className="font-medium mb-2">Heading Structure</h4>
        <ul className="space-y-2 text-sm">
          {analysis.headingStructure.map((heading, idx) => (
            <li
              key={idx}
              className="pl-4"
              style={{
                marginLeft: `${(parseInt(heading.level.slice(1)) - 1) * 16}px`,
              }}
            >
              <span className="text-gray-500">{heading.level}:</span>{" "}
              {heading.text}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export const ArticleAnalysisContent = ({ analysis }: ArticleAnalysisContentProps) => {
  const getContentType = (url: string): 'article' | 'reddit' | 'youtube' => {
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('youtu.be') || url.includes('youtube.com')) return 'youtube';
    return 'article';
  };

  const contentType = getContentType(analysis.url);

  return (
    <ScrollArea className="h-[300px] rounded-md">
      <div className="space-y-4 p-4">
        {contentType === 'reddit' ? (
          <RedditContent analysis={analysis} />
        ) : contentType === 'youtube' ? (
          <YouTubeContent analysis={analysis} />
        ) : (
          <StandardContent analysis={analysis} />
        )}
      </div>
    </ScrollArea>
  );
};
