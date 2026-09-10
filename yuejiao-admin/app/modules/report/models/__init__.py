"""智能报告模块 ORM 模型包。

注:仓库中曾同时存在 models.py 与 models/ 包,在 Windows(大小写不敏感)文件系统上
互相遮蔽导致 `from app.modules.report.models import ReportGeneration` 失败;
已将原 models.py 内容并入本包 models/report.py。
"""

from app.modules.report.models.report import ReportGeneration

__all__ = ["ReportGeneration"]
