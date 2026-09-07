-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- student_info
DROP TABLE IF EXISTS `student_info`;
CREATE TABLE `student_info` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id`           BIGINT UNSIGNED NOT NULL                COMMENT '关联用户ID',
    `student_no`        VARCHAR(32)     DEFAULT NULL            COMMENT '学号',
    `school`            VARCHAR(128)    DEFAULT NULL            COMMENT '所在院校',
    `major`             VARCHAR(128)    DEFAULT NULL            COMMENT '专业',
    `grade`             VARCHAR(32)     DEFAULT NULL            COMMENT '年级',
    `abroad_country`    VARCHAR(64)     DEFAULT NULL            COMMENT '留学国家',
    `class_teacher_id`  BIGINT UNSIGNED DEFAULT NULL            COMMENT '班主任ID',
    `enroll_date`       DATE            DEFAULT NULL            COMMENT '入学日期',
    `status`            ENUM('active','graduated','suspended','withdrawn') NOT NULL DEFAULT 'active' COMMENT '学生状态',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_id` (`user_id`),
    KEY `idx_class_teacher` (`class_teacher_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生信息扩展表';

-- student_score
DROP TABLE IF EXISTS `student_score`;
CREATE TABLE `student_score` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID（关联sys_user）',
    `course_name`       VARCHAR(128)    NOT NULL                COMMENT '课程名称',
    `score`             DECIMAL(5,2)    NOT NULL                COMMENT '成绩',
    `semester`          VARCHAR(32)     DEFAULT NULL            COMMENT '学期（如 2025-2026-1）',
    `credit`            DECIMAL(3,1)    DEFAULT NULL            COMMENT '学分',
    `recorded_by`       BIGINT UNSIGNED DEFAULT NULL            COMMENT '录入人ID',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_semester` (`semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生成绩表';

-- student_admin_service
DROP TABLE IF EXISTS `student_admin_service`;
CREATE TABLE `student_admin_service` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `service_type`      ENUM('leave','exam_query','other') NOT NULL COMMENT '服务类型',
    `leave_type`        ENUM('sick','personal','emergency') DEFAULT NULL COMMENT '请假类型（仅请假时有效）',
    `start_time`        DATETIME        DEFAULT NULL            COMMENT '开始时间',
    `end_time`          DATETIME        DEFAULT NULL            COMMENT '结束时间',
    `reason`            TEXT            NOT NULL                COMMENT '申请事由',
    `attachment_url`    VARCHAR(512)    DEFAULT NULL            COMMENT '附件URL（如病假证明）',
    `status`            ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending' COMMENT '审批状态',
    `approver_id`       BIGINT UNSIGNED DEFAULT NULL            COMMENT '审批人/班主任ID',
    `approval_comment`  VARCHAR(512)    DEFAULT NULL            COMMENT '审批意见',
    `approval_time`     DATETIME        DEFAULT NULL            COMMENT '审批时间',
    `related_academic_id` BIGINT UNSIGNED DEFAULT NULL          COMMENT '关联教务数据ID',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_status` (`status`),
    KEY `idx_service_type` (`service_type`),
    KEY `idx_approver` (`approver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生行政服务表（请假/考务等申请）';

-- student_psych_profile
DROP TABLE IF EXISTS `student_psych_profile`;
CREATE TABLE `student_psych_profile` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`            BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `latest_emotion_tag`    VARCHAR(64)     DEFAULT NULL            COMMENT '最新情绪标签（焦虑/平稳/低落等）',
    `emotion_score`         INT             DEFAULT NULL            COMMENT '情绪分值（0-100，分值越高越积极）',
    `last_interaction_time` DATETIME        DEFAULT NULL            COMMENT '最近一次交互时间',
    `risk_level`            ENUM('low','medium','high') NOT NULL DEFAULT 'low' COMMENT '风险等级',
    `weekly_summary`        JSON            DEFAULT NULL            COMMENT '本周心理状态摘要',
    `create_time`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_student_id` (`student_id`),
    KEY `idx_risk_level` (`risk_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='心理健康画像表';

-- student_psych_record
DROP TABLE IF EXISTS `student_psych_record`;
CREATE TABLE `student_psych_record` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `emotion_tag`       VARCHAR(64)     DEFAULT NULL            COMMENT '情绪标签',
    `emotion_score`     INT             DEFAULT NULL            COMMENT '情绪分值（0-100）',
    `interaction_content` TEXT          DEFAULT NULL            COMMENT '交互内容摘要',
    `trigger_keywords`  JSON            DEFAULT NULL            COMMENT 'AI提取的触发关键词',
    `record_date`       DATE            NOT NULL                COMMENT '记录日期',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_date` (`student_id`,`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='心理健康记录表';

-- student_psych_alert
DROP TABLE IF EXISTS `student_psych_alert`;
CREATE TABLE `student_psych_alert` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `trigger_reason`    TEXT            NOT NULL                COMMENT '触发原因（AI提取的关键词或原句）',
    `risk_level`        ENUM('low','medium','high') NOT NULL    COMMENT '风险等级',
    `status`            ENUM('pending','following','resolved','dismissed') NOT NULL DEFAULT 'pending' COMMENT '处理状态',
    `teacher_id`        BIGINT UNSIGNED DEFAULT NULL            COMMENT '负责跟进的老师ID',
    `follow_record`     TEXT            DEFAULT NULL            COMMENT '跟进记录',
    `resolved_time`     DATETIME        DEFAULT NULL            COMMENT '解除时间',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_risk_level` (`risk_level`),
    KEY `idx_status` (`status`),
    KEY `idx_teacher_id` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='心理预警表';

-- student_feedback_ticket
DROP TABLE IF EXISTS `student_feedback_ticket`;
CREATE TABLE `student_feedback_ticket` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `ticket_type`       ENUM('complaint','suggestion','consult') NOT NULL DEFAULT 'complaint' COMMENT '工单类型',
    `category`          VARCHAR(64)     DEFAULT NULL            COMMENT '投诉分类（签证办理/院校申请/生活服务/其他）',
    `title`             VARCHAR(255)    DEFAULT NULL            COMMENT '工单标题',
    `content`           TEXT            NOT NULL                COMMENT '投诉/反馈内容摘要',
    `detail`            TEXT            DEFAULT NULL            COMMENT '详细反馈内容',
    `status`            ENUM('pending','processing','resolved','closed') NOT NULL DEFAULT 'pending' COMMENT '处理进度',
    `priority`          ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium' COMMENT '优先级',
    `assignee_id`       BIGINT UNSIGNED DEFAULT NULL            COMMENT '指派处理人ID',
    `solution`          TEXT            DEFAULT NULL            COMMENT '最终解决方案',
    `satisfaction`      TINYINT         DEFAULT NULL            COMMENT '满意度评分（1-5星）',
    `is_notified`       TINYINT         NOT NULL DEFAULT 0      COMMENT '是否已通知学生（0否 1是）',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_status` (`status`),
    KEY `idx_category` (`category`),
    KEY `idx_assignee` (`assignee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='售后反馈工单表';

-- application_progress
DROP TABLE IF EXISTS `application_progress`;
CREATE TABLE `application_progress` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED NOT NULL                COMMENT '学生ID',
    `target_school`     VARCHAR(128)    NOT NULL                COMMENT '目标院校',
    `target_major`      VARCHAR(128)    DEFAULT NULL            COMMENT '目标专业',
    `stage`             ENUM('document_prep','submitted','under_review','offer_received','visa_processing','enrolled') NOT NULL DEFAULT 'document_prep' COMMENT '申请阶段',
    `progress_detail`   TEXT            DEFAULT NULL            COMMENT '进度详情描述',
    `deadline`          DATE            DEFAULT NULL            COMMENT '关键截止日期',
    `next_action`       VARCHAR(255)    DEFAULT NULL            COMMENT '下一步操作',
    `handler_id`        BIGINT UNSIGNED DEFAULT NULL            COMMENT '负责顾问ID',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_stage` (`stage`),
    KEY `idx_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留学申请进度追踪表';

-- academic_deadline
DROP TABLE IF EXISTS `academic_deadline`;
CREATE TABLE `academic_deadline` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `student_id`        BIGINT UNSIGNED DEFAULT NULL            COMMENT '学生ID（NULL=通用DDL）',
    `deadline_type`     ENUM('paper','exam','application','visa','other') NOT NULL COMMENT 'DDL类型',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '节点名称',
    `description`       TEXT            DEFAULT NULL            COMMENT '描述',
    `deadline`          DATETIME        NOT NULL                COMMENT '截止时间',
    `reminder_enabled`  TINYINT         NOT NULL DEFAULT 1      COMMENT '是否开启提醒',
    `reminder_days`     JSON            DEFAULT NULL            COMMENT '提前提醒天数配置 [7,3,1]',
    `status`            ENUM('pending','reminded','done','missed') NOT NULL DEFAULT 'pending' COMMENT '状态',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_deadline` (`deadline`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学业关键节点/DDL表';

-- overseas_life_knowledge
DROP TABLE IF EXISTS `overseas_life_knowledge`;
CREATE TABLE `overseas_life_knowledge` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `country`           VARCHAR(64)     NOT NULL                COMMENT '国家',
    `category`          ENUM('medical','transport','emergency','daily_life','other') NOT NULL COMMENT '分类',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '知识标题',
    `content`           TEXT            NOT NULL                COMMENT '知识内容',
    `embedding_vector`  BLOB            DEFAULT NULL            COMMENT '向量化存储',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_country` (`country`),
    KEY `idx_category` (`category`),
    FULLTEXT KEY `ft_knowledge` (`title`,`content`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='海外生活知识库';

