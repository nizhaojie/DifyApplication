-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- crm_lead
DROP TABLE IF EXISTS `crm_lead`;
CREATE TABLE `crm_lead` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `customer_name`     VARCHAR(64)     NOT NULL                COMMENT '客户姓名',
    `contact_info`      VARCHAR(128)    DEFAULT NULL            COMMENT '联系方式（手机/邮箱）',
    `gender`            ENUM('M','F','U') DEFAULT 'U'           COMMENT '性别',
    `age`               INT             DEFAULT NULL            COMMENT '年龄',
    `education_level`   VARCHAR(64)     DEFAULT NULL            COMMENT '学历层次',
    `intended_country`  VARCHAR(128)    DEFAULT NULL            COMMENT '意向国家（多值逗号分隔）',
    `intended_major`    VARCHAR(128)    DEFAULT NULL            COMMENT '意向专业',
    `background_info`   TEXT            DEFAULT NULL            COMMENT '客户背景与档案',
    `customer_profile_id` BIGINT UNSIGNED DEFAULT NULL          COMMENT '关联客户画像ID',
    `source_channel`    VARCHAR(64)     DEFAULT NULL            COMMENT '来源渠道（线上/线下/转介绍等）',
    `status`            ENUM('new','contacting','qualified','signed','lost') NOT NULL DEFAULT 'new' COMMENT '流转状态',
    `owner_employee_id` BIGINT UNSIGNED NOT NULL                COMMENT '负责员工ID',
    `last_contact_time` DATETIME        DEFAULT NULL            COMMENT '最后联系时间',
    `lost_reason`       VARCHAR(255)    DEFAULT NULL            COMMENT '流失原因',
    `remark`            TEXT            DEFAULT NULL            COMMENT '备注',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`),
    KEY `idx_owner` (`owner_employee_id`),
    KEY `idx_customer_profile` (`customer_profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='意向客户表';

-- crm_follow_up
DROP TABLE IF EXISTS `crm_follow_up`;
CREATE TABLE `crm_follow_up` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `lead_id`           BIGINT UNSIGNED NOT NULL                COMMENT '关联意向客户ID',
    `employee_id`       BIGINT UNSIGNED NOT NULL                COMMENT '跟进人ID',
    `follow_type`       ENUM('phone','wechat','meeting','email','other') DEFAULT NULL COMMENT '跟进方式',
    `content`           TEXT            NOT NULL                COMMENT '跟进记录内容',
    `next_plan`         VARCHAR(255)    DEFAULT NULL            COMMENT '下次跟进计划',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_lead_id` (`lead_id`),
    KEY `idx_employee_id` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户跟进记录表';

-- employee_daily_report
DROP TABLE IF EXISTS `employee_daily_report`;
CREATE TABLE `employee_daily_report` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `employee_id`       BIGINT UNSIGNED NOT NULL                COMMENT '员工ID',
    `report_date`       DATE            NOT NULL                COMMENT '日报所属日期',
    `raw_content`       TEXT            DEFAULT NULL            COMMENT '原始口述/输入内容',
    `content`           TEXT            NOT NULL                COMMENT 'AI结构化后的日报文本',
    `key_progress`      JSON            DEFAULT NULL            COMMENT 'AI提取的核心进展',
    `risks`             JSON            DEFAULT NULL            COMMENT 'AI识别的潜在风险',
    `next_plan`         TEXT            DEFAULT NULL            COMMENT '明日计划',
    `status`            ENUM('draft','submitted') NOT NULL DEFAULT 'draft' COMMENT '状态',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_employee_date` (`employee_id`,`report_date`),
    KEY `idx_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工日报表';

-- onboarding_guide
DROP TABLE IF EXISTS `onboarding_guide`;
CREATE TABLE `onboarding_guide` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '指引标题',
    `category`          VARCHAR(64)     NOT NULL                COMMENT '分类（入职指南/规章制度/业务流程等）',
    `content`           TEXT            NOT NULL                COMMENT '指引内容',
    `embedding_vector`  BLOB            DEFAULT NULL            COMMENT '向量化存储（用于RAG检索）',
    `sort_order`        INT             NOT NULL DEFAULT 0      COMMENT '排序权重',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新人入职指引知识库';

