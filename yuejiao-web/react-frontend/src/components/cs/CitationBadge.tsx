import { Document } from '@/components/elementIcons'
import './CitationBadge.css'

/** 等价迁移自 Vue 版 views/cs/components/CitationBadge.vue */
export function CitationBadge({ source }: { source: string }) {
  return (
    <div className="citation-badge" title={`权威参考来源：${source}`}>
      <Document className="citation-icon" size={12} />
      <span className="citation-text">知识来源：{source.replace(/【|】|知识来源[:：]/g, '')}</span>
    </div>
  )
}
