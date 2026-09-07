-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- sys_role
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `role_code`     VARCHAR(32)     NOT NULL                COMMENT '角色编码（如 ADMIN/EMPLOYEE/STUDENT）',
    `role_name`     VARCHAR(64)     NOT NULL                COMMENT '角色名称',
    `description`   VARCHAR(255)    DEFAULT NULL            COMMENT '角色描述',
    `status`        TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统角色字典表';

-- sys_user
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `username`          VARCHAR(64)     NOT NULL                COMMENT '登录账号',
    `password_hash`     VARCHAR(255)    NOT NULL                COMMENT '密码哈希',
    `real_name`         VARCHAR(64)     NOT NULL                COMMENT '真实姓名',
    `user_type`         ENUM('student','employee','admin') NOT NULL COMMENT '用户类型',
    `role_id`           BIGINT UNSIGNED DEFAULT NULL            COMMENT '关联角色ID',
    `department`        VARCHAR(128)    DEFAULT NULL            COMMENT '所属部门/院系',
    `contact_info`      VARCHAR(128)    DEFAULT NULL            COMMENT '联系方式（手机号/邮箱）',
    `avatar_url`        VARCHAR(512)    DEFAULT NULL            COMMENT '头像URL',
    `status`            ENUM('normal','disabled') NOT NULL DEFAULT 'normal' COMMENT '账号状态',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    KEY `idx_user_type` (`user_type`),
    KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='统一用户表（学生/员工/管理员）';

-- sys_organization
DROP TABLE IF EXISTS `sys_organization`;
CREATE TABLE `sys_organization` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `org_name`      VARCHAR(128)    NOT NULL                COMMENT '组织/部门名称',
    `parent_id`     BIGINT UNSIGNED DEFAULT NULL            COMMENT '上级组织ID',
    `org_level`     TINYINT         NOT NULL DEFAULT 1      COMMENT '层级 1=公司 2=部门 3=小组',
    `manager_id`    BIGINT UNSIGNED DEFAULT NULL            COMMENT '负责人ID',
    `sort_order`    INT             NOT NULL DEFAULT 0      COMMENT '排序权重',
    `status`        TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=停用',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`),
    KEY `idx_manager_id` (`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组织架构表';

-- intent_config
DROP TABLE IF EXISTS `intent_config`;
CREATE TABLE `intent_config` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `intent_code`       VARCHAR(64)     NOT NULL                COMMENT '意图编码',
    `intent_name`       VARCHAR(128)    NOT NULL                COMMENT '意图名称',
    `scene`             ENUM('customer_service','enterprise','student') NOT NULL COMMENT '适用场景',
    `system_prompt`     TEXT            DEFAULT NULL            COMMENT '该意图对应的系统提示词',
    `routing_rule`      JSON            DEFAULT NULL            COMMENT '路由规则配置',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_intent_scene` (`intent_code`,`scene`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI意图识别配置表';

-- todo_item
DROP TABLE IF EXISTS `todo_item`;
CREATE TABLE `todo_item` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `assignee_id`       BIGINT UNSIGNED NOT NULL                COMMENT '指派人ID',
    `todo_type`         ENUM('leave_approval','complaint_follow','report_remind','custom') NOT NULL COMMENT '待办类型',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '待办标题',
    `description`       TEXT            DEFAULT NULL            COMMENT '待办描述',
    `related_type`      VARCHAR(64)     DEFAULT NULL            COMMENT '关联业务类型',
    `related_id`        BIGINT UNSIGNED DEFAULT NULL            COMMENT '关联业务ID',
    `priority`          ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium' COMMENT '优先级',
    `status`            ENUM('pending','in_progress','done','cancelled') NOT NULL DEFAULT 'pending' COMMENT '状态',
    `due_time`          DATETIME        DEFAULT NULL            COMMENT '截止时间',
    `completed_time`    DATETIME        DEFAULT NULL            COMMENT '完成时间',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_assignee` (`assignee_id`),
    KEY `idx_status` (`status`),
    KEY `idx_todo_type` (`todo_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待办事项表';

-- notification_log
DROP TABLE IF EXISTS `notification_log`;
CREATE TABLE `notification_log` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id`           BIGINT UNSIGNED NOT NULL                COMMENT '接收人ID',
    `notification_type` VARCHAR(64)     NOT NULL                COMMENT '通知类型',
    `related_type`      VARCHAR(64)     DEFAULT NULL            COMMENT '关联业务类型',
    `related_id`        BIGINT UNSIGNED DEFAULT NULL            COMMENT '关联业务ID',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '通知标题',
    `content`           TEXT            NOT NULL                COMMENT '通知内容',
    `channel`           ENUM('system','email','sms','wechat') NOT NULL DEFAULT 'system' COMMENT '通知渠道',
    `status`            ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending' COMMENT '发送状态',
    `error_message`     TEXT            DEFAULT NULL            COMMENT '失败原因',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='提醒通知记录表';

