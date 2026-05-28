import paramiko
import io

host = '121.40.196.79'
user = 'root'
key_path = 'C:/Users/01/.ssh/meoo_deploy'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, key_filename=key_path, timeout=10)

# Clean config: main on /, admin on /admin/
new_config = '''server {
    listen 80;
    server_name melody.wang www.melody.wang 121.40.196.79;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    server_tokens off;

    location /admin {
        alias /www/wwwroot/meoo-admin/dist;
        index index.html;
        try_files $uri /admin/index.html;
    }

    location / {
        root /www/wwwroot/meoo/dist;
        try_files $uri /index.html;
        autoindex off;

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    location ~ /\\. {
        deny all;
        return 404;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name melody.wang www.melody.wang 121.40.196.79;

    ssl_certificate /www/server/panel/vhost/cert/melody.wang/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/melody.wang/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    server_tokens off;

    location /admin {
        alias /www/wwwroot/meoo-admin/dist;
        index index.html;
        try_files $uri /admin/index.html;
    }

    location / {
        root /www/wwwroot/meoo/dist;
        try_files $uri /index.html;
        autoindex off;

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    location ~ /\\. {
        deny all;
        return 404;
    }
}
'''

# Write meoo.conf
sftp = client.open_sftp()
f = io.BytesIO(new_config.encode())
sftp.putfo(f, '/www/server/panel/vhost/nginx/meoo.conf')
sftp.close()

# Delete conflicting admin.meoo.conf
stdin, stdout, stderr = client.exec_command('rm -f /www/server/panel/vhost/nginx/admin.meoo.conf && echo deleted')
print(stdout.read().decode().strip())

# Test nginx
stdin, stdout, stderr = client.exec_command('nginx -t 2>&1')
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
print(err)

if 'successful' in out:
    stdin, stdout, stderr = client.exec_command('nginx -s reload && echo reload-ok')
    print(stdout.read().decode().strip())

    # Test all access methods
    tests = [
        ('Main site', 'curl -s -o /dev/null -w "%{http_code}" http://localhost/'),
        ('Admin via IP', 'curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/'),
        ('Admin via IP/index', 'curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/index.html'),
        ('Main HTTPS', 'curl -sk -o /dev/null -w "%{http_code}" https://localhost/'),
        ('Admin HTTPS', 'curl -sk -o /dev/null -w "%{http_code}" https://localhost/admin/'),
    ]
    for name, cmd in tests:
        stdin, stdout, stderr = client.exec_command(cmd)
        print(f'{name}: {stdout.read().decode().strip()}')

    # Check admin HTML content
    stdin, stdout, stderr = client.exec_command('curl -s http://localhost/admin/ | head -3')
    html = stdout.read().decode()
    print('Admin page title:', '后台管理' in html and 'OK' or 'WRONG')
else:
    print('Nginx test FAILED!')

client.close()
