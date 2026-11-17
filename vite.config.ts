/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // 봇끼리 끝까지 돌리는 테스트가 많아서, 한꺼번에 돌리면 기본 5초를 넘길 때가 있음 (따로 돌리면 통과)
    testTimeout: 30_000,
  },
})
