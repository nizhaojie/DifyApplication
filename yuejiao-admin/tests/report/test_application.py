from tests.conftest import KIND, WEEK_START


async def test_generate_commits_before_returning(app, db):
    """generate() 必须在返回前把结果提交，而不是依赖调用方的 session 兜底 commit。

    回归背景：曾经 generate() 内部只 flush 不 commit，真正的 commit 被推迟到
    FastAPI 的 yield 依赖在响应发出之后才兜底执行。于是客户端拿到"生成成功"
    响应时数据可能还没有落盘——紧接着刷新历史/当前报告的请求各自走一个新
    session/连接，用原生 SQL 查询不到刚生成的那一行，直到切换页面重新挂载
    组件时才恰好赶上提交完成、"突然出现"。

    这里用同一个 session 手动 rollback 来探测是否真的 commit 过：tests/conftest
    里的 db fixture 每次 commit 或 rollback 结束一个 SAVEPOINT 后都会自动重开
    一个新的 SAVEPOINT；如果 generate() 内部真的 commit 了，写入的数据早已从
    这次 SAVEPOINT 释放到外层事务，之后的 rollback 只会清空一个空 SAVEPOINT，
    数据依然可查。如果退化成只 flush 没 commit，数据还停留在当前 SAVEPOINT
    里，rollback 会把它和状态一起抹掉——current()/history() 走的正是 generate()
    实际暴露 bug 时用到的原生 SQL 查询路径，直接复用它们做断言。
    """
    report = await app.generate(KIND, WEEK_START)
    assert report.status == "completed"

    await db.rollback()

    current = await app.current(KIND, WEEK_START)
    assert current is not None
    assert current.id == report.id
    assert current.status == "completed"

    history = await app.history(KIND)
    assert any(item.id == report.id for item in history)
