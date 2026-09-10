import ReactMarkdown from 'react-markdown'

// 对齐 Vue 版 components/MarkdownText.vue 的根类名 .md-text(styles.css 的 .md-text / .bubble.user .md-text 均按此命名)
export function MarkdownText({ text }: { text: string }) {
  return <div className="md-text"><ReactMarkdown>{text}</ReactMarkdown></div>
}
