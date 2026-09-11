-- 企业助手演示数据。先跑 公用/表/db_init.sql，再跑本文件。
-- 演示账号密码都是 123456（哈希只用于本机演示，不要当生产口令）。
-- admin01 为系统管理员演示账号，密码 admin123（用户管理 / 角色配置面板入口）。
SET NAMES utf8mb4;

INSERT INTO `sys_user` (`username`, `password_hash`, `real_name`, `user_type`, `role_id`, `department`, `contact_info`, `status`)
SELECT 'admin01', '$2b$12$grbb/cehafP06b1Lemd1l.gPOYMRu8CllgmcIZdPJ3Z3HHl7fs226', '系统管理员', 'admin', r.id, '信息中心', NULL, 'normal'
FROM `sys_role` r WHERE r.role_code = 'admin'
AND NOT EXISTS (SELECT 1 FROM `sys_user` u WHERE u.username = 'admin01')
LIMIT 1;

INSERT INTO `sys_user` (`username`, `password_hash`, `real_name`, `user_type`, `role_id`, `department`, `contact_info`, `status`)
SELECT 'emp01', '$2b$12$ICJ3KSTO6ClVVP8NBaS62eijoJCyy.HzREa7pjCGwXdJsqn4xcQqa', '李顾问', 'employee', r.id, '招生部', '13800001001', 'normal'
FROM `sys_role` r WHERE r.role_code = 'employee'
AND NOT EXISTS (SELECT 1 FROM `sys_user` u WHERE u.username = 'emp01')
LIMIT 1;

INSERT INTO `sys_user` (`username`, `password_hash`, `real_name`, `user_type`, `role_id`, `department`, `contact_info`, `status`)
SELECT 'mgr01', '$2b$12$ICJ3KSTO6ClVVP8NBaS62eijoJCyy.HzREa7pjCGwXdJsqn4xcQqa', '王经理', 'employee', r.id, '招生部', '13800001002', 'normal'
FROM `sys_role` r WHERE r.role_code = 'manager'
AND NOT EXISTS (SELECT 1 FROM `sys_user` u WHERE u.username = 'mgr01')
LIMIT 1;

INSERT INTO `sys_user` (`username`, `password_hash`, `real_name`, `user_type`, `role_id`, `department`, `contact_info`, `status`)
SELECT 'stu01', '$2b$12$ICJ3KSTO6ClVVP8NBaS62eijoJCyy.HzREa7pjCGwXdJsqn4xcQqa', '张三', 'student', r.id, '在读学生', '13800002001', 'normal'
FROM `sys_role` r WHERE r.role_code = 'student'
AND NOT EXISTS (SELECT 1 FROM `sys_user` u WHERE u.username = 'stu01')
LIMIT 1;

INSERT INTO `sys_organization` (`org_name`, `parent_id`, `org_level`, `manager_id`, `sort_order`, `status`)
SELECT '粤教服务', NULL, 1, u.id, 1, 1
FROM `sys_user` u WHERE u.username = 'mgr01'
AND NOT EXISTS (SELECT 1 FROM `sys_organization` o WHERE o.org_name = '粤教服务')
LIMIT 1;

INSERT INTO `sys_organization` (`org_name`, `parent_id`, `org_level`, `manager_id`, `sort_order`, `status`)
SELECT '招生部', p.id, 2, u.id, 2, 1
FROM `sys_organization` p
JOIN `sys_user` u ON u.username = 'mgr01'
WHERE p.org_name = '粤教服务'
AND NOT EXISTS (SELECT 1 FROM `sys_organization` o WHERE o.org_name = '招生部')
LIMIT 1;

INSERT INTO `student_info` (`user_id`, `student_no`, `school`, `major`, `grade`, `abroad_country`, `class_teacher_id`, `status`)
SELECT u.id, 'YJ2026001', '粤教国际班', '商科', '大一', '德国', e.id, 'active'
FROM `sys_user` u
JOIN `sys_user` e ON e.username = 'emp01'
WHERE u.username = 'stu01'
AND NOT EXISTS (SELECT 1 FROM `student_info` s WHERE s.user_id = u.id)
LIMIT 1;

