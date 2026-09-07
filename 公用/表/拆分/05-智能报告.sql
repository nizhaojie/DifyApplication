-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- report_generation
DROP TABLE IF EXISTS `report_generation`;
CREATE TABLE `report_generation` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `report_type`       ENUM('customer_ops','daily_summary','weekly_summary','psych_weekly','complaint_weekly') NOT NULL COMMENT '报告类型',
    `report_title`      VARCHAR(255)    NOT NULL                COMMENT '报告标题',
    `report_content`    JSON            DEFAULT NULL            COMMENT '报告内容（结构化数据）',
    `report_html`       MEDIUMTEXT      DEFAULT NULL            COMMENT '报告HTML渲染内容',
    `period_start`      DATE            DEFAULT NULL            COMMENT '统计周期起始',
    `period_end`        DATE            DEFAULT NULL            COMMENT '统计周期结束',
    `generated_by`      BIGINT UNSIGNED DEFAULT NULL            COMMENT '生成人ID',
    `status`            ENUM('generating','completed','failed') NOT NULL DEFAULT 'generating' COMMENT '生成状态',
    `error_message`     TEXT            DEFAULT NULL            COMMENT '失败原因',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_report_type` (`report_type`),
    KEY `idx_period` (`period_start`,`period_end`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报告生成记录表';

-- report_schedule
DROP TABLE IF EXISTS `report_schedule`;
CREATE TABLE `report_schedule` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `report_type`       ENUM('customer_ops','daily_summary','weekly_summary','psych_weekly','complaint_weekly') NOT NULL COMMENT '报告类型',
    `schedule_cron`     VARCHAR(64)     NOT NULL                COMMENT 'Cron表达式',
    `recipients`        JSON            NOT NULL                COMMENT '接收人列表（用户ID数组）',
    `enabled`           TINYINT         NOT NULL DEFAULT 1      COMMENT '是否启用 1=启用 0=禁用',
    `last_run_time`     DATETIME        DEFAULT NULL            COMMENT '上次执行时间',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_report_type` (`report_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报告定时任务配置表';

