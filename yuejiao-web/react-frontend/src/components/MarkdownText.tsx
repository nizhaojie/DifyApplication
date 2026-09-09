import ReactMarkdown from 'react-markdown'

export function MarkdownText({ text }: { text: string }) {
  return <div className="markdown-text"><ReactMarkdown>{text}</ReactMarkdown></div>
}
