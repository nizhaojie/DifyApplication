-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- knowledge_base
DROP TABLE IF EXISTS `knowledge_base`;
CREATE TABLE `knowledge_base` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `category`          ENUM('company_info','business','policy','faq','overseas_life') NOT NULL COMMENT '知识分类',
    `title`             VARCHAR(255)    NOT NULL                COMMENT '文档标题',
    `content`           TEXT            NOT NULL                COMMENT '文档内容',
    `source_file`       VARCHAR(512)    DEFAULT NULL            COMMENT '来源文件路径/URL',
    `chunk_index`       INT             NOT NULL DEFAULT 0      COMMENT '切片序号',
    `embedding_vector`  BLOB            DEFAULT NULL            COMMENT '向量化存储（用于RAG检索）',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`),
    FULLTEXT KEY `ft_content` (`title`,`content`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库文档表';

-- chat_session
DROP TABLE IF EXISTS `chat_session`;
CREATE TABLE `chat_session` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `session_id`        VARCHAR(64)     NOT NULL                COMMENT '会话唯一标识',
    `user_id`           BIGINT UNSIGNED DEFAULT NULL            COMMENT '关联用户ID（已注册用户）',
    `visitor_name`      VARCHAR(64)     DEFAULT NULL            COMMENT '访客昵称',
    `visitor_contact`   VARCHAR(128)    DEFAULT NULL            COMMENT '访客联系方式（用于线索收集）',
    `status`            ENUM('active','closed','timeout') NOT NULL DEFAULT 'active' COMMENT '会话状态',
    `last_message_time` DATETIME        DEFAULT NULL            COMMENT '最后一条消息时间',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `close_time`        DATETIME        DEFAULT NULL            COMMENT '会话关闭时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_id` (`session_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_last_message` (`last_message_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客服会话表';

-- chat_message
DROP TABLE IF EXISTS `chat_message`;
CREATE TABLE `chat_message` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `session_id`        VARCHAR(64)     NOT NULL                COMMENT '关联会话ID',
    `role`              ENUM('user','assistant','system') NOT NULL COMMENT '消息角色',
    `content`           TEXT            NOT NULL                COMMENT '消息内容',
    `intent`            VARCHAR(64)     DEFAULT NULL            COMMENT 'AI识别的意图（业务查询/政策咨询/闲聊等）',
    `tokens_used`       INT             DEFAULT NULL            COMMENT '本次消耗Token数',
    `response_time_ms`  INT             DEFAULT NULL            COMMENT '响应耗时（毫秒）',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_session_id` (`session_id`),
    KEY `idx_intent` (`intent`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客服消息记录表';

-- course_project
DROP TABLE IF EXISTS `course_project`;
CREATE TABLE `course_project` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `project_name`      VARCHAR(255)    NOT NULL                COMMENT '项目/课程名称',
    `category`          VARCHAR(64)     DEFAULT NULL            COMMENT '类别（语言培训/背景提升/硕博连读等）',
    `description`       TEXT            DEFAULT NULL            COMMENT '项目详情介绍',
    `target_audience`   VARCHAR(255)    DEFAULT NULL            COMMENT '适合人群/学历要求',
    `price`             DECIMAL(10,2)   DEFAULT NULL            COMMENT '价格',
    `duration`          VARCHAR(64)     DEFAULT NULL            COMMENT '课程周期',
    `tags`              JSON            DEFAULT NULL            COMMENT '标签（用于匹配推荐）',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=上架 0=下架',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程与项目表';

-- event_lecture
DROP TABLE IF EXISTS `event_lecture`;
CREATE TABLE `event_lecture` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `event_name`        VARCHAR(255)    NOT NULL                COMMENT '活动/讲座名称',
    `event_type`        ENUM('online','offline','hybrid') NOT NULL COMMENT '类型',
    `description`       TEXT            DEFAULT NULL            COMMENT '活动详情',
    `start_time`        DATETIME        NOT NULL                COMMENT '开始时间',
    `end_time`          DATETIME        DEFAULT NULL            COMMENT '结束时间',
    `location`          VARCHAR(255)    DEFAULT NULL            COMMENT '地点或线上链接',
    `max_participants`  INT             DEFAULT NULL            COMMENT '最大报名人数',
    `current_participants` INT          NOT NULL DEFAULT 0      COMMENT '当前报名人数',
    `organizer_id`      BIGINT UNSIGNED DEFAULT NULL            COMMENT '组织者ID',
    `status`            ENUM('upcoming','ongoing','ended','cancelled') NOT NULL DEFAULT 'upcoming' COMMENT '活动状态',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_event_type` (`event_type`),
    KEY `idx_status` (`status`),
    KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动与讲座表';

-- event_registration
DROP TABLE IF EXISTS `event_registration`;
CREATE TABLE `event_registration` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `event_id`          BIGINT UNSIGNED NOT NULL                COMMENT '关联活动ID',
    `user_id`           BIGINT UNSIGNED DEFAULT NULL            COMMENT '报名用户ID（注册用户）',
    `customer_name`     VARCHAR(64)     DEFAULT NULL            COMMENT '报名客户姓名（未注册用户）',
    `contact_info`      VARCHAR(128)    DEFAULT NULL            COMMENT '联系方式',
    `status`            ENUM('registered','attended','cancelled','no_show') NOT NULL DEFAULT 'registered' COMMENT '报名状态',
    `remark`            VARCHAR(255)    DEFAULT NULL            COMMENT '备注',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_event_user` (`event_id`,`user_id`),
    KEY `idx_event_id` (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动报名表';

