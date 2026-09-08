<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string }>()

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function isSep(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim())
}

function render(raw: string) {
  const text = (raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  const chunks = text.split(/\n{2,}/)
  const html: string[] = []
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trimEnd()).filter((line) => line.length)
    if (!lines.length) continue
    if (lines.every((line) => line.trim().startsWith('|') && line.trim().endsWith('|'))) {
      const parsed = lines
        .filter((line) => !isSep(line))
        .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
      if (parsed.length) {
        const [head, ...body] = parsed
        html.push(
          `<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body
            .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`,
        )
      }
      continue
    }
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      html.push(`<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      const level = lines[0].startsWith('###') ? 3 : lines[0].startsWith('##') ? 2 : 1
      html.push(`<h${level}>${inline(lines[0].replace(/^#{1,3}\s+/, ''))}</h${level}>`)
      continue
    }
    html.push(`<p>${lines.map((line) => inline(line)).join('<br>')}</p>`)
  }
  return html.join('')
}

const html = computed(() => render(props.text))
</script>

<template>
  <div class="md-text" v-html="html" />
</template>
