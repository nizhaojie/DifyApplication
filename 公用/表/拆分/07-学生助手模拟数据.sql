-- 学生智能助手模拟数据
-- 使用前提：已执行 db_init.sql，或已先执行 00-系统公用表.sql 与 06-初始化数据.sql。
-- 本脚本仅插入模拟数据，不包含 DROP / DELETE 语句。建议在演示库执行一次。

SET NAMES utf8mb4;

-- ============================================================
-- 1. 演示账号：3 名学生、班主任、心理老师、顾问和售后人员
-- 密码哈希为演示占位值，正式环境必须由认证模块生成真实密码哈希。
-- ============================================================

INSERT IGNORE INTO `sys_user`
(`username`, `password_hash`, `real_name`, `user_type`, `role_id`, `department`, `contact_info`, `status`)
VALUES
('stu_zhangming', '$2b$12$demo.hash.for.zhangming.student.account', '张明', 'student', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'student' LIMIT 1), '英国留学服务班', 'zhangming@example.com', 'normal'),
('stu_liuna', '$2b$12$demo.hash.for.liuna.student.account', '刘娜', 'student', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'student' LIMIT 1), '澳洲留学服务班', 'liuna@example.com', 'normal'),
('stu_chenyu', '$2b$12$demo.hash.for.chenyu.student.account', '陈宇', 'student', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'student' LIMIT 1), '新加坡留学服务班', 'chenyu@example.com', 'normal'),
('teacher_wang', '$2b$12$demo.hash.for.teacher.wang.account', '王老师', 'employee', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'team_leader' LIMIT 1), '学生服务部', 'wang.teacher@example.com', 'normal'),
('teacher_zhao', '$2b$12$demo.hash.for.teacher.zhao.account', '赵老师', 'employee', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'team_leader' LIMIT 1), '学生服务部', 'zhao.teacher@example.com', 'normal'),
('psych_sun', '$2b$12$demo.hash.for.psych.sun.account', '孙老师', 'employee', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'employee' LIMIT 1), '心理支持组', 'sun.psych@example.com', 'normal'),
('consultant_li', '$2b$12$demo.hash.for.consultant.li.account', '李顾问', 'employee', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'employee' LIMIT 1), '申请规划部', 'li.consultant@example.com', 'normal'),
('aftersales_zhou', '$2b$12$demo.hash.for.aftersales.zhou.account', '周专员', 'employee', (SELECT `id` FROM `sys_role` WHERE `role_code` = 'employee' LIMIT 1), '售后服务部', 'zhou.service@example.com', 'normal');

SET @stu_zhang := (SELECT `id` FROM `sys_user` WHERE `username` = 'stu_zhangming' LIMIT 1);
SET @stu_liu := (SELECT `id` FROM `sys_user` WHERE `username` = 'stu_liuna' LIMIT 1);
SET @stu_chen := (SELECT `id` FROM `sys_user` WHERE `username` = 'stu_chenyu' LIMIT 1);
SET @teacher_wang := (SELECT `id` FROM `sys_user` WHERE `username` = 'teacher_wang' LIMIT 1);
SET @teacher_zhao := (SELECT `id` FROM `sys_user` WHERE `username` = 'teacher_zhao' LIMIT 1);
SET @psych_sun := (SELECT `id` FROM `sys_user` WHERE `username` = 'psych_sun' LIMIT 1);
SET @consultant_li := (SELECT `id` FROM `sys_user` WHERE `username` = 'consultant_li' LIMIT 1);
SET @aftersales_zhou := (SELECT `id` FROM `sys_user` WHERE `username` = 'aftersales_zhou' LIMIT 1);

INSERT IGNORE INTO `student_info`
(`user_id`, `student_no`, `school`, `major`, `grade`, `abroad_country`, `class_teacher_id`, `enroll_date`, `status`)
VALUES
(@stu_zhang, 'YJ2026001', '曼彻斯特大学', '教育学', '硕士预科', '英国', @teacher_wang, '2026-02-20', 'active'),
(@stu_liu, 'YJ2026002', '悉尼大学', '数据科学', '硕士一年级', '澳大利亚', @teacher_wang, '2026-02-20', 'active'),
(@stu_chen, 'YJ2026003', '新加坡国立大学', '商业分析', '本科三年级', '新加坡', @teacher_zhao, '2026-02-20', 'active');

-- ============================================================
-- 2. 学业考务：成绩、通用 DDL 与学生专属 DDL
-- ============================================================

