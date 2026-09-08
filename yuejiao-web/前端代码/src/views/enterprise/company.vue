<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchCompany, fetchOrgs, type OrgItem } from '@/api/enterprise'

type OrgNode = OrgItem & { children: OrgNode[] }

const router = useRouter()
const loading = ref(false)
const card = ref<Record<string, unknown>>({})
const orgs = ref<OrgItem[]>([])

const orgTree = computed(() => {
  const map = new Map<number, OrgNode>()
  for (const item of orgs.value) {
    map.set(item.id, { ...item, children: [] })
  }
  const roots: OrgNode[] = []
  for (const item of orgs.value) {
    const node = map.get(item.id)
    if (!node) continue
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
})

onMounted(async () => {
  loading.value = true
  try {
    const [company, orgList] = await Promise.all([fetchCompany(), fetchOrgs()])
    card.value = company
    orgs.value = orgList
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section v-loading="loading" class="ent-page">
    <header class="ent-head">
      <div>
        <h1>公司简介</h1>
        <p class="hint">{{ card.full_name }}（{{ card.short_name }}）</p>
      </div>
      <el-button type="primary" @click="router.push('/enterprise')">去对话里问</el-button>
    </header>

    <article class="intro-hero">
      <p class="intro-body">{{ card.intro }}</p>
      <p class="muted">{{ card.transfer }}</p>
    </article>

    <div class="info-grid">
      <article class="info-card">
        <small>使命</small>
        <strong>{{ card.mission }}</strong>
      </article>
      <article class="info-card">
        <small>价值观</small>
        <strong>{{ card.values }}</strong>
      </article>
      <article class="info-card">
        <small>电话</small>
        <strong>{{ card.phone }}</strong>
        <p class="muted">{{ card.email }}</p>
      </article>
      <article class="info-card">
        <small>地址</small>
        <strong>{{ card.address }}</strong>
        <p class="muted">{{ card.site }}</p>
      </article>
    </div>

    <div class="chart-row">
      <div class="chart-card">
        <h3>主营业务</h3>
        <el-tag v-for="item in (card.business as string[]) || []" :key="item" class="chip-gap" effect="plain">
          {{ item }}
        </el-tag>
      </div>
      <div class="chart-card">
        <h3>组织架构</h3>
        <el-tree
          v-if="orgTree.length"
          :data="orgTree"
          :props="{ label: 'org_name', children: 'children' }"
          default-expand-all
        />
        <template v-else>
          <el-tag
            v-for="item in (card.departments as string[]) || []"
            :key="item"
            class="chip-gap"
            type="danger"
            effect="plain"
          >
            {{ item }}
          </el-tag>
        </template>
      </div>
    </div>
  </section>
</template>
