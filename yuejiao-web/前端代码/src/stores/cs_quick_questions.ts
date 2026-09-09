import type { QuickQuestion } from '@/stores/cs_types'

export const CS_WELCOME_TEXT =
  '你好，我是粤小蜜，粤教服务的在线顾问。想了解公司、留学政策、课程，或报名近期讲座，直接问我就好。也可以先点下面的问题。'

export const CS_QUICK_QUESTIONS: QuickQuestion[] = [
  { question_id: 'company_inquiry', label: '你们公司是做什么的？' },
  { question_id: 'business_query', label: '有哪些留学业务？' },
  { question_id: 'policy_query', label: '新加坡 / 德国申请要什么条件？' },
  { question_id: 'course_recommend', label: '帮我看看适合什么课程？' },
  { question_id: 'event_register', label: '最近有什么讲座可以报名？' },
  { question_id: 'faq', label: '怎么收费、能退费吗？' },
  { question_id: 'casual_chat', label: '随便聊聊。' },
]
