import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// 拷贝 better-sqlite3 的原生 .node 文件到 out 目录（打包需要）
// 交叉打包时优先使用 build/Release 下的预编译二进制（已替换为目标平台版本）
function copyNativeAssets() {
  return {
    name: 'copy-native-assets',
    closeBundle() {
      try {
        const candidates = [
          'node_modules/better-sqlite3/build/Release/better_sqlite3.node'
        ]
        const outDir = resolve('out/main')
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
        for (const c of candidates) {
          if (existsSync(c)) {
            copyFileSync(c, resolve(outDir, 'better_sqlite3.node'))
          }
        }
      } catch {
        // 忽略拷贝错误
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyNativeAssets()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          scratch: resolve('src/preload/scratch.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      vue(),
      vueJsx(),
      Components({
        resolvers: [
          AntDesignVueResolver({ importStyle: false, resolveIcons: true })
        ],
        dts: false
      })
    ],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