INSERT INTO `student_score` (`student_id`, `course_name`, `score`, `semester`, `credit`, `recorded_by`) VALUES
(@stu_zhang, '教育研究方法', 86.50, '2025-2026-2', 3.0, @teacher_wang),
(@stu_zhang, '学术英语写作', 91.00, '2025-2026-2', 2.0, @teacher_wang),
(@stu_zhang, '教育心理学', 83.00, '2025-2026-2', 3.0, @teacher_wang),
(@stu_liu, '机器学习基础', 92.00, '2025-2026-2', 4.0, @teacher_wang),
(@stu_liu, '数据可视化', 88.50, '2025-2026-2', 3.0, @teacher_wang),
(@stu_liu, '统计学进阶', 79.00, '2025-2026-2', 3.0, @teacher_wang),
(@stu_chen, '商业数据建模', 85.00, '2025-2026-2', 3.0, @teacher_zhao),
(@stu_chen, '管理沟通', 90.00, '2025-2026-2', 2.0, @teacher_zhao),
(@stu_chen, '微观经济学', 76.50, '2025-2026-2', 3.0, @teacher_zhao);

INSERT INTO `academic_deadline`
(`student_id`, `deadline_type`, `title`, `description`, `deadline`, `reminder_enabled`, `reminder_days`, `status`) VALUES
(NULL, 'paper', '论文选题提交', '提交选题确认表至教学平台主管。', '2026-09-12 17:00:00', 1, JSON_ARRAY(7, 3, 1), 'pending'),
(NULL, 'exam', '期中考试报名确认', '确认考试科目、考场安排和特殊需求。', '2026-09-18 18:00:00', 1, JSON_ARRAY(7, 1), 'reminded'),
(@stu_zhang, 'application', '曼彻斯特大学补充材料', '补交盖章成绩单与推荐信扫描件。', '2026-09-16 18:00:00', 1, JSON_ARRAY(7, 3, 1), 'pending'),
(@stu_zhang, 'visa', '英国签证体检预约', '完成指定医院体检预约并上传回执。', '2026-09-25 12:00:00', 1, JSON_ARRAY(14, 7, 1), 'pending'),
(@stu_liu, 'paper', '数据科学项目报告', '上传英文项目报告和代码说明文档。', '2026-09-22 23:59:00', 1, JSON_ARRAY(7, 3, 1), 'pending'),
(@stu_chen, 'other', '新生迎新说明会', '参加线上迎新说明会，了解课程注册流程。', '2026-09-08 19:00:00', 0, JSON_ARRAY(1), 'done');

-- ============================================================
-- 3. 请假与考务服务：待审批、已通过、已拒绝、已撤销
-- ============================================================

INSERT INTO `student_admin_service`
(`student_id`, `service_type`, `leave_type`, `start_time`, `end_time`, `reason`, `attachment_url`, `status`, `approver_id`, `approval_comment`, `approval_time`) VALUES
(@stu_zhang, 'leave', 'sick', '2026-09-10 08:00:00', '2026-09-10 18:00:00', '身体不适，申请请假一天。', 'https://example.com/mock/zhang-sick-note.pdf', 'pending', @teacher_wang, NULL, NULL),
(@stu_zhang, 'leave', 'personal', '2026-08-28 13:00:00', '2026-08-28 18:00:00', '办理家庭事务，申请下午请假。', NULL, 'approved', @teacher_wang, '已通过，请注意补齐当天课程内容。', '2026-08-27 16:20:00'),
(@stu_liu, 'leave', 'emergency', '2026-09-03 09:00:00', '2026-09-03 12:00:00', '家中突发情况，需要紧急处理。', NULL, 'rejected', @teacher_wang, '请补充相关说明后重新提交。', '2026-09-02 18:10:00'),
(@stu_chen, 'leave', 'personal', '2026-08-20 08:00:00', '2026-08-21 18:00:00', '计划出行与课程时间冲突。', NULL, 'cancelled', @teacher_zhao, NULL, NULL),
(@stu_liu, 'exam_query', NULL, NULL, NULL, '咨询期中考试考场和准考证领取时间。', NULL, 'approved', @teacher_wang, '考场安排已在教务通知中更新。', '2026-09-01 10:00:00');

-- ============================================================
-- 4. 心理关怀：低/中/高风险画像、历史记录与预警处理状态
-- ============================================================

INSERT IGNORE INTO `student_psych_profile`
(`student_id`, `latest_emotion_tag`, `emotion_score`, `last_interaction_time`, `risk_level`, `weekly_summary`) VALUES
(@stu_zhang, '焦虑', 58, '2026-09-08 10:20:00', 'medium', JSON_OBJECT('summary', '申请材料截止前出现焦虑，愿意与老师沟通。', 'trend', 'stable')),
(@stu_liu, '平稳', 82, '2026-09-07 19:30:00', 'low', JSON_OBJECT('summary', '近期学习状态稳定，对录取结果保持积极期待。', 'trend', 'positive')),
(@stu_chen, '低落', 32, '2026-09-08 21:10:00', 'high', JSON_OBJECT('summary', '连续表达明显低落和失眠，需要老师尽快人工跟进。', 'trend', 'declining'));

