#!/bin/bash
# 检查 JavaScript 字符串中未转义的内嵌引号
# 防止类似 "text"内嵌"text"" 的语法错误

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "🔍 Checking for unescaped quotes in JavaScript strings..."

# 要检查的目录
DIRS="src resources/webviews"

found=0

for dir in $DIRS; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  # 查找可能存在未转义引号的模式
  # 模式：字符串内连续出现两个双引号（中间没有反斜杠）
  while IFS= read -r file; do
    # 跳过混淆代码文件（以 .min.js 结尾）
    if [[ "$file" == *.min.js ]]; then
      continue
    fi

    # 检查模式：\"[^\"]*\"[^\\]\"
    # 这会匹配类似 "text"未转义"text" 的情况
    if grep -nP '"[^"]*"[^\\]"' "$file" 2>/dev/null | grep -v '\\\"' | grep -v '://'; then
      echo -e "${RED}❌ Potential unescaped quote in: $file${NC}"
      echo -e "${YELLOW}请手动检查上述行是否有未转义的内嵌引号${NC}"
      echo ""
      found=$((found + 1))
    fi
  done < <(find "$dir" -type f \( -name "*.js" -o -name "*.ts" \) 2>/dev/null)
done

if [ $found -eq 0 ]; then
  echo -e "${GREEN}✅ No obvious quote escaping issues found!${NC}"
  echo -e "${YELLOW}⚠️  Note: This is a heuristic check. Manual review is recommended.${NC}"
  exit 0
else
  echo -e "${RED}❌ Found potential issues in $found file(s)${NC}"
  echo ""
  echo "Common fix:"
  echo "  \"text\"内嵌\"text\"  →  \"text\\\"内嵌\\\"text\""
  exit 1
fi
