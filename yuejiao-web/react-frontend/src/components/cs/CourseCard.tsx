import { Button } from 'antd'
import { ChatLineRound, Timer, UserFilled } from '@/components/elementIcons'
import { EpTag } from './EpTag'
import type { CourseProjectItem } from '@/api/csTypes'
import './CourseCard.css'

/** 等价迁移自 Vue 版 views/cs/components/CourseCard.vue */
export function CourseCard({
  course,
  onConsult,
}: {
  course: CourseProjectItem
  onConsult: (courseName: string) => void
}) {
  // 价格格式化:undefined/null → 详情请咨询;0 → 免学费;否则 ¥x,xxx 起
  let formattedPrice: string
  if (course.price === undefined || course.price === null) {
    formattedPrice = '详情请咨询'
  } else if (course.price === 0) {
    formattedPrice = '免学费 / 公费培养'
  } else {
    formattedPrice = `¥ ${course.price.toLocaleString()} 起`
  }

  return (
    <div className="course-card">
      <div className="course-header">
        <div className="title-wrap">
          <EpTag type="danger" effect="dark" className="category-tag">
            {course.category || '精选项目'}
          </EpTag>
          <span className="course-title">{course.project_name}</span>
        </div>
        <div className="price-badge">{formattedPrice}</div>
      </div>

      {course.description ? <div className="course-desc">{course.description}</div> : null}

      <div className="course-meta">
        {course.duration ? (
          <div className="meta-item">
            <Timer size={12} />
            <span>周期：{course.duration}</span>
          </div>
        ) : null}
        {course.target_audience ? (
          <div className="meta-item">
            <UserFilled size={12} />
            <span>适合：{course.target_audience}</span>
          </div>
        ) : null}
      </div>

      {course.tags && course.tags.length ? (
        <div className="tag-row">
          {course.tags.map((tag) => (
            <EpTag key={tag} effect="plain" className="feature-tag">
              {tag}
            </EpTag>
          ))}
        </div>
      ) : null}

      <div className="course-footer">
        <Button
          type="primary"
          size="small"
          className="consult-btn"
          onClick={() => onConsult(course.project_name)}
        >
          <ChatLineRound size={12} />
          立即咨询此项目
        </Button>
      </div>
    </div>
  )
}
