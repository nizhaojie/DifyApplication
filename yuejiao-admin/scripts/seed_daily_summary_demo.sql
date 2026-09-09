-- 演示用：补齐应提交人员角色与本周已提交日报。
-- 不改 ROLE_001–ROLE_010；只新增 employee/manager/team_leader，并改 12 名员工的 role_id。
SET NAMES utf8mb4;

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'employee', '员工', '企业内部员工'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'employee');

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'manager', '部门经理', '部门管理人员'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'manager');

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'team_leader', '班主任', '学生班主任角色'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'team_leader');

SET @role_employee = (SELECT id FROM sys_role WHERE role_code = 'employee' LIMIT 1);
SET @role_manager = (SELECT id FROM sys_role WHERE role_code = 'manager' LIMIT 1);
SET @role_team_leader = (SELECT id FROM sys_role WHERE role_code = 'team_leader' LIMIT 1);

UPDATE sys_user SET role_id = @role_manager
WHERE user_type = 'employee' AND id IN (301, 315);

UPDATE sys_user SET role_id = @role_team_leader
WHERE user_type = 'employee' AND id IN (302, 316);

UPDATE sys_user SET role_id = @role_employee
WHERE user_type = 'employee' AND id IN (303, 304, 305, 309, 310, 311, 312, 314);

INSERT INTO employee_daily_report
    (employee_id, report_date, raw_content, content, key_progress, risks, next_plan, status)
VALUES
(303, '2026-09-07',
 '跟进了几个英国意向客户，有一个卡签证材料。',
 '今日跟进英国意向客户 3 人，完成签证材料预审 1 份。李同学缺少无犯罪证明，已列出补件清单。与教务核对本周入学节点。',
 JSON_ARRAY('跟进英国意向客户 3 人', '完成签证材料预审 1 份'),
 JSON_ARRAY('李同学无犯罪证明仍缺，可能耽误递签'),
 '继续催李同学补件，并交接入学节点给教务。',
 'submitted'),
(303, '2026-09-08',
 '成交客户回访，流失预警客户打电话。',
 '回访成交客户王女士，确认开学住宿安排。对两名跟进停滞客户完成电话触达，其中一人表示仍在比较竞品。',
 JSON_ARRAY('成交客户开学住宿确认', '流失预警电话触达 2 人'),
 JSON_ARRAY('竞品比价客户可能本周流失'),
 '给比价客户补一封费用对照说明。',
 'submitted'),
(303, '2026-09-09',
 '写了两份学校匹配方案。',
 '完成美国硕博匹配方案 2 份，提交组长复核。协助财务核对一笔定金到账。',
 JSON_ARRAY('美国硕博匹配方案 2 份', '定金到账核对完成'),
 JSON_ARRAY(),
 '根据复核意见改方案，准备明日客户讲解。',
 'submitted'),
(304, '2026-09-08',
 '处理学生投诉工单。',
 '跟进签证办理类投诉 2 单，其中一单已补充进度说明。与学生助手核对情绪预警名单，提醒班主任关注。',
 JSON_ARRAY('签证投诉进度说明 1 单', '同步情绪预警给班主任'),
 JSON_ARRAY('另一单学生要求今晚前给书面时限'),
 '今晚前写出书面处理时限并回复。',
 'submitted'),
(304, '2026-09-09',
 '投诉单结了一张，还剩一单。',
 '关闭签证投诉 1 单。剩余住宿投诉仍待宿舍确认，已升级到组长。',
 JSON_ARRAY('关闭签证投诉 1 单', '住宿投诉升级组长'),
 JSON_ARRAY('宿舍确认逾期将再次超时'),
 '等待宿舍书面回复后结案。',
 'submitted'),
(305, '2026-09-07',
 '新客户录入和一次到访接待。',
 '新录入意向客户 4 人（澳洲本科）。完成到访接待 1 场，客户关注奖学金与语言班衔接。',
 JSON_ARRAY('新录入澳洲本科意向 4 人', '到访接待 1 场'),
 JSON_ARRAY('奖学金名额本周可能用尽，需当天确认'),
 '向项目部确认剩余奖学金名额。',
 'submitted'),
(309, '2026-09-08',
 '帮两个学生改文书。',
 '完成个人陈述修改 2 篇，退回 1 篇结构问题较大的初稿。与学生约定周四复交。',
 JSON_ARRAY('个人陈述修改 2 篇'),
 JSON_ARRAY('1 篇初稿结构仍不达标，周四节点紧'),
 '周四午前面谈该学生，先定提纲再写。',
 'submitted'),
(310, '2026-09-07',
 '组织组内晨会，分配本周客户。',
 '主持晨会，把 12 名停滞客户分到顾问。确认本周需要提交的学校名单截止到周三。',
 JSON_ARRAY('分配停滞客户 12 名', '明确周三学校名单截止'),
 JSON_ARRAY('两人请假，停滞客户跟进人手不足'),
 '向经理申请临时支援一名顾问。',
 'submitted'),
(310, '2026-09-09',
 '支援顾问还没到位。',
 '复核昨日跟进记录，3 名停滞客户仍未联系。已再次催办并抄送经理。',
 JSON_ARRAY('复核停滞客户跟进', '催办未联系的 3 人'),
 JSON_ARRAY('临时支援仍未到岗，覆盖率可能继续下降'),
 '若明日仍无人支援，缩减新客接待、优先挽回停滞客户。',
 'submitted'),
(314, '2026-09-08',
 '做了加拿大项目说明会准备。',
 '完成加拿大硕士说明会课件与问答清单。邀请在读学生 2 人做经验分享。',
 JSON_ARRAY('加拿大硕士说明会课件', '邀请在读学生分享 2 人'),
 JSON_ARRAY('场地投影未测，存在演示风险'),
 '明日上午到场测试投影。',
 'submitted'),
(301, '2026-09-09',
 '看了本周覆盖率和投诉积压。',
 '抽查日报覆盖，未提交人员已点名。协调投诉积压：住宿类 1 单升级，要求 24 小时内给学生书面时限。',
 JSON_ARRAY('点名未提交日报人员', '住宿投诉限 24 小时书面时限'),
 JSON_ARRAY('人手不足可能导致流失预警跟进中断'),
 '明日站会确认支援顾问是否到岗。',
 'submitted'),
(311, '2026-09-09',
 '还没写完。',
 '草稿：跟进记录未整理完毕。',
 NULL,
 NULL,
 NULL,
 'draft')
ON DUPLICATE KEY UPDATE
    raw_content = VALUES(raw_content),
    content = VALUES(content),
    key_progress = VALUES(key_progress),
    risks = VALUES(risks),
    next_plan = VALUES(next_plan),
    status = VALUES(status);