INSERT INTO `student_psych_record`
(`student_id`, `emotion_tag`, `emotion_score`, `interaction_content`, `trigger_keywords`, `record_date`) VALUES
(@stu_zhang, '焦虑', 58, '担心材料无法按时提交，希望确认下一步安排。', JSON_ARRAY('担心', '材料截止', '来不及'), '2026-09-08'),
(@stu_zhang, '平稳', 70, '在顾问解释材料流程后情绪有所缓解。', JSON_ARRAY('流程清楚', '缓解'), '2026-09-05'),
(@stu_liu, '平稳', 82, '分享拿到 conditional offer 后的开心情绪。', JSON_ARRAY('offer', '开心'), '2026-09-07'),
(@stu_liu, '疲惫', 65, '项目报告临近截止，感到有些疲惫。', JSON_ARRAY('报告', '疲惫'), '2026-09-04'),
(@stu_chen, '低落', 32, '连续失眠并表达对学习和生活的无力感。', JSON_ARRAY('失眠', '无力', '撑不住'), '2026-09-08'),
(@stu_chen, '焦虑', 45, '担心无法适应新的课程安排。', JSON_ARRAY('适应', '担心'), '2026-09-06');

INSERT INTO `student_psych_alert`
(`student_id`, `trigger_reason`, `risk_level`, `status`, `teacher_id`, `follow_record`, `resolved_time`) VALUES
(@stu_chen, '连续失眠、无力感和撑不住等高风险关键词，需要人工联系确认安全状态。', 'high', 'following', @psych_sun, '2026-09-08 21:30 已联系学生，约定次日上午进行电话沟通。', NULL),
(@stu_zhang, '材料截止前情绪波动明显，需关注后续压力变化。', 'medium', 'resolved', @psych_sun, '顾问已明确材料计划，学生表示焦虑缓解。', '2026-09-06 15:00:00'),
(@stu_liu, '项目报告期间短暂表达疲惫。', 'low', 'dismissed', @psych_sun, '未发现持续风险，保留日常观察记录。', NULL);

-- ============================================================
-- 5. 投诉反馈：投诉、建议、咨询及不同优先级和处理状态
-- ============================================================

INSERT INTO `student_feedback_ticket`
(`student_id`, `ticket_type`, `category`, `title`, `content`, `detail`, `status`, `priority`, `assignee_id`, `solution`, `satisfaction`, `is_notified`) VALUES
(@stu_zhang, 'complaint', '签证办理', '签证材料反馈较慢', '学生希望确认材料审核的预计反馈时间。', '我在三天前上传了签证材料，目前还没有收到审核反馈，希望明确预计处理时间。', 'processing', 'high', @aftersales_zhou, NULL, NULL, 0),
(@stu_liu, 'suggestion', '生活服务', '补充澳洲落地生活清单', '建议增加电话卡、银行卡和交通卡办理攻略。', '刚到澳洲的新生很需要落地后的第一周办事清单，希望知识库能按步骤整理。', 'resolved', 'medium', @aftersales_zhou, '已新增澳洲落地生活清单，并在海外生活知识库上线。', 5, 1),
(@stu_chen, 'consult', '院校申请', '推荐信提交方式咨询', '咨询推荐人是否需要注册院校系统账号。', '请问新加坡国立大学的推荐信需要推荐人自行上传，还是由学生统一提交？', 'closed', 'low', @consultant_li, '推荐人会收到院校系统邮件，请按邮件链接独立提交。', 4, 1),
(@stu_chen, 'complaint', '其他', '课程群答疑未及时响应', '学生反馈课程群问题较久未得到回复。', '上周五在课程群询问选课问题，直到周一仍未收到答复，影响选课安排。', 'pending', 'urgent', @aftersales_zhou, NULL, NULL, 0),
(@stu_zhang, 'consult', '院校申请', '个人陈述修改次数咨询', '咨询文书服务包含的修改轮次。', '想确认个人陈述服务是否包含第二轮修改，以及完成周期大概多久。', 'resolved', 'low', @consultant_li, '服务包含两轮修改，当前文书将在两个工作日内反馈。', 5, 1);

-- ============================================================
-- 6. 申请进度：材料准备、审核中、已获录取和签证办理中
-- ============================================================

