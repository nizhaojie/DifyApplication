import type {
  CourseSlots,
  EventSlots,
  PendingIntent,
  ReplyDraft,
  VisitorSession,
} from '@/stores/cs_types'

const SAMPLE_EVENTS = [
  '新加坡升学分享会（线上，本周六 19:00）',
  '中德精英计划说明会（线下，下周周三）',
  '英国硕士申请讲座（线上，下周五）',
] as const

const EDUCATION_PATTERNS: Array<[string, string]> = [
  ['博士', '博士'],
  ['硕士', '硕士'],
  ['研究生', '硕士'],
  ['本科', '本科'],
  ['大专', '大专'],
  ['高中', '高中'],
  ['初中', '初中'],
  ['大一', '本科在读'],
  ['大二', '本科在读'],
  ['大三', '本科在读'],
  ['大四', '本科在读'],
]

const COUNTRY_PATTERNS: Array<[string, string]> = [
  ['新加坡', '新加坡'],
  ['加拿大', '加拿大'],
  ['澳大利亚', '澳大利亚'],
  ['澳洲', '澳大利亚'],
  ['中德', '德国'],
  ['德国', '德国'],
  ['英国', '英国'],
  ['美国', '美国'],
  ['日本', '日本'],
  ['韩国', '韩国'],
]

type SceneCode =
  | 'student_redirect'
  | 'empathy_hold'
  | 'enterprise_redirect'
  | 'profile_redirect'
  | 'report_redirect'
  | 'course_recommend'
  | 'event_register'
  | 'faq'
  | 'policy_query'
  | 'company_inquiry'
  | 'business_query'
  | 'casual_chat'
  | 'unclear'

function includes_any(user_text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => user_text.includes(keyword))
}

function empty_course_slots(): CourseSlots {
  return { education_level: '', intended_country: '', budget: '' }
}

function empty_event_slots(): EventSlots {
  return { event_name: '', visitor_name: '', contact_info: '' }
}

function merge_course_slots(base: CourseSlots, incoming: CourseSlots): CourseSlots {
  return {
    education_level: incoming.education_level || base.education_level,
    intended_country: incoming.intended_country || base.intended_country,
    budget: incoming.budget || base.budget,
  }
}

function merge_event_slots(base: EventSlots, incoming: EventSlots): EventSlots {
  return {
    event_name: incoming.event_name || base.event_name,
    visitor_name: incoming.visitor_name || base.visitor_name,
    contact_info: incoming.contact_info || base.contact_info,
  }
}

function extract_education_level(user_text: string): string {
  for (const [keyword, label] of EDUCATION_PATTERNS) {
    if (user_text.includes(keyword)) return label
  }
  return ''
}

function extract_intended_country(user_text: string): string {
  for (const [keyword, label] of COUNTRY_PATTERNS) {
    if (user_text.includes(keyword)) return label
  }
  return ''
}

function extract_budget(user_text: string): string {
  const matched = user_text.match(/(\d+(?:\.\d+)?)\s*万/)
  if (matched) return `${matched[1]}万`
  return ''
}

function extract_contact_info(user_text: string): string {
  const phone_matched = user_text.match(/1[3-9]\d{9}/)
  if (phone_matched) return phone_matched[0]
  const email_matched = user_text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (email_matched) return email_matched[0]
  return ''
}

function extract_visitor_name(user_text: string): string {
  const labeled = user_text.match(/(?:我叫|我是|姓名[是:：]?\s*)([\u4e00-\u9fa5]{2,4})/)
  if (labeled) return labeled[1]
  return ''
}

function extract_event_name(user_text: string): string {
  const trimmed = user_text.trim()
  if (/^[1１]([.、)）]|场)?$/.test(trimmed) || includes_any(user_text, ['新加坡', '第一', '周六'])) {
    return SAMPLE_EVENTS[0]
  }
  if (/^[2２]([.、)）]|场)?$/.test(trimmed) || includes_any(user_text, ['中德', '德国', '第二', '周三'])) {
    return SAMPLE_EVENTS[1]
  }
  if (/^[3３]([.、)）]|场)?$/.test(trimmed) || includes_any(user_text, ['英国', '第三', '周五'])) {
    return SAMPLE_EVENTS[2]
  }
  for (const event_name of SAMPLE_EVENTS) {
    if (user_text.includes(event_name.slice(0, 6))) return event_name
  }
  return ''
}

function extract_course_slots(user_text: string): CourseSlots {
  return {
    education_level: extract_education_level(user_text),
    intended_country: extract_intended_country(user_text),
    budget: extract_budget(user_text),
  }
}

function extract_event_slots(user_text: string): EventSlots {
  let visitor_name = extract_visitor_name(user_text)
  const contact_info = extract_contact_info(user_text)
  if (!visitor_name && !contact_info) {
    const trimmed = user_text.trim()
    if (/^[\u4e00-\u9fa5]{2,4}$/.test(trimmed)) visitor_name = trimmed
  }
  return {
    event_name: extract_event_name(user_text),
    visitor_name,
    contact_info,
  }
}

