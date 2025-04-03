export default defineNuxtConfig({
  devtools: { enabled: true },

  // Enable Static Site Generation (SSG)
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss'
  ],

  css: [
    '@fortawesome/fontawesome-svg-core/styles.css'
  ],

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  },

  runtimeConfig: {
    // Keys within public are exposed client-side
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api' // Default to relative path for same-origin deployment or proxy
    }
  },

  compatibilityDate: '2025-04-03'
})