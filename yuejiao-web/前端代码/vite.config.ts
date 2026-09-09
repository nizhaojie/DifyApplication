/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dify_api_base_url = env.DIFY_API_BASE_URL || 'http://127.0.0.1'
  const dify_app_api_key = env.DIFY_APP_API_KEY || ''

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      open: true,
      proxy: {
        '/dify-api': {
          target: dify_api_base_url,
          changeOrigin: true,
          timeout: 120000,
          rewrite: (request_path: string) => request_path.replace(/^\/dify-api/, '/v1'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxy_req) => {
              if (dify_app_api_key) {
                proxy_req.setHeader('Authorization', `Bearer ${dify_app_api_key}`)
              }
            })
          },
        },
      },
    },
  }
})