function has_explicit_scene(user_text: string): boolean {
  return (
    includes_any(user_text, [
      '请假',
      '考试',
      '申请进度',
      '心理咨询',
      '心理疏导',
      '心理倾诉',
      '投诉',
      '压力',
      '好累',
      '焦虑',
      '录客户',
      '意向客户',
      '日报',
      '简历',
      '研判',
      '经营报告',
      '周报',
      '课程',
      '推荐',
      '讲座',
      '报名',
      '活动',
      '分享会',
      '收费',
      '退费',
      '费用',
      '政策',
      '签证',
      '申请条件',
      '公司',
      '机构',
      '校区',
      '业务',
      '聊聊',
    ]) ||
    user_text.includes('你们是做什么') ||
    user_text.includes('适不适合')
  )
}

function detect_scene(user_text: string, pending_intent: PendingIntent): SceneCode {
  if (
    includes_any(user_text, ['请假', '考试', '申请进度', '投诉', '心理咨询', '心理疏导', '心理倾诉'])
  ) {
    return 'student_redirect'
  }
  if (includes_any(user_text, ['压力', '好累', '焦虑', '心情', '难受', '崩溃', '失眠'])) {
    return 'empathy_hold'
  }
  if (includes_any(user_text, ['录客户', '意向客户', '日报']) || user_text.includes('审批请假')) {
    return 'enterprise_redirect'
  }
  if (includes_any(user_text, ['简历', '研判']) || user_text.includes('适不适合')) {
    return 'profile_redirect'
  }
  if (includes_any(user_text, ['经营报告', '周报', '日报汇总'])) {
    return 'report_redirect'
  }

  if (pending_intent && !has_explicit_scene(user_text)) {
    return pending_intent
  }

  if (includes_any(user_text, ['课程', '推荐']) || user_text.includes('适合什么')) {
    return 'course_recommend'
  }
  if (includes_any(user_text, ['讲座', '报名', '活动', '分享会', '见面会'])) {
    return 'event_register'
  }
  if (includes_any(user_text, ['收费', '退费', '费用']) || user_text.includes('申请流程')) {
    return 'faq'
  }
  if (includes_any(user_text, ['政策', '签证', '申请条件', '门槛', '移民'])) {
    return 'policy_query'
  }
  if (
    includes_any(user_text, ['公司', '机构', '校区', '品牌', '粤教']) ||
    user_text.includes('你们是做什么')
  ) {
    return 'company_inquiry'
  }
  if (includes_any(user_text, ['业务', '留学申请', '背景提升', '语言培训'])) {
    return 'business_query'
  }
  if (includes_any(user_text, ['聊聊', '你好', '在吗', '哈哈'])) {
    return 'casual_chat'
  }
  if (pending_intent) return pending_intent
  return 'unclear'
}

function build_course_reply(course_slots: CourseSlots): ReplyDraft {
  if (!course_slots.education_level) {
    return {
      assistant_text: '可以。先告诉我你目前的学历（比如本科、硕士在读、大专），我再按这个帮你看方向。',
      pending_intent: 'course_recommend',
      course_slots,
      event_slots: empty_event_slots(),
    }
  }
  if (!course_slots.intended_country) {
    return {
      assistant_text: `学历我记下了：${course_slots.education_level}。你更想去哪个国家或地区？`,
      pending_intent: 'course_recommend',
      course_slots,
      event_slots: empty_event_slots(),
    }
  }

  const budget_clause = course_slots.budget ? `，预算大约 ${course_slots.budget}` : ''
  return {
    assistant_text: `按你提供的「${course_slots.education_level} / ${course_slots.intended_country}」${budget_clause}，本期示例里比较贴近的是「语言衔接 + 主课申请」方向的课程示意，不是正式报价。接入课程表之后我会按学历、国家和预算精确匹配。想听讲座或找顾问，也可以继续问我。`,
    pending_intent: '',
    course_slots,
    event_slots: empty_event_slots(),
  }
}

function build_event_reply(event_slots: EventSlots): ReplyDraft {
  if (!event_slots.event_name) {
    return {
      assistant_text: `最近有三场示例讲座：\n1. ${SAMPLE_EVENTS[0]}\n2. ${SAMPLE_EVENTS[1]}\n3. ${SAMPLE_EVENTS[2]}\n想报哪一场？回我序号或讲座名就行。正式报名以后会写入后台，现在只在对话里记下。`,
      pending_intent: 'event_register',
      course_slots: empty_course_slots(),
      event_slots,
    }
  }
  if (!event_slots.visitor_name) {
    return {
      assistant_text: `「${event_slots.event_name}」可以。请告诉我你的姓名。`,
      pending_intent: 'event_register',
      course_slots: empty_course_slots(),
      event_slots,
    }
  }
  if (!event_slots.contact_info) {
    return {
      assistant_text: `${event_slots.visitor_name}，再留一个手机号或邮箱，我帮你把意向记在这次对话里。`,
      pending_intent: 'event_register',
      course_slots: empty_course_slots(),
      event_slots,
    }
  }
  return {
    assistant_text: `已记下：${event_slots.visitor_name}（${event_slots.contact_info}）意向报名「${event_slots.event_name}」。正式报名以后会接到后台，现在还没有写入数据库。`,
    pending_intent: '',
    course_slots: empty_course_slots(),
    event_slots,
  }
}

