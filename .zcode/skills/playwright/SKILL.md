---
name: playwright
description: 粤教前端 GUI 测试。需要打开页面、点击/输入/滚动验证交互、读 console 报错、截图验证视觉时使用。依赖已配置的 playwright MCP 服务器（mcp__playwright__* 工具）。
---

# Playwright GUI 测试（粤教前端）

通过 playwright MCP 工具驱动真实浏览器，做黑盒 GUI 验证。不要用 curl 或读代码代替页面级验证。

## 本项目地址

| 服务 | 地址 | 启动方式 |
|---|---|---|
| React 前端 | http://localhost:5174 | `yuejiao-web/react-frontend` 下 `npm run dev` |
| FastAPI 后端 | http://localhost:8002 | `yuejiao-admin` 下 `uvicorn app.main:app --port 8002` |

后端不在时前端会进入降级演示模式（mock 数据）——测试时注意区分"降级态"与"真实数据态"，避免误报。

## 核心工作流

1. **导航**：`browser_navigate` 打开页面；首次访问先登录（账号走后端，演示账号见 `yuejiao-admin/README.md`）。
2. **观察**：用 `browser_snapshot` 拿可访问性快照（含元素 ref），**不要靠截图猜元素位置**。
3. **操作**：`browser_click` / `browser_type` / `browser_select_option` / `browser_hover`，一律用 snapshot 里的 ref 作为 target。
4. **验证**：每个操作后重新 `browser_snapshot` 确认状态变化；用 `browser_console_messages` 查报错（React 严格模式下 hydrate 警告可忽略，运行时 error 不能忽略）。
5. **截图**：`browser_take_screenshot` 存证，默认视口 1280×720。

## 注意事项

- MCP 工具为有状态会话：一个浏览器里只能有一个活动 tab 参与快照/操作；需要多页并行时用 `browser_tabs` 开新 tab。
- 页面跳转后 ref 全部失效，必须重新 snapshot。
- 文件上传（客户研判页支持文本/PDF/Excel）用 `browser_file_upload`，且需先触发文件选择控件。
- 测试产生的数据（学生对话、客户研判记录）会写入真实后端，验收后如需清理走后端接口，不要直接改库。

## 历史资料

Vue → React 迁移的双端对比证据与验收报告已归档在 `docs/archive/` 与 `docs/合流验收报告.md`，Vue 前端代码已删除，不再做双端对比。
