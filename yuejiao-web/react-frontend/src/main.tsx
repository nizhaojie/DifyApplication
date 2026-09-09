import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import { yuejiaoLocale, yuejiaoTheme } from '@/theme/antdTheme'
import { FeedbackBridge } from '@/components/feedback'
import './styles.css'

// 与 Vue main.ts 对齐:zh-cn locale(供时间组件)。不启用 StrictMode,避免双挂载造成的重复请求偏离 Vue 行为。
dayjs.locale('zh-cn')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={yuejiaoLocale} theme={yuejiaoTheme}>
    <AntApp>
      <FeedbackBridge />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AntApp>
  </ConfigProvider>,
)
