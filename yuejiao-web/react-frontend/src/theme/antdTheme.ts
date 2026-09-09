import type { ThemeConfig } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'

// 设计令牌与 Vue 版 style.css 的 :root 变量一一对应:
// --el-color-primary 及 light-3/5/7/8/9、dark-2 全部使用 EP 的确切色值,
// 保证按钮/链接/选中态与 Element Plus 视觉一致。

export const EP_PRIMARY = '#c41e1e'
export const EP_PRIMARY_LIGHT_3 = '#d95454'
export const EP_PRIMARY_LIGHT_5 = '#e27a7a'
export const EP_PRIMARY_LIGHT_7 = '#eca1a1'
export const EP_PRIMARY_LIGHT_8 = '#f2b8b8'
export const EP_PRIMARY_LIGHT_9 = '#fdecec'
export const EP_PRIMARY_DARK_2 = '#9d1818'
export const EP_ASIDE = '#1d1e1f'
export const EP_ASIDE_HOVER = '#2b2c2d'

export const yuejiaoTheme: ThemeConfig = {
  token: {
    colorPrimary: EP_PRIMARY,
    colorInfo: EP_PRIMARY,
    colorSuccess: '#67c23a',
    colorWarning: '#e6a23c',
    colorError: '#f56c6c',
    colorLink: EP_PRIMARY,
    borderRadius: 4,
    fontFamily:
      "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    colorBgBase: '#ffffff',
    colorTextBase: '#303133',
    colorPrimaryBg: EP_PRIMARY_LIGHT_9,
    colorPrimaryBgHover: EP_PRIMARY_LIGHT_8,
    colorPrimaryBorder: EP_PRIMARY_LIGHT_7,
    colorPrimaryBorderHover: EP_PRIMARY_LIGHT_5,
    colorPrimaryHover: EP_PRIMARY_LIGHT_3,
    colorPrimaryActive: EP_PRIMARY_DARK_2,
    colorPrimaryText: EP_PRIMARY,
    colorPrimaryTextHover: EP_PRIMARY_LIGHT_3,
    colorPrimaryTextActive: EP_PRIMARY_DARK_2,
  },
  components: {
    Menu: {
      darkItemBg: EP_ASIDE,
      darkSubMenuItemBg: EP_ASIDE,
      darkItemHoverBg: EP_ASIDE_HOVER,
      darkItemSelectedBg: EP_PRIMARY,
      darkItemSelectedColor: '#ffffff',
      darkItemColor: '#cfd3dc',
      darkGroupTitleColor: '#6b6e73',
      itemBorderRadius: 0,
      itemMarginInline: 0,
      itemMarginBlock: 0,
      activeBarBorderWidth: 0,
    },
    Table: {
      headerBg: '#f5f7fa',
      rowHoverBg: '#f5f7fa',
      borderColor: '#ebeef5',
    },
    Tag: {
      defaultBg: '#f4f4f5',
    },
    Tabs: {
      itemColor: '#303133',
      cardBg: '#fff',
    },
  },
}

export const yuejiaoLocale = zhCN
