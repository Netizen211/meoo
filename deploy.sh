#!/bin/bash
# ==================================================
# 店分析 (meoo) — 阿里云服务器一键部署脚本
# 使用方法: chmod +x deploy.sh && sudo bash deploy.sh
# ==================================================

set -e

echo "========================================="
echo "  店分析 部署脚本"
echo "========================================="

# ---- 检查参数 ----
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "用法: bash deploy.sh <你的域名>"
  echo "例如: bash deploy.sh myshop.xyz"
  exit 1
fi

echo "[1/6] 安装系统依赖..."
apt update -qq
apt install -y -qq nginx curl unzip 2>/dev/null

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "安装 Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi

echo "[2/6] 部署前端..."
mkdir -p /var/www/meoo/dist
cp -r dist/* /var/www/meoo/dist/

echo "[3/6] 部署后端..."
mkdir -p /opt/meoo/server
cp -r server/dist /opt/meoo/server/
cp -r server/node_modules /opt/meoo/server/
cp -r server/package.json /opt/meoo/server/
cp server/.env.example /opt/meoo/server/.env

# 生成随机 JWT 密钥
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
sed -i "s/replace-with-64-char-random-string/$JWT_SECRET/" /opt/meoo/server/.env
sed -i "s/replace-with-another-64-char-random-string/$JWT_REFRESH_SECRET/" /opt/meoo/server/.env
sed -i "s|https://your-domain.com|https://$DOMAIN|" /opt/meoo/server/.env

echo "[4/6] 配置 Nginx..."
# 生成 nginx 配置
cat > /etc/nginx/sites-available/meoo << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    server_tokens off;

    location / {
        root /var/www/meoo/dist;
        try_files \$uri /index.html;
        autoindex off;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/meoo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "[5/6] 配置 systemd 后台服务..."
cat > /etc/systemd/system/meoo-server.service << SYSTEMD_EOF
[Unit]
Description=Meoo Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/meoo/server
ExecStart=/usr/bin/node /opt/meoo/server/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
systemctl enable meoo-server

echo "[6/6] 安装 Cloudflare Tunnel (cloudflared)..."
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list
apt update -qq && apt install -y -qq cloudflared

echo ""
echo "========================================="
echo "  部署完成!"
echo "========================================="
echo ""
echo "接下来需要做："
echo ""
echo "1. 配置 MySQL 数据库："
echo "   mysql -u root -p"
echo "   CREATE DATABASE meoo_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "   CREATE USER 'meoo'@'localhost' IDENTIFIED BY '你的密码';"
echo "   GRANT ALL ON meoo_prod.* TO 'meoo'@'localhost';"
echo ""
echo "2. 编辑 /opt/meoo/server/.env 填入数据库密码"
echo ""
echo "3. 运行数据库迁移："
echo "   cd /opt/meoo/server && npx knex migrate:latest --knexfile knexfile.ts"
echo ""
echo "4. 启动后端服务："
echo "   systemctl start meoo-server"
echo ""
echo "5. 设置 Cloudflare Tunnel："
echo "   cloudflared tunnel login"
echo "   cloudflared tunnel create meoo"
echo "   cloudflared tunnel route dns meoo $DOMAIN"
echo "   cloudflared tunnel run meoo"
echo ""
echo "完成！你的网站将可以通过 https://$DOMAIN 访问"
echo "========================================="
