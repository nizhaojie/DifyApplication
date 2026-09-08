from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


class FrozenClock:
    def __init__(self, now: datetime):
        if now.tzinfo is None:
            raise ValueError("clock must be timezone-aware")
        self._now = now.astimezone(SHANGHAI)

    def now(self) -> datetime:
        return self._now


class ShanghaiClock:
    def now(self) -> datetime:
        return datetime.now(SHANGHAI)