INSERT INTO `crm_lead` (`customer_name`, `contact_info`, `gender`, `education_level`, `intended_country`, `intended_major`, `source_channel`, `status`, `owner_employee_id`, `remark`)
SELECT '李四', '13900001111', 'M', '本科', '加拿大', '硕士', '线下活动', 'contacting', e.id, '演示：跟进中客户'
FROM `sys_user` e WHERE e.username = 'emp01'
AND NOT EXISTS (SELECT 1 FROM `crm_lead` l WHERE l.customer_name = '李四' AND l.contact_info = '13900001111')
LIMIT 1;

INSERT INTO `crm_follow_up` (`lead_id`, `employee_id`, `follow_type`, `content`, `next_plan`)
SELECT l.id, e.id, 'phone', '已电话沟通加拿大硕项目预算，家长还在考虑。', '本周五再回访一次'
FROM `crm_lead` l
JOIN `sys_user` e ON e.username = 'emp01'
WHERE l.customer_name = '李四'
AND NOT EXISTS (SELECT 1 FROM `crm_follow_up` f WHERE f.lead_id = l.id)
LIMIT 1;

INSERT INTO `student_admin_service` (`student_id`, `service_type`, `leave_type`, `start_time`, `end_time`, `reason`, `status`, `approver_id`)
SELECT s.id, 'leave', 'personal', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), '回家办理护照', 'pending', e.id
FROM `student_info` s
JOIN `sys_user` e ON e.username = 'emp01'
WHERE s.student_no = 'YJ2026001'
AND NOT EXISTS (
  SELECT 1 FROM `student_admin_service` a
  WHERE a.student_id = s.id AND a.service_type = 'leave' AND a.status = 'pending'
)
LIMIT 1;

INSERT INTO `todo_item` (`assignee_id`, `todo_type`, `title`, `description`, `related_type`, `related_id`, `priority`, `status`)
SELECT e.id, 'leave_approval', '审批张三的请假', '回家办理护照', 'student_admin_service', a.id, 'high', 'pending'
FROM `sys_user` e
JOIN `student_info` s ON s.student_no = 'YJ2026001'
JOIN `student_admin_service` a ON a.student_id = s.id AND a.status = 'pending'
WHERE e.username = 'emp01'
AND NOT EXISTS (SELECT 1 FROM `todo_item` t WHERE t.title = '审批张三的请假' AND t.assignee_id = e.id)
LIMIT 1;

INSERT INTO `student_feedback_ticket` (`student_id`, `ticket_type`, `category`, `title`, `content`, `status`, `priority`, `assignee_id`)
SELECT s.id, 'complaint', '签证办理', '签证材料进度慢', '提交材料一周还没有回音', 'pending', 'medium', e.id
FROM `student_info` s
JOIN `sys_user` e ON e.username = 'emp01'
WHERE s.student_no = 'YJ2026001'
AND NOT EXISTS (SELECT 1 FROM `student_feedback_ticket` t WHERE t.title = '签证材料进度慢')
LIMIT 1;

INSERT INTO `onboarding_guide` (`title`, `category`, `content`, `sort_order`, `status`)
SELECT '顾问日常工作节奏', '业务流程', '上午回访昨日意向客户，中午前提交口述日报，下午处理学生请假和投诉待办。客户状态只能是：新线索 / 跟进中 / 已合格 / 已签约 / 已流失。', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `onboarding_guide` g WHERE g.title = '顾问日常工作节奏');

INSERT INTO `onboarding_guide` (`title`, `category`, `content`, `sort_order`, `status`)
SELECT '客户录入口径', '入职指南', '口述录入一句话即可：姓名 + 电话 + 意向国家和层次，例如「张三 13800138000 想咨询美国硕士」。系统会写入 crm_lead。', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM `onboarding_guide` g WHERE g.title = '客户录入口径');
