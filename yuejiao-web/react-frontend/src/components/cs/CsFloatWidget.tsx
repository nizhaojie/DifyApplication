import { useEffect, useRef, useState } from 'react'
import { MessageCircle, SendHorizonal, X } from 'lucide-react'
import { useCsFloatStore } from '@/store/csFloatStore'
import { CS_QUICK_QUESTIONS } from '@/store/csQuickQuestions'
import './csFloat.css'

// 等价迁移自 Vue 版 CsFloatWidget.vue(粤小蜜全局悬浮球):
// 右下角 56px 圆球 + 360x520 对话面板,快捷问题仅在尚无用户消息时展示,
// 输入 500 字上限、Enter 发送(IME 组合期不发送)。

export function CsFloatWidget() {
  const open = useCsFloatStore((state) => state.open)
  const replying = useCsFloatStore((state) => state.replying)
  const messages = useCsFloatStore((state) => state.messages)
  const togglePanel = useCsFloatStore((state) => state.togglePanel)
  const closePanel = useCsFloatStore((state) => state.closePanel)
  const startNewSession = useCsFloatStore((state) => state.startNewSession)
  const sendUserText = useCsFloatStore((state) => state.sendUserText)
  const [draft, setDraft] = useState('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const area = scrollerRef.current
    if (area) area.scrollTop = area.scrollHeight
  }, [open, messages.length, replying])

  async function submit() {
    const text = draft
    setDraft('')
    await sendUserText(text)
  }

  const showQuick = !messages.some((item) => item.role === 'user')

  return <div className="cs-widget">
    {open && <div className="cs-panel" role="dialog" aria-label="粤小蜜客服对话">
      <header className="cs-panel-head">
        <div><strong>粤小蜜</strong><span>在线</span></div>
        <div className="cs-head-actions">
          <button type="button" className="cs-text-btn" onClick={startNewSession}>新对话</button>
          <button type="button" className="cs-text-btn" aria-label="关闭客服窗口" onClick={closePanel}><X size={16} /></button>
        </div>
      </header>

      <div ref={scrollerRef} className="cs-messages">
        {messages.map((item) => (
          <div key={item.id} className={`cs-row ${item.role === 'user' ? 'is-user' : 'is-assistant'}`}>
            <div className="cs-bubble">{item.content}</div>
          </div>
        ))}
        {replying && <div className="cs-row is-assistant"><div className="cs-typing">粤小蜜正在输入…</div></div>}
        {showQuick && <div className="cs-quick">
          {CS_QUICK_QUESTIONS.map((question) => (
            <button key={question.question_id} type="button" className="cs-quick-btn" onClick={() => void sendUserText(question.label)}>
              {question.label}
            </button>
          ))}
        </div>}
      </div>

      <form className="cs-composer" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <textarea
          rows={2}
          maxLength={500}
          placeholder="输入想问的事，回车发送"
          disabled={replying}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <button type="submit" className="cs-send" disabled={replying || !draft.trim()} aria-label="发送">
          <SendHorizonal size={16} />
        </button>
      </form>
    </div>}

    <button type="button" className="cs-ball" aria-label={open ? '收起粤小蜜' : '打开粤小蜜'} onClick={togglePanel}>
      {open ? <X size={22} /> : <MessageCircle size={24} />}
    </button>
  </div>
}
