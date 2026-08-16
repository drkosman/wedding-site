import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        skipHtml
        urlTransform={defaultUrlTransform}
        components={{
          // The dedicated section title is an h2, so Markdown headings are always
          // subsections even if an administrator starts them with one or two #s.
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          img: ({ alt }) => alt ?? null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
