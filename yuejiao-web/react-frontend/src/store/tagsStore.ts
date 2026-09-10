import { create } from 'zustand'

// 等价迁移自 Vue 版 stores/tags.ts(多页签):不持久化,由 AdminLayout 的路由副作用驱动。

export interface TagItem {
  path: string
  title: string
}

interface TagsState {
  visited: TagItem[]
  add: (tag: TagItem) => void
  remove: (path: string) => void
}

export const useTagsStore = create<TagsState>((set) => ({
  visited: [{ path: '/dashboard', title: '工作台' }],
  add(tag) {
    set((state) => {
      if (state.visited.some((item) => item.path === tag.path)) return state
      return { visited: [...state.visited, tag] }
    })
  },
  // /dashboard 不可移除(与 Vue 行为一致)
  remove(path) {
    if (path === '/dashboard') return
    set((state) => ({ visited: state.visited.filter((item) => item.path !== path) }))
  },
}))