INSERT INTO `application_progress`
(`student_id`, `target_school`, `target_major`, `stage`, `progress_detail`, `deadline`, `next_action`, `handler_id`) VALUES
(@stu_zhang, '曼彻斯特大学', '教育学硕士', 'under_review', '院校已确认收到完整申请材料，正在审核。', '2026-10-08', '等待审核结果；收到补件通知后 3 个工作日内反馈顾问。', @consultant_li),
(@stu_zhang, '格拉斯哥大学', '教育学硕士', 'document_prep', '个人陈述正在进行第二轮修改。', '2026-09-18', '确认个人陈述终稿并补充推荐人联系方式。', @consultant_li),
(@stu_liu, '悉尼大学', '数据科学硕士', 'offer_received', '已收到 conditional offer，等待补充最终成绩单。', '2026-09-30', '完成最终成绩单公证并上传院校系统。', @consultant_li),
(@stu_liu, '墨尔本大学', '数据科学硕士', 'visa_processing', 'CoE 已下发，签证材料正在整理。', '2026-10-15', '完成体检预约并确认签证表格信息。', @consultant_li),
(@stu_chen, '新加坡国立大学', '商业分析本科', 'submitted', '申请已提交，等待院校初审结果。', '2026-10-01', '保持手机和邮箱畅通，准备可能的面试材料。', @consultant_li);

-- ============================================================
-- 7. 海外生活知识与增值推荐项目
-- ============================================================

INSERT INTO `overseas_life_knowledge` (`country`, `category`, `title`, `content`, `status`) VALUES
('英国', 'medical', '英国 NHS 非紧急医疗服务', '注册 GP 后可预约常规诊疗；紧急危险情况请拨打 999，非紧急医疗建议可拨打 111 获取指引。', 1),
('英国', 'transport', '曼彻斯特公共交通出行', '市内可使用 contactless 或 Bee Network 相关票卡，出行前请确认末班车时间。', 1),
('英国', 'daily_life', '英国住宿入住检查清单', '入住当天建议拍照记录房屋状态，确认水电煤读数，并保留房东和中介联系方式。', 1),
('澳大利亚', 'medical', '澳大利亚就医与 OSHC', '学生应确认 OSHC 保险范围；紧急情况拨打 000，非紧急咨询可联系校内健康服务。', 1),
('澳大利亚', 'transport', '悉尼交通卡使用', '使用 Opal 卡或对应数字支付方式乘坐火车、公交和轮渡，注意每日及每周优惠规则。', 1),
('澳大利亚', 'emergency', '澳大利亚紧急求助', '遇到警察、消防或救护紧急情况请拨打 000；不方便通话时可使用当地官方紧急求助渠道。', 1),
('新加坡', 'medical', '新加坡校园医疗服务', '轻微不适可先预约校内诊所；紧急救护请拨打 995，并随身保留保险信息。', 1),
('新加坡', 'transport', '新加坡地铁与公交', '使用 EZ-Link 或支持的银行卡乘车，避开早晚高峰并留意末班车时间。', 1),
('新加坡', 'daily_life', '新加坡租房防骗提示', '租房前核验房东或中介身份，不向无法提供合同的一方支付押金，保留沟通和付款凭证。', 1);

INSERT INTO `course_project`
(`project_name`, `category`, `description`, `target_audience`, `price`, `duration`, `tags`, `status`) VALUES
('英国名校硕博申请规划', '学历提升', '提供选校定位、科研背景评估、文书规划和申请节奏管理。', '计划申请英国硕士、博士或二硕的学生', 39800.00, '6-10个月', JSON_ARRAY('英国', '硕博', '申请规划'), 1),
('科研背景提升计划', '背景提升', '围绕目标专业匹配科研项目、导师指导和成果展示方案。', '希望提升硕博申请竞争力的学生', 26800.00, '3-6个月', JSON_ARRAY('科研', '论文', '背景提升'), 1),
('学术英语写作强化营', '语言培训', '针对文献阅读、学术写作、引用规范和课堂展示进行训练。', '即将入读英语授课项目或需要提升论文写作能力的学生', 6800.00, '8周', JSON_ARRAY('英语', '论文', '学术写作'), 1),
('新加坡商业分析职业发展课', '就业提升', '结合商业分析项目实践、简历优化和求职面试辅导。', '商科、数据分析方向的在读学生', 12800.00, '10周', JSON_ARRAY('新加坡', '商业分析', '就业'), 1);

-- ============================================================
-- 8. 对话、待办与通知：用于展示学生端和企业端闭环
-- ============================================================

