# 学生智能助手 Dify 应用

本目录包含三个可独立导入 Dify 的 Chatflow DSL 文件：

- `psych-care-chatflow.yml`：心理关怀与风险分流。
- `overseas-life-chatflow.yml`：海外生活支持。
- `value-service-chatflow.yml`：增值服务咨询与转化。

## 导入与发布

1. 在 Dify 控制台中创建或导入 Chatflow，选择对应的 `.yml` 文件。
2. 导入后，在 LLM 节点选择团队实际已配置的聊天模型。模板中的 `gpt-4o-mini` 只是占位名称。
3. 发布三个应用，并分别取得 WebApp 的公开访问地址或嵌入地址。
4. 将三个地址提供给前端配置，分别对应 `/student/psych`、`/student/life`、`/student/program`。

## 数据边界

这些模板不直接访问 MySQL，也不包含学生身份或数据库凭据。学生成绩、申请进度、心理画像等受保护数据，应由 FastAPI 基于当前登录身份校验后提供给 Dify 的受控工具接口。

海外生活支持应用导入后，应在 Dify 中挂接对应国家的知识库；心理关怀应用不能用作诊断或紧急救援替代服务。
