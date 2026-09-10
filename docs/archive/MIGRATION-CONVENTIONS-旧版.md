# React 迁移约定(页面迁移代理必读)

本项目是 `yuejiao-web/前端代码`(Vue 3 + Element Plus)的等价 React 迁移。**行为与视觉以 Vue 源码为像素/行为基准**,逐项照搬,不重新设计、不修复"怪"行为、不增删功能(除非明确告知的"超集"区块)。

## 技术栈

- React 19 + TypeScript + Vite 8 + antd **6** + zustand 5 + axios + react-router-dom 7
- 主题已在 `src/main.tsx` 全局挂载:`ConfigProvider`(zhCN locale、中国红 primary `#c41e1e`、EP 色阶、borderRadius 4)——**不要**在页面里再包 ConfigProvider,直接用 antd 组件即可获得红色主题
- 别名 `@` → `src`

## 图标

- 一律用 `@/components/elementIcons`(293 个 Element Plus 官方 SVG path,与 EP 像素一致),如 `<Bell size={18} />`
- **禁止**为新写的 Vue 等价 UI 引入 lucide-react(旧超集代码里残留的 lucide,重写该文件时顺手替换掉)

## 反馈(等价 EP 三件套)

`import { toast, confirmBox, promptBox } from '@/components/feedback'`

- `ElMessage.success('x')` → `toast.success('x')`(error/warning/info 同理)
- `ElMessageBox.confirm({title, message})` → `await confirmBox({ title, content })`,resolve true=确定
- `ElMessageBox.prompt`(必填场景)→ `await promptBox({ title, placeholder, emptyHint: '请输入…', inputType: 'text'|'textarea' })`,空值会拦截并提示,resolve string|null
- axios 拦截器已带全局错误 toast,页面 catch 里按 Vue 原样再 toast 的要保留(Vue 存在双重提示)

## CSS

- Vue 全局 `style.css` 的所有类已逐行移植到 `src/styles.css`(`.ent-*`、`.stat-card`、`.chat-card`、`.bubble.assistant|.user`、`.chips`、`.toolbar`、`.funnel-*`、`.md-text`、`.sql-fold`、`.empty-module` 等)——**优先复用同名类**
- Vue 页面里 `<style scoped>` 的样式 → 在页面组件旁建同名 CSS 文件并 import(参考 `src/pages/studentChat.css` 的做法),类名照搬
- 不要引入新 UI 库、不要 Tailwind

## EP 组件 → antd 对应

| Element Plus | antd | 注意 |
|---|---|---|
| el-table | Table | 行高由全局 CSS 收紧过;`show-overflow-tooltip` → `ellipsis: true` |
| el-drawer | Drawer | `size="55%"` → `width="55%"`;`size="420px"` → `width={420}` |
| el-dialog | Modal | `width`、`destroyOnHidden` 对齐 Vue 的 destroy-on-close |
| el-tabs | Tabs | `accordion`/互斥语义在 Collapse 场景用 `accordion` 属性 |
| el-select | Select | options 写法 |
| el-pagination | Pagination | `pageSize/current/total/onChange` |
| el-date-picker type="week" | DatePicker picker="week" | zhCN locale 周一起始;picker 值用 dayjs,取 `period_start` 时按 Vue period.ts 语义 |
| el-date-picker type="datetime" (range) | DatePicker.RangePicker showTime | `value-format="YYYY-MM-DDTHH:mm:ss"` → 提交时手写 format(antd 用 dayjs 对象) |
| el-upload drag | Upload.Dragger | `:auto-upload=false :limit=1` → `beforeUpload={() => false}` + `maxCount={1}`,取 `file` |
| el-progress | Progress | success/exception 状态色对齐 |
| el-tree | Tree | defaultExpandAll;可折叠 |
| el-collapse accordion | Collapse accordion | |
| el-timeline | Timeline | |
| el-empty | Empty | |
| el-tag type/effect | Tag | danger→`color="red"` 不完全等价时用 style 内联对齐 EP 色值(浅红底 #fdecec/字 #c41e1e) |
| el-alert | Alert | |
| el-badge is-dot | Badge dot | |
| v-loading | Spin | 包住内容区 |
| el-form | 不强制 | Vue 登录/研判等本就无校验规则,用受控输入 + 手写校验(和 Vue 一致的 ElMessage.warning 提示) |

## 数据层(保持 Vue 的分裂,不要"统一")

- `src/api/*`(axios,带 token,信封拦截器)——签名已在 `src/api/enterprise.ts` 等,缺的函数按 Vue `前端代码/src/api/*` 补齐(端点/参数/返回一字不差)
- cs 页(Vue `views/cs/api/csApi.ts`)是**原生 fetch、不带 token、走 `/api` 代理**——照搬
- student 两页是**页内 fetch,硬编码 `http://127.0.0.1:8002/api/v1/student`、`X-User-Id: '1'`、10s AbortController、失败回退内置 mock**——照搬

## 行为保真清单(常见坑)

- Enter 发送/Shift+Enter 换行必须有 **IME `isComposing` 守卫**(企业助手、客服页)
- 表单默认值、按钮 disabled 条件、空态文案、确认框标题文字:逐字对照 Vue
- Vue 中"看似 bug"的行为(如双重提示、默认落地页、演示数据模式)一律保留
- 不确定处:在代码里 `// TODO(迁移):` 注释标记并继续,不要停
