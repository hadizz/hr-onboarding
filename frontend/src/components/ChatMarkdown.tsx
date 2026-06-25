import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children, className }) => {
    if (className?.includes('language-')) {
      return (
        <code className={`${className} text-xs`}>{children}</code>
      );
    }
    return (
      <code className="rounded-md bg-zinc-200/70 dark:bg-zinc-700/70 px-1.5 py-0.5 font-mono text-xs">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-zinc-200/70 dark:bg-zinc-700/70 p-3 text-xs last:mb-0 font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 italic text-zinc-500 dark:text-zinc-400 last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-violet-600 dark:text-violet-400 underline hover:text-violet-800 dark:hover:text-violet-300 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-left font-semibold bg-zinc-100 dark:bg-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1">
      {children}
    </td>
  ),
};

export default function ChatMarkdown({ content }: { content: string }) {
  if (!content) return null;

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
