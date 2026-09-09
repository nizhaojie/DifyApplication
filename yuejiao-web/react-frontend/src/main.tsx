import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider, Empty } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import { yuejiaoLocale, yuejiaoTheme } from '@/theme/antdTheme'
import { FeedbackBridge } from '@/components/feedback'
import './styles.css'

// 与 Vue main.ts 对齐:zh-cn locale(供时间组件)。不启用 StrictMode,避免双挂载造成的重复请求偏离 Vue 行为。
dayjs.locale('zh-cn')

// EP 的 el-table 空态是纯文字「暂无数据」;antd 默认渲染带插图的 Empty,这里只对表格还原
const renderEmpty = (componentName?: string) =>
  componentName === 'Table' ? (
    <div style={{ padding: '16px 0', color: '#909399', textAlign: 'center' }}>暂无数据</div>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
  )

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={yuejiaoLocale} theme={yuejiaoTheme} renderEmpty={renderEmpty}>
    <AntApp>
      <FeedbackBridge />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AntApp>
  </ConfigProvider>,
)
