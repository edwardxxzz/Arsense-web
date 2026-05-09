import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ✅ FIX: Firebase 12 + Vite 8 (Rolldown) têm incompatibilidade de módulos.
  // Forçar o Vite a otimizar (pré-bundlizar) todos os pacotes do Firebase
  // resolve o erro "Unexpected token 'export'" que aparece no console.
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
    ],
  },
  resolve: {
    // Garante que o Vite use sempre a versão ESM dos pacotes
    mainFields: ['module', 'main'],
  },
})