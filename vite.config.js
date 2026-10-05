import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/node_modules/**', '**/.vs/**']
        }
        ,
        proxy: {
            // Proxy API requests to backend during development
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            }
            ,
            // Proxy auth endpoints (refresh/logout)
            '/auth': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            }
            ,
            // Proxy uploaded static files to backend so Vite doesn't try to parse them
            '/uploads': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            }
        }
    }
})