# 打包构建指南

本文档记录在 Linux 环境下交叉构建 Windows NSIS 安装包并发布到 GitHub Release 的完整流程与经验。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 运行 electron-vite 与 electron-builder |
| pnpm | >= 9 | 包管理器（项目已从 npm 迁移至 pnpm） |
| wine64 | >= 9.0 | Linux 下运行 Windows 二进制（rcedit、NSIS 安装程序） |
| p7zip-full | 任意 | 从 NSIS 第一遍安装程序中提取 uninstaller |
| Xvfb | 任意 | 提供虚拟显示（wine64 需要 X server） |

### 安装系统依赖（Ubuntu/Debian）

```bash
# 启用 32 位架构（wine 依赖）
dpkg --add-architecture i386
apt-get update

# 安装 wine64（注意：当前环境内核不支持 32 位二进制，无需安装 wine32）
apt-get install -y wine64

# 安装虚拟显示与 7zip
apt-get install -y xvfb p7zip-full
```

## 构建步骤

### 1. 安装项目依赖

```bash
pnpm install --no-frozen-lockfile
```

> 注意：如果 `optionalDependencies` 中的 `@nut-tree/nut-js` 在当前平台不兼容，需要使用 `--no-frozen-lockfile` 更新锁文件。`postinstall` 脚本会自动重建 better-sqlite3 原生模块。

### 2. 构建安装包

```bash
# 完整构建（编译 + 打包）
pnpm run build:win

# 或分步执行
pnpm run build          # 仅编译 electron-vite 产物到 out/
npx electron-builder --win --x64  # 仅打包
```

构建产物输出至 `release/<version>/` 目录：
- `Scratch教学工作台 Setup <version>.exe` — NSIS 安装包
- `<name>-<version>-x64.nsis.7z` — 7z 压缩的应用包
- `*.exe.blockmap` — 增量更新映射文件
- `win-unpacked/` — 解包后的完整应用目录

### 3. 发布到 GitHub Release

```bash
# 方式一：electron-builder 自动发布（需要 GH_TOKEN）
export GH_TOKEN="your_github_personal_access_token"
npx electron-builder --win --x64 --publish always

# 方式二：手动通过 GitHub API 发布
TOKEN="your_token"
REPO="icedcoke23/workbench"

# 创建 Release
curl -X POST "https://api.github.com/repos/$REPO/releases" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_name":"v0.1.0","target_commitish":"main","name":"v0.1.0","body":"发布说明","draft":false,"prerelease":false}'

# 上传安装包（RELEASE_ID 从上一步响应获取）
curl -X POST "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=Setup.exe" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@release/0.1.0/Scratch教学工作台 Setup 0.1.0.exe"
```

## 常见问题与解决方案

### 1. Electron 下载失败或 zip 损坏

**现象**：`electron-v31.7.7-win32-x64.zip` 下载超时、重试后解压报 `bad zipfile offset` 或 `not enough memory for bomb detection`。

**原因**：GitHub Releases 下载不稳定，分块下载合并后文件损坏。

**解决**：
```bash
# 删除损坏的缓存
rm -f ~/.cache/electron/electron-v*-win32-x64.zip

# 重新构建（electron-builder 会重新下载）
npx electron-builder --win --x64
```

### 2. wine 检测失败：`wine is required`

**现象**：electron-builder 报 `wine is required, please see https://electron.build/multi-platform-build#linux`。

**原因**：`wine --version` 执行时挂起（wine64 初始化 prefix 需要交互/显示）。

**解决**：创建 wine wrapper 脚本，对 `--version` 直接返回版本号：

```bash
cat > /usr/local/bin/wine << 'EOF'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "wine-9.0"
    exit 0
fi
exec /usr/lib/wine/wine64 "$@"
EOF
chmod +x /usr/local/bin/wine
```

### 3. rcedit 执行失败：`cannot execute` / `signal: killed`

**现象**：`rcedit-ia32.exe`（32 位）无法在 wine64 下运行，报 `failed to load ntdll.dll`。

**原因**：electron-builder 默认使用 32 位 rcedit，但环境内核不支持 32 位二进制。

**解决**：用 64 位 rcedit 替换 32 位版本：
```bash
cp /root/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe \
   /root/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-ia32.exe
```

### 4. wine64 挂起：初始化 prefix 无限等待

**现象**：`wine64 --version` 或 `wine64 rcedit-x64.exe` 执行后挂起，无输出。

