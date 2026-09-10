import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dify_api_base = (env.DIFY_API_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/$/, '')
  const dify_app_api_key = (env.DIFY_APP_API_KEY || '').trim()

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8002',
          changeOrigin: true,
        },
        '/dify-api': {
          target: dify_api_base,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dify-api/, ''),
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