function build_policy_reply(user_text: string): string {
  const has_singapore = user_text.includes('新加坡')
  const has_germany = user_text.includes('德国') || user_text.includes('中德')
  if (!has_singapore && !has_germany && includes_any(user_text, ['签证', '政策', '美国', '英国', '日本'])) {
    return '示例知识库里暂时没有这个国家的政策原文，我不能编造。目前只能示意新加坡、德国方向。接入《留学政策》文档后可以按原文回答。'
  }
  if (has_singapore && has_germany) {
    return '新加坡方向通常看学历、语言成绩和所选学制是否匹配；德国方向还要留意审核部与语言班路径。这是示意口径，不是签证原文。接入知识库后我会按文档回答，答不了就说没有。'
  }
  if (has_singapore) {
    return '新加坡方向的示例口径：先看学历是否匹配对应学制，再核对语言成绩。具体签证与院校门槛要以最新政策为准，我现在还没有完整知识库，不能编细节。'
  }
  if (has_germany) {
    return '德国方向的示例口径：申请路径常和语言班、审核部要求绑在一起，不同项目差很多。我还没有《留学政策》原文，只能说到这一层，避免说错。'
  }
  return '留学政策要严格按知识库来。本期示例只覆盖新加坡、德国方向的门槛示意，没有的国家我会承认没有，不会编造条款。'
}

export function request_assistant_reply(user_text: string, session: VisitorSession): ReplyDraft {
  const scene = detect_scene(user_text, session.pending_intent)
  const course_slots = merge_course_slots(session.course_slots, extract_course_slots(user_text))
  const event_slots = merge_event_slots(session.event_slots, extract_event_slots(user_text))

  if (scene === 'student_redirect') {
    return {
      assistant_text:
        '好的。请假、查考试或申请进度，请打开左侧菜单里的学生助手，那边可以代办。若需要专门的心理支持，也请走学生助手。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'empathy_hold') {
    return {
      assistant_text:
        '听起来最近挺不容易的，我先收到了。粤小蜜做不了心理咨询，但如果你愿意，可以补充学历、语言基础和目标方向（新加坡或德国），我按现有项目给你更贴合的建议。若需要专门的心理支持，请打开左侧的学生助手。',
      pending_intent: 'course_recommend',
      course_slots,
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'enterprise_redirect') {
    return {
      assistant_text: '录入客户、写日报或审批，请打开左侧菜单里的企业助手。粤小蜜不改内部数据。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'profile_redirect') {
    return {
      assistant_text: '判断一份简历或客户资料是否匹配产品，请打开左侧菜单里的客户研判。粤小蜜不能上传文件。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'report_redirect') {
    return {
      assistant_text: '经营分析、日报汇总或周报，请打开左侧菜单里的智能报告。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'course_recommend') {
    return build_course_reply(course_slots)
  }
  if (scene === 'event_register') {
    return build_event_reply(event_slots)
  }
  if (scene === 'faq') {
    return {
      assistant_text:
        '咨询免费；正式服务费在签约时确认。退费按合同条款申请，我现在还查不到具体比例，不能随口报数字。接入 FAQ 后会按原文回答申请流程、费用和退费。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'policy_query') {
    return {
      assistant_text: build_policy_reply(user_text),
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'company_inquiry') {
    return {
      assistant_text:
        '粤教服务做留学与国际教育：留学申请、背景提升和语言培训。品牌历程、成功案例和校区分布在《公司信息》里，接入知识库后我可以按文档答。现在找我就行，我是粤小蜜。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'business_query') {
    return {
      assistant_text:
        '目前对外的核心业务是留学申请、背景提升和语言培训，另外还有讲座和课程咨询。具体项目名录还在示例阶段，你可以说学历和意向国家，我按课程咨询帮你看方向。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  if (scene === 'casual_chat') {
    return {
      assistant_text: '在的。最近是不是在看留学？想吐槽申请、问学校，还是先听场讲座，我都陪着。正事也可以随时插进来。',
      pending_intent: '',
      course_slots: empty_course_slots(),
      event_slots: empty_event_slots(),
    }
  }
  return {
    assistant_text:
      '已收到你的问题。为了给出更贴合的建议，欢迎补充学历、语言基础和目标方向（新加坡或德国）。',
    pending_intent: '',
    course_slots: empty_course_slots(),
    event_slots: empty_event_slots(),
  }
}