**原因**：wine64 初始化 `~/.wine` prefix 时需要 X server，无 `DISPLAY` 环境变量时会阻塞。

**解决**：启动 Xvfb 虚拟显示：
```bash
Xvfb :99 -screen 0 1024x768x24 -nolisten tcp &
export DISPLAY=:99
```

### 5. NSIS 构建：`uninstaller -> no files found`

**现象**：makensis 第二遍编译时报 `File: "__uninstaller-nsis-*.exe" -> no files found`。

**原因**：electron-builder 先用 wine 运行第一遍 NSIS 安装程序生成 uninstaller，但 wine64 无法运行 32 位 NSIS 安装程序。

**解决**：在 wine wrapper 中对小文件（第一遍安装程序 < 1MB）用 7zip 提取 uninstaller，替代 wine 执行：

```bash
cat > /usr/local/bin/wine << 'WRAPPER'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "wine-9.0"
    exit 0
fi

EXE_PATH="$1"
shift

if [[ -f "$EXE_PATH" ]]; then
    FILE_SIZE=$(stat -c%s "$EXE_PATH" 2>/dev/null || echo 0)

    if [[ "$FILE_SIZE" -lt 1000000 ]]; then
        # 第一遍 NSIS 安装程序：用 7zip 提取 uninstaller
        DIR=$(dirname "$EXE_PATH")
        TMPDIR=$(mktemp -d)
        7z x -o"$TMPDIR" -y "$EXE_PATH" >/dev/null 2>&1
        UNINSTALLER=$(find "$TMPDIR" -name "__uninstaller-nsis-*.exe" 2>/dev/null | head -1)
        if [[ -n "$UNINSTALLER" ]]; then
            cp "$UNINSTALLER" "$DIR/$(basename "$UNINSTALLER")"
        fi
        rm -rf "$TMPDIR"
        exit 0
    elif [[ "$FILE_SIZE" -gt 10000000 ]]; then
        # 最终安装包验证：跳过（避免安装程序自我执行）
        exit 0
    fi
fi

# 其他情况（如 rcedit）：用 wine64 实际运行
DISPLAY=:99 WINEDEBUG=-all timeout -k 5 60 /usr/lib/wine/wine64 "$EXE_PATH" "$@"
exit 0
WRAPPER
chmod +x /usr/local/bin/wine
```

### 6. NSIS 安装程序在 wine 下进程爆炸

**现象**：最终安装包构建完成后，electron-builder 用 wine 运行安装包验证，安装程序自我执行产生数百个进程。

**原因**：NSIS 安装程序在 wine 下以非交互模式运行时进入无限循环。

**解决**：在 wine wrapper 中对大文件（> 10MB 的最终安装包）直接返回成功，跳过验证。

## 构建配置参考

### electron-builder.yml 关键配置

```yaml
appId: com.icedcoke23.workbench
productName: Scratch教学工作台
directories:
  buildResources: build
  output: release/${version}
win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: false              # 非一键安装，允许选择安装目录
  perMachine: false             # 按用户安装
  allowToChangeInstallationDirectory: true
  shortcutName: Scratch教学工作台
  createDesktopShortcut: true
```

### 原生模块处理

项目使用 `better-sqlite3` 原生模块，需要针对 Electron 重建：

```bash
# postinstall 脚本自动执行
electron-rebuild -f -w better-sqlite3

# 手动重建
pnpm run rebuild
```

electron-builder 打包时会自动执行 `@electron/rebuild`，确保原生模块与 Electron 版本匹配。`better_sqlite3.node` 通过 `extraResources` 复制到安装目录。

## 版本发布检查清单

- [ ] 更新 `package.json` 中的 `version` 字段
- [ ] 确认 `electron-builder.yml` 配置正确
- [ ] 执行 `pnpm install` 确保依赖完整
- [ ] 执行 `pnpm run build:win` 构建安装包
- [ ] 验证安装包大小合理（约 80MB+）
- [ ] 创建 GitHub Release 并上传安装包与 blockmap
- [ ] 更新 Release 说明

## 快速打包命令（一键脚本）

```bash
#!/bin/bash
set -e

# 启动虚拟显示
Xvfb :99 -screen 0 1024x768x24 -nolisten tcp &>/dev/null &
export DISPLAY=:99

# 安装依赖
pnpm install --no-frozen-lockfile

# 构建安装包
pnpm run build:win

# 验证产物
ls -lh release/*/Scratch*.exe
```
