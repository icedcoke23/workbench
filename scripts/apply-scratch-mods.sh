#!/usr/bin/env bash
# 将 scratch-gui-mods/ 下的魔改文件覆盖到 scratch-gui/src 对应位置
# 用法: bash scripts/apply-scratch-mods.sh [scratch-gui根目录]
#   默认 scratch-gui 根目录为仓库根下的 scratch-gui/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODS_DIR="$REPO_ROOT/scratch-gui-mods"
SCRATCH_GUI_DIR="${1:-$REPO_ROOT/scratch-gui}"

if [ ! -d "$SCRATCH_GUI_DIR/src" ]; then
    echo "错误: 未找到 scratch-gui/src 目录: $SCRATCH_GUI_DIR/src"
    echo "请先克隆官方 scratch-gui: git clone https://github.com/scratchfoundation/scratch-gui.git scratch-gui"
    exit 1
fi

if [ ! -d "$MODS_DIR" ]; then
    echo "错误: 未找到魔改目录: $MODS_DIR"
    exit 1
fi

echo "应用 scratch-gui 魔改..."
echo "  魔改目录: $MODS_DIR"
echo "  目标目录: $SCRATCH_GUI_DIR"
echo ""

# 递归复制 mods 下所有文件到 scratch-gui 对应位置（覆盖）
cd "$MODS_DIR"
COUNT=0
while IFS= read -r -d '' FILE; do
    REL="${FILE#$MODS_DIR/}"
    DEST="$SCRATCH_GUI_DIR/$REL"
    mkdir -p "$(dirname "$DEST")"
    cp "$FILE" "$DEST"
    echo "  ✓ $REL"
    COUNT=$((COUNT + 1))
done < <(find . -type f -print0)

echo ""
echo "完成: 共覆盖 $COUNT 个文件"
echo "下一步: cd scratch-gui && npm install && npm start"
