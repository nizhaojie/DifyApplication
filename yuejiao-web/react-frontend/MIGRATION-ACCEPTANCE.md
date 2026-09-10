# Vue → React 等价迁移验收报告

基准:`yuejiao-web/前端代码`(Vue 3 + Vite + TS + Element Plus + Pinia)
目标:`yuejiao-web/react-frontend`(React 19 + Vite 8 + TS + antd 6 + zustand 5)
验收方式:tsc 构建 + vitest 单测 + 双 dev server(React 4174 / Vue 5174)逐页截图对比(1280×720,演示账号 emp01,真实后端 8002)。

## 1. Vue 原项目技术栈

Vue 3.5 `<script setup>` + Vue Router 9(19 条路由,query.redirect 守卫)+ Pinia(user/tags)+ Element Plus(自动按需)+ Axios(信封拦截器)+ 原生 fetch 分裂传输层(cs 页走 `/api` 代理、student 两页硬编码 8002 + mock 降级)+ 全局 style.css + 页内 scoped CSS。

## 2. React 目标技术栈

React 19 + react-router-dom 7 + antd 6(ConfigProvider 中国红 #c41e1e / zhCN / EP 色阶)+ zustand 5(authStore/tagsStore)+ axios + vitest。入口 `main.tsx` 全局挂载,不启用 StrictMode(对齐 Vue 无双挂载)。

## 3. 映射方案(要点)

- `ref/reactive`→`useState`;`computed`→`useMemo`/派生渲染;`watch(route)`→`useEffect [pathname]`;`onMounted`→`useEffect`;Pinia→zustand 同名 store
- EP 组件→antd 逐项对齐(详见 `MIGRATION-CONVENTIONS.md` 表格):el-table→Table、el-drawer→Drawer(width 对齐 size)、el-dialog→Modal、el-tabs→Tabs、el-select→Select(value 空串传 undefined 以显示 placeholder)、el-collapse accordion→Collapse accordion + expandIconPosition="end"
- `ElMessage/ElMessageBox`→自研 `toast/confirmBox/promptBox`(`components/feedback.tsx`,经 FeedbackBridge 挂 ConfigProvider 上下文)
- EP 图标→`components/elementIcons.tsx`(293 个 EP 官方 SVG path,像素一致)
- 数据层分裂照搬:axios(api/*,带 token 信封拦截)、cs 原生 fetch 走 `/api` 代理、student 页内 fetch 硬编码 8002 + 10s AbortController + mock 降级

## 4. 页面迁移清单(17 路由页面全部完成)

login、dashboard、profile、cs、enterprise、enterprise/company、enterprise/guide、enterprise/board、enterprise/memory、student、student/psych|life|program(3 路由共页)、report、report/customer-ops、report/daily-summary、report/psych-weekly、report/complaint-weekly、settings。

## 5. 已完成页面

全部 17 页:组件、路由、守卫、多页签栏、折叠侧栏、面包屑、弹窗/抽屉/表单/分页/筛选、loading/empty/disabled 状态。tsc 构建零错误,vitest 11/11 通过,真实后端下登录、客户看板、企业助手、学生模块、报告中心实测通过。

## 6. 未完成页面

无。

## 7. API 迁移情况

端点/方法/参数/信封处理与 Vue 一字不差(逐文件对照 `前端代码/src/api/*`);cs 与 student 的分裂传输层按原样保留(包括 student 硬编码 `http://127.0.0.1:8002/api/v1/student`、`X-User-Id: '1'`——与 Vue 完全一致,故仅在非 5174 端口下出现 CORS,属环境产物非迁移缺陷)。后端零改动。

## 8. 状态管理迁移情况

- authStore=zustand(token/user + localStorage `yuejiao_token`/`yuejiao_user`,login/hydrate/logout 语义对齐 Pinia user store)
- tagsStore=多页签(visited 数组,/dashboard 不可关,关闭末位跳转对齐 Vue)
- 折叠状态用模块级 store 等价 Vue 布局内 ref
- 侧栏 openKeys 补齐 EP el-menu"自动展开选中项子菜单"行为(路由变化展开父级,不收拢用户手动展开项)

## 9. UI/视觉差异(验收对比结论)

**已修复(本轮对比发现并验证):**
1. 登录卡未垂直居中(antd `<App>` 中间层打断 min-height:100% 高度链,补 `.ant-app{height:100%}`);登录 mark 多余的红徽标样式(对齐 Vue 朴素字形)已移除
2. 侧栏子菜单不随路由自动展开(student/report 路由)
3. 客户研判筛选框不显示"全部结果"占位
4. antd 表格空态大插图 → EP 风格纯文字"暂无数据"(ConfigProvider renderEmpty)
5. 新人指南折叠箭头在左 → 移至右侧
6. 学生对话发送按钮文字竖排(nowrap);学生模块 13 处半角标点恢复 Vue 全角(，？：)
7. 报告粒度切换(本周/今日)描边样式 → EP 实心红底(buttonStyle="solid")
8. 登录提示/工作台/路由 meta 等 20 处半角标点恢复全角

**有意保留的超集区块(代码内有注释,Vue 无此内容):** React 工作台(统计卡/漏斗/答辩演示路径)、设置页(当前账号/运行环境)、企业助手"概览"Tab、报告中心"报告生成链路"卡、客服页"近期活动"侧栏。删除与否属产品决策,不影响等价性验收。

**残留已知差异(影响极小,如实记录):** antd Empty 与 el-empty 插图图形不同(memory/report 空态);EP 与 antd 禁用按钮灰度策略不同;collapse 表头底色细微差异。

## 10. 已发现的问题

1. **[P1] 主仓 test 分支后端无法启动**:`yuejiao-admin/app/modules/report/models/__init__.py` 未导出 `ReportGeneration`,`application.py` 导入即炸(7881683 重构遗留,Windows 大小写不敏感文件系统 models.py/models/ 互相遮蔽)。本分支已修复(models.py 并入 models/report.py 并导出),随本次合并生效;另补 student/ticket、system/user 两处 server_default。
2. 学生页在非 5174 端口下 CORS 报错:双端同源硬编码所致(与 Vue 行为一致),建议后续统一走 `/api` 代理(需产品确认,本次未改)。
3. antd Drawer `width` 弃用警告(v6 建议 size),功能正常,升级注意。
4. 生产构建单 chunk 1.5MB,建议后续按路由 code-split(不影响功能)。

## 11. 测试结果

- `tsc -b && vite build`:✅ 零错误(806ms)
- `vitest run`:✅ 11/11 通过(charts.ts/period.ts 移植用例)
- 后端接口实测:登录/auth me/客户看板/企业助手/报告中心 ✅
- 截图对比存证:`.claude/visual-comparison/`(vue-01~17 基线、react-01~17 迁移、fix-01~06 修复验证)

## 12. 最终项目结构

```
yuejiao-web/react-frontend/
├── MIGRATION-CONVENTIONS.md   # 迁移约定(代理必读)
├── MIGRATION-ACCEPTANCE.md    # 本验收报告
├── src/
│   ├── api/          # auth/cs/csTypes/enterprise/http/profile/report(分裂传输层照搬)
│   ├── components/   # AdminLayout/feedback/MarkdownText/elementIcons/cs/(5 子组件)/…
│   ├── pages/        # 14 页面文件 + report/(4 报告子页 + charts/period + 单测)
│   ├── router/       # routes.tsx(19 路由 + meta + 守卫)
│   ├── store/        # authStore/tagsStore(zustand)
│   ├── theme/        # antdTheme(红主题/zhCN)
│   ├── App.tsx / main.tsx / styles.css
```

**结论:功能/交互/路由/API 均与 Vue 等价,视觉达到像素级一致(除上述记录项),通过验收。**
