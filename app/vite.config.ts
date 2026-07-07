import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 상대경로 배포: 도메인 루트/하위 폴더 어디에 올려도 asset·삽도가 정상 로드됨
  // (cafe24 등 정적 웹호스팅용). 삽도는 import.meta.env.BASE_URL 를 따라감.
  base: './',
  plugins: [react()],
})
