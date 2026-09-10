---
name: playwright
description: 粤教前端 GUI 测试与 Vue→React 视觉对比。需要打开页面、点击/输入/滚动验证交互、读 console 报错、截图对比 Vue 与 React 版本时使用。依赖已配置的 playwright MCP 服务器（mcp__playwright__* 工具）。
---

# Playwright GUI 测试（粤教前端）

通过 playwright MCP 工具驱动真实浏览器，做黑盒 GUI 验证。不要用 curl 或读代码代替页面级验证。

## 本项目地址

| 服务 | 地址 | 启动方式 |
|---|---|---|
| React 前端（迁移目标） | http://localhost:4174 | `yuejiao-web/react-frontend` 下 `npm run dev` |
| Vue 前端（对照基准） | http://localhost:5174 | `yuejiao-web/前端代码` 下 `npm run dev` |
| FastAPI 后端 | http://localhost:8002 | `yuejiao-admin` 下 `uvicorn app.main:app --port 8002` |

后端不在时前端会进入降级演示模式（mock 数据）——对比测试时注意区分"降级态"与"真实数据态"，避免误报。

## 核心工作流

1. **导航**：`browser_navigate` 打开页面；首次访问先登录（React 与 Vue 的登录页视觉应一致，账号走后端）。
2. **观察**：用 `browser_snapshot` 拿可访问性快照（含元素 ref），**不要靠截图猜元素位置**。
3. **操作**：`browser_click` / `browser_type` / `browser_select_option` / `browser_hover`，一律用 snapshot 里的 ref 作为 target。
4. **验证**：每个操作后重新 `browser_snapshot` 确认状态变化；用 `browser_console_messages` 查报错（React 严格模式下 hydrate 警告可忽略，运行时 error 不能忽略）。
5. **截图**：`browser_take_screenshot` 存证；Vue/React 双开同视口（默认 1280×720）逐页对比。

## 视觉对比规范（Vue → React 迁移验收）

- 同一账号、同一数据、同视口下逐页对比，重点：布局结构、间距、字号、颜色、交互状态（loading/empty/error/disabled）。
- 交互行为等价优先于像素等价：弹窗、抽屉、Tab、分页、搜索筛选、表单校验提示必须行为一致。
- 发现不一致时记录：页面路由、操作步骤、Vue 表现、React 表现、截图路径。

## 注意事项

- MCP 工具为有状态会话：一个浏览器里只能有一个活动 tab 参与快照/操作；需要双端对比时用 `browser_tabs` 开新 tab 或分别截图。
- 页面跳转后 ref 全部失效，必须重新 snapshot。
- 文件上传（客户研判页支持文本/PDF/Excel）用 `browser_file_upload`，且需先触发文件选择控件。
- 测试产生的数据（学生对话、客户研判记录）会写入真实后端，验收后如需清理走后端接口，不要直接改库。
