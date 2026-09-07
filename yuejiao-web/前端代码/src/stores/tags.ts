import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TagItem {
  path: string
  title: string
}

export const useTagsStore = defineStore('tags', () => {
  const visited = ref<TagItem[]>([{ path: '/dashboard', title: '工作台' }])

  function add(tag: TagItem) {
    if (!visited.value.some((item) => item.path === tag.path)) {
      visited.value.push(tag)
    }
  }

  function remove(path: string) {
    if (path === '/dashboard') return
    visited.value = visited.value.filter((item) => item.path !== path)
  }

  return { visited, add, remove }
})
