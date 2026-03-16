#!/bin/bash

# ============================================
# 大同世界 - 测试运行脚本
# ============================================

set -e

echo "🧪 大同世界测试套件"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境
check_env() {
    echo -e "\n📋 检查环境..."
    
    if [ -z "$SUPABASE_URL" ]; then
        echo -e "${RED}❌ 缺少 SUPABASE_URL${NC}"
        exit 1
    fi
    
    if [ -z "$SUPABASE_SERVICE_KEY" ]; then
        echo -e "${RED}❌ 缺少 SUPABASE_SERVICE_KEY${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 环境变量检查通过${NC}"
}

# 运行单元测试
run_unit_tests() {
    echo -e "\n${YELLOW}📦 运行单元测试...${NC}"
    
    if [ -f "tests/regression/unit/unit-test.ts" ]; then
        npx ts-node tests/regression/unit/unit-test.ts
    else
        echo -e "${YELLOW}⚠️  单元测试文件不存在${NC}"
    fi
}

# 运行端到端测试
run_e2e_tests() {
    echo -e "\n${YELLOW}🔗 运行端到端测试...${NC}"
    
    if [ -f "tests/regression/e2e/e2e-test.ts" ]; then
        npx ts-node tests/regression/e2e/e2e-test.ts
    else
        echo -e "${YELLOW}⚠️  E2E测试文件不存在${NC}"
    fi
}

# 运行安全测试
run_security_tests() {
    echo -e "\n${YELLOW}🔒 运行安全测试...${NC}"
    
    if [ -f "tests/regression/security/security-test.ts" ]; then
        npx ts-node tests/regression/security/security-test.ts
    else
        echo -e "${YELLOW}⚠️  安全测试文件不存在${NC}"
    fi
}

# 运行全面测试
run_comprehensive_tests() {
    echo -e "\n${YELLOW}🚀 运行全面测试套件...${NC}"
    
    if [ -f "tests/comprehensive-test-suite.ts" ]; then
        npx ts-node tests/comprehensive-test-suite.ts
    else
        echo -e "${YELLOW}⚠️  全面测试文件不存在${NC}"
    fi
}

# 主函数
main() {
    case "$1" in
        "unit")
            check_env
            run_unit_tests
            ;;
        "e2e")
            check_env
            run_e2e_tests
            ;;
        "security")
            check_env
            run_security_tests
            ;;
        "all")
            check_env
            run_unit_tests
            run_e2e_tests
            run_security_tests
            ;;
        "comprehensive")
            check_env
            run_comprehensive_tests
            ;;
        *)
            echo "用法: $0 {unit|e2e|security|all|comprehensive}"
            echo ""
            echo "  unit          - 运行单元测试"
            echo "  e2e           - 运行端到端测试"
            echo "  security      - 运行安全测试"
            echo "  all           - 运行所有测试"
            echo "  comprehensive - 运行全面测试套件 (160项)"
            exit 1
            ;;
    esac
}

main "$@"