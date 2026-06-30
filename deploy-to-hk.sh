#!/bin/bash
# =====================================================
# 店分析 — 香港服务器部署脚本
# 使用方法: bash deploy-to-hk.sh <SSH_USER> <SSH_HOST> [SSH_PORT]
# 示例: bash deploy-to-hk.sh root 47.82.120.115 22
#
# Cloudflare 缓存自动清除：
#   创建 .cloudflare.env 文件：
#     CLOUDFLARE_API_TOKEN="你的token"
#     CLOUDFLARE_ZONE_ID="你的zoneID"
#   或在命令行传参：
#     bash deploy-to-hk.sh root 47.82.120.115 22 "你的token" "你的zoneID"
# =====================================================

set -e

SSH_USER="${1:?错误: 请提供 SSH 用户名}"
SSH_HOST="${2:?错误: 请提供服务器 IP}"
SSH_PORT="${3:-22}"

# Cloudflare 配置：优先命令行参数，其次 .cloudflare.env 文件
CF_TOKEN="${4}"
CF_ZONE="${5}"
if [ -z "$CF_TOKEN" ] && [ -f "$(dirname "$0")/.cloudflare.env" ]; then
  source "$(dirname "$0")/.cloudflare.env"
  CF_TOKEN="$CLOUDFLARE_API_TOKEN"
  CF_ZONE="$CLOUDFLARE_ZONE_ID"
fi

echo "=========================================="
echo " 店分析 - 部署到 $SSH_HOST"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 构建前端
echo ""
echo "[1/4] 构建前端..."
cd "$(dirname "$0")/frontend/meoo-react"
npm run build
echo "  ✅ 前端构建完成"

# 2. 构建后端
echo ""
echo "[2/4] 构建后端..."
cd "$(dirname "$0")/backend"
npx tsc
echo "  ✅ 后端构建完成"

cd "$(dirname "$0")"

# 3. 打包传输
echo ""
echo "[3/4] 打包传输..."
DEPLOY_TAR="/tmp/meoo-deploy-$(date +%s).tar.gz"
mkdir -p /tmp/meoo-deploy/frontend /tmp/meoo-deploy/backend
cp -r backend/dist/* /tmp/meoo-deploy/backend/
cp backend/package.json backend/package-lock.json /tmp/meoo-deploy/backend/ 2>/dev/null || true
cp -r frontend/meoo-react/dist/* /tmp/meoo-deploy/frontend/
tar -czf "$DEPLOY_TAR" -C /tmp/meoo-deploy .
rm -rf /tmp/meoo-deploy
echo "  📦 $DEPLOY_TAR ($(du -h "$DEPLOY_TAR" | cut -f1))"

scp -P "$SSH_PORT" "$DEPLOY_TAR" "$SSH_USER@$SSH_HOST:/tmp/meoo-deploy.tar.gz"
rm -f "$DEPLOY_TAR"

# 4. 远程部署
echo ""
echo "[4/4] 远程部署..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" bash -s << 'REMOTESHELL'
  set -e
  # 清理超过 3 天的旧备份，防止磁盘堆积
  find /www/wwwroot -maxdepth 1 -name "meoo-backup-*" -mtime +3 -exec rm -rf {} ; 2>/dev/null || true

  BACKUP_DIR="/www/wwwroot/meoo-backup-$(date +%Y%m%d_%H%M%S)"
  [ -d /www/wwwroot/meoo ] && cp -a /www/wwwroot/meoo "$BACKUP_DIR" && echo "  📦 已备份到 $BACKUP_DIR"

  mkdir -p /www/wwwroot/meoo/dist /www/wwwroot/meoo/server
  tar -xzf /tmp/meoo-deploy.tar.gz -C /tmp/meoo-deploy-extracted/
  cp -rf /tmp/meoo-deploy-extracted/frontend/* /www/wwwroot/meoo/dist/
  cp -rf /tmp/meoo-deploy-extracted/backend/* /www/wwwroot/meoo/server/
  rm -rf /tmp/meoo-deploy.tar.gz /tmp/meoo-deploy-extracted/

  cd /www/wwwroot/meoo/server
  npm install --production 2>/dev/null || true

  # 重启服务
  pm2 restart meoo-server 2>/dev/null || pm2 start index.js --name meoo-server 2>/dev/null || true
  sleep 2
  curl -s http://127.0.0.1:3007/api/v1/settings/public > /dev/null && echo "  ✅ 后端正常" || echo "  ⚠️ 请检查服务状态"
  nginx -t && nginx -s reload 2>/dev/null && echo "  ✅ Nginx已重载" || true
  echo "  ✅ 部署完成"
REMOTESHELL

# 5. 清除 Cloudflare 缓存（立即生效，不再等 4 小时）
if [ -n "$CF_TOKEN" ] && [ -n "$CF_ZONE" ]; then
  echo ""
  echo "[5/5] 清除 Cloudflare 缓存..."
  CF_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"purge_everything":true}')

  if echo "$CF_RESULT" | grep -q '"success":true'; then
    echo "  ✅ Cloudflare 全站缓存已清除，变更立即生效"
  else
    echo "  ⚠️ Cloudflare 缓存清除失败: $(echo "$CF_RESULT" | grep -o '"errors":\[.*?\]' | head -c 200)"
  fi
else
  echo ""
  echo "⚠️ 跳过 Cloudflare 缓存清除（未配置 API Token）"
  echo "   创建 .cloudflare.env 文件:"
  echo "     echo 'CLOUDFLARE_API_TOKEN=你的token' >> .cloudflare.env"
  echo "     echo 'CLOUDFLARE_ZONE_ID=你的zoneID' >> .cloudflare.env"
fi

echo ""
echo "🎉 全部完成！访问 https://melody.wang 确认更新"