INSERT INTO `chat_session` (`session_id`, `user_id`, `visitor_name`, `status`, `last_message_time`) VALUES
('stu-zhang-20260908', @stu_zhang, '张明', 'active', '2026-09-08 10:20:00'),
('stu-liu-20260907', @stu_liu, '刘娜', 'closed', '2026-09-07 19:30:00'),
('stu-chen-20260908', @stu_chen, '陈宇', 'active', '2026-09-08 21:10:00');

INSERT INTO `chat_message` (`session_id`, `role`, `content`, `intent`, `tokens_used`, `response_time_ms`) VALUES
('stu-zhang-20260908', 'user', '我担心材料来不及提交，能帮我看一下截止日期吗？', 'academic_query', 68, NULL),
('stu-zhang-20260908', 'assistant', '曼彻斯特大学补充材料截止时间为 9 月 16 日 18:00，我可以帮你整理下一步。', 'academic_query', 132, 860),
('stu-liu-20260907', 'user', '我拿到 conditional offer 了，接下来要做什么？', 'progress_query', 42, NULL),
('stu-liu-20260907', 'assistant', '恭喜你。下一步需要完成最终成绩单公证并上传院校系统。', 'progress_query', 96, 720),
('stu-chen-20260908', 'user', '我连续失眠，感觉有点撑不住。', 'emotion_chat', 35, NULL),
('stu-chen-20260908', 'assistant', '谢谢你愿意说出来。你现在身边有可以联系和陪伴的人吗？我也会协助安排老师跟进。', 'emotion_chat', 118, 640);

SET @leave_pending := (SELECT `id` FROM `student_admin_service` WHERE `student_id` = @stu_zhang AND `status` = 'pending' ORDER BY `id` DESC LIMIT 1);
SET @leave_approved := (SELECT `id` FROM `student_admin_service` WHERE `student_id` = @stu_zhang AND `status` = 'approved' ORDER BY `id` DESC LIMIT 1);
SET @ticket_processing := (SELECT `id` FROM `student_feedback_ticket` WHERE `student_id` = @stu_zhang AND `status` = 'processing' ORDER BY `id` DESC LIMIT 1);
SET @psych_following := (SELECT `id` FROM `student_psych_alert` WHERE `student_id` = @stu_chen AND `status` = 'following' ORDER BY `id` DESC LIMIT 1);

INSERT INTO `todo_item`
(`assignee_id`, `todo_type`, `title`, `description`, `related_type`, `related_id`, `priority`, `status`, `due_time`) VALUES
(@teacher_wang, 'leave_approval', '待审批：张明病假申请', '张明申请 2026-09-10 请病假一天，请及时审批。', 'student_admin_service', @leave_pending, 'high', 'pending', '2026-09-09 18:00:00'),
(@aftersales_zhou, 'complaint_follow', '处理中：签证材料反馈较慢', '请在两个工作日内联系学生并同步材料审核进度。', 'student_feedback_ticket', @ticket_processing, 'high', 'in_progress', '2026-09-10 12:00:00'),
(@psych_sun, 'custom', '高风险心理预警：陈宇', '请优先进行人工联系并记录跟进结果。', 'student_psych_alert', @psych_following, 'urgent', 'in_progress', '2026-09-09 10:00:00');

INSERT INTO `notification_log`
(`user_id`, `notification_type`, `related_type`, `related_id`, `title`, `content`, `channel`, `status`) VALUES
(@teacher_wang, 'leave_pending', 'student_admin_service', @leave_pending, '新的请假审批待办', '张明提交了病假申请，请及时审批。', 'system', 'sent'),
(@stu_zhang, 'leave_approved', 'student_admin_service', @leave_approved, '请假申请已通过', '你 8 月 28 日下午的事假申请已通过，请注意补齐课程内容。', 'system', 'sent'),
(@stu_zhang, 'ticket_processing', 'student_feedback_ticket', @ticket_processing, '工单正在处理', '签证材料反馈问题已分配给售后专员处理。', 'system', 'sent'),
(@stu_liu, 'ticket_resolved', 'student_feedback_ticket', NULL, '建议已采纳', '澳洲落地生活清单已补充到知识库，感谢你的建议。', 'system', 'sent'),
(@stu_chen, 'psych_followup', 'student_psych_alert', @psych_following, '老师将与你联系', '孙老师会尽快联系你。如处于紧急危险中，请优先联系当地紧急支持。', 'system', 'pending'),
(@stu_zhang, 'deadline_reminder', 'academic_deadline', NULL, '申请材料截止提醒', '曼彻斯特大学补充材料将在 9 月 16 日截止。', 'system', 'sent');
