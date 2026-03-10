#!/bin/bash
# 大同世界 (WeAreAllWorld) API 回归测试脚本
# 使用方法: ./scripts/api-test.sh [API_BASE_URL]

set -e

# 配置
API_BASE="${1:-http://localhost:3000/api/v1}"
API_KEY="weareallworld_dev_key_2026"
# 生成 UUID 格式的测试用户ID
TEST_USER_ID="$(cat /proc/sys/kernel/random/uuid)"
TEST_EMAIL="test-$(date +%s)@example.com"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local check_json="$6"
    
    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}测试 $TOTAL: $name${NC}"
    echo "请求: $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -H "x-user-id: $TEST_USER_ID" \
            -d "$data" \
            "${API_BASE}${endpoint}" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -H "x-user-id: $TEST_USER_ID" \
            "${API_BASE}${endpoint}" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ HTTP状态码: $http_code${NC}"
        
        # 检查 JSON 响应
        if [ -n "$check_json" ]; then
            if echo "$body" | grep -q "$check_json"; then
                echo -e "${GREEN}✓ 响应包含: $check_json${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${RED}✗ 响应不包含: $check_json${NC}"
                echo "响应: $body"
                FAILED=$((FAILED + 1))
            fi
        else
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}✗ HTTP状态码错误: 期望 $expected_status, 实际 $http_code${NC}"
        echo "响应: $body"
        FAILED=$((FAILED + 1))
    fi
}

# 测试无认证的请求
test_no_auth() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}测试 $TOTAL: $name (无认证)${NC}"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${API_BASE}${endpoint}" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "401" ]; then
        echo -e "${GREEN}✓ 正确返回 401 未授权${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ 应返回 401, 实际返回 $http_code${NC}"
        FAILED=$((FAILED + 1))
    fi
}

echo "=========================================="
echo "大同世界 API 回归测试"
echo "=========================================="
echo "API地址: $API_BASE"
echo "测试用户: $TEST_USER_ID"
echo "=========================================="

# 1. 健康检查
echo -e "\n${YELLOW}=== 健康检查 ===${NC}"
# 直接访问健康检查端点（不在 API 路径下）
response=$(curl -s -w "\n%{http_code}" "http://localhost:3000/health" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
TOTAL=$((TOTAL + 1))
echo -e "\n${YELLOW}测试 $TOTAL: 健康检查端点${NC}"
echo "请求: GET /health"
if [ "$http_code" = "200" ] && echo "$body" | grep -q "ok"; then
    echo -e "${GREEN}✓ HTTP状态码: $http_code${NC}"
    echo -e "${GREEN}✓ 响应包含: ok${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ HTTP状态码错误: 期望 200, 实际 $http_code${NC}"
    echo "响应: $body"
    FAILED=$((FAILED + 1))
fi

# 2. 认证测试
echo -e "\n${YELLOW}=== 认证测试 ===${NC}"
test_no_auth "无认证访问对话接口" "POST" "/dialogue" '{"message": "你好"}'
test_no_auth "无认证访问AI伙伴接口" "GET" "/ai-partner" ""

# 3. 用户创建
echo -e "\n${YELLOW}=== 用户创建 ===${NC}"
test_api "创建测试用户" "POST" "/auth/create-user" \
    "{\"userId\": \"$TEST_USER_ID\", \"telegramUsername\": \"test_user\"}" \
    "200" "success"

# 4. AI伙伴接口
echo -e "\n${YELLOW}=== AI伙伴接口 ===${NC}"
test_api "获取AI伙伴信息" "GET" "/ai-partner" "" "200" "success"
test_api "获取里程碑列表" "GET" "/ai-partner/milestones" "" "200" "success"

# 5. 对话接口
echo -e "\n${YELLOW}=== 对话接口 ===${NC}"
test_api "发送问候消息" "POST" "/dialogue" \
    '{"message": "你好，很高兴认识你！"}' \
    "200" "aiReply"
test_api "发送深度对话" "POST" "/dialogue" \
    '{"message": "我今天遇到了一件很开心的事情，想和你分享"}' \
    "200" "qualityResult"
test_api "获取对话历史" "GET" "/dialogue/history" "" "200" "success"

# 6. 签到
echo -e "\n${YELLOW}=== 签到接口 ===${NC}"
test_api "每日签到" "POST" "/ai-partner/checkin" "" "200" ""

# 7. 统计接口
echo -e "\n${YELLOW}=== 统计接口 ===${NC}"
test_api "获取周统计" "GET" "/stats/weekly" "" "200" "success"
test_api "获取总览统计" "GET" "/stats/overview" "" "200" "success"

# 8. 用户接口
echo -e "\n${YELLOW}=== 用户接口 ===${NC}"
test_api "获取用户资料" "GET" "/user/profile" "" "200" "success"

# 输出结果
echo -e "\n=========================================="
echo "测试结果汇总"
echo "=========================================="
echo -e "总计: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 有 $FAILED 个测试失败${NC}"
    exit 1
fi