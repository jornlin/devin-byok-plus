#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 开始打包 Devin BYOK Plus...${NC}\n"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ 未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

# 运行打包脚本
node scripts/package.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "\n${GREEN}✓ 打包完成！${NC}"
else
    echo -e "\n${RED}✗ 打包失败，退出码: $exit_code${NC}"
fi

exit $exit_code
