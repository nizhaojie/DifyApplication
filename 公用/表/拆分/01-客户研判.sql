-- 拆自 db_init.sql，教育服务原件未改。
-- 完整脚本见上级目录 db_init.sql
SET NAMES utf8mb4;

-- profile_rule
DROP TABLE IF EXISTS `profile_rule`;
CREATE TABLE `profile_rule` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `product_line`      VARCHAR(64)     NOT NULL                COMMENT '产品线（如：留学申请/背景提升/硕博连读）',
    `rule_name`         VARCHAR(128)    NOT NULL                COMMENT '规则名称',
    `rule_content`      JSON            NOT NULL                COMMENT '研判规则配置（JSON格式，含学历/语言/年龄等条件）',
    `match_prompt`      TEXT            DEFAULT NULL            COMMENT 'AI研判使用的系统提示词',
    `priority`          TINYINT         NOT NULL DEFAULT 0      COMMENT '优先级 数值越大越优先',
    `status`            TINYINT         NOT NULL DEFAULT 1      COMMENT '状态 1=启用 0=禁用',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_product_line` (`product_line`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户画像研判规则表';

-- customer_source
DROP TABLE IF EXISTS `customer_source`;
CREATE TABLE `customer_source` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `source_type`       ENUM('text','pdf_resume','excel','import','manual') NOT NULL COMMENT '信息来源类型',
    `raw_content`       TEXT            DEFAULT NULL            COMMENT '原始文本内容',
    `file_url`          VARCHAR(512)    DEFAULT NULL            COMMENT '上传文件URL（PDF/Excel）',
    `file_name`         VARCHAR(255)    DEFAULT NULL            COMMENT '原始文件名',
    `parse_status`      ENUM('pending','success','failed') NOT NULL DEFAULT 'pending' COMMENT '解析状态',
    `parse_result`      JSON            DEFAULT NULL            COMMENT 'AI解析后的结构化结果',
    `parse_error`       TEXT            DEFAULT NULL            COMMENT '解析失败原因',
    `operator_id`       BIGINT UNSIGNED DEFAULT NULL            COMMENT '操作人ID',
    `create_time`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_source_type` (`source_type`),
    KEY `idx_parse_status` (`parse_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户信息来源记录表';

-- customer_profile
DROP TABLE IF EXISTS `customer_profile`;
CREATE TABLE `customer_profile` (
    `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    `customer_name`         VARCHAR(64)     DEFAULT NULL            COMMENT '客户姓名',
    `contact_info`          VARCHAR(128)    DEFAULT NULL            COMMENT '联系方式',
    `source_id`             BIGINT UNSIGNED DEFAULT NULL            COMMENT '关联客户信息来源ID',
    `background_info`       JSON            DEFAULT NULL            COMMENT '客户背景信息结构化数据（学历/年龄/意向国家等）',
    `match_result`          ENUM('matched','partial','not_matched') DEFAULT NULL COMMENT '匹配结果',
    `matched_product`       VARCHAR(128)    DEFAULT NULL            COMMENT '匹配的产品线',
    `match_score`           DECIMAL(5,2)    DEFAULT NULL            COMMENT '匹配度评分（0-100）',
    `match_reason`          TEXT            DEFAULT NULL            COMMENT 'AI研判原因说明',
    `recommended_programs`  JSON            DEFAULT NULL            COMMENT '推荐的专业/项目列表',
    `evaluator_id`          BIGINT UNSIGNED DEFAULT NULL            COMMENT '研判人/操作人ID',
    `create_time`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_source_id` (`source_id`),
    KEY `idx_match_result` (`match_result`),
    KEY `idx_matched_product` (`matched_product`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户画像研判结果表';

