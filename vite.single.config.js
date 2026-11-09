import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// نسخة الملف الواحد fix — كل حاجة جوه index.html واحد يتفتح مباشرة من الملف
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single' },
})
