import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        port: 5173,
        open: true
    },
    preview: {
        host: '0.0.0.0',
        port: process.env.PORT || 3000,
        allowedHosts: [
            'localhost',
            '.railway.app',
            '.up.railway.app',
            'attractive-playfulness-production-0f41.up.railway.app'
        ]
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    }
}) 