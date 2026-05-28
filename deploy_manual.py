import paramiko
import os

host = '121.40.196.79'
user = 'root'
key_path = os.path.expanduser('~/.ssh/meoo_deploy')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, key_filename=key_path, timeout=10)
print('Connected!')

# Create directories
for d in ['/www/wwwroot/meoo/dist', '/www/wwwroot/meoo/server/dist']:
    stdin, stdout, stderr = client.exec_command(f'mkdir -p {d} && echo "ok: {d}"')
    print(stdout.read().decode().strip())

sftp = client.open_sftp()

# Upload frontend dist/
local_dist = 'E:/RJ/SSBB/meoo_zip_1779612767549/dist'
total = 0
for root, dirs, files in os.walk(local_dist):
    for fname in files:
        local_path = os.path.join(root, fname)
        rel_path = os.path.relpath(local_path, local_dist).replace('\\', '/')
        remote_path = '/www/wwwroot/meoo/dist/' + rel_path
        remote_dir = os.path.dirname(remote_path).replace('\\', '/')
        try:
            sftp.stat(remote_dir)
        except:
            # Create dir recursively
            stdin2, stdout2, stderr2 = client.exec_command(f'mkdir -p {remote_dir}')
            stdout2.read()
        sftp.put(local_path, remote_path)
        total += 1
        if total % 10 == 0:
            print(f'Frontend: {total} files...')
print(f'Frontend: {total} files deployed')

# Upload server/dist/
local_server = 'E:/RJ/SSBB/meoo_zip_1779612767549/server'
server_total = 0
server_dist = os.path.join(local_server, 'dist')
for root, dirs, files in os.walk(server_dist):
    for fname in files:
        local_path = os.path.join(root, fname)
        rel_path = os.path.relpath(local_path, server_dist).replace('\\', '/')
        remote_path = '/www/wwwroot/meoo/server/dist/' + rel_path
        remote_dir = os.path.dirname(remote_path).replace('\\', '/')
        try:
            sftp.stat(remote_dir)
        except:
            stdin2, stdout2, stderr2 = client.exec_command(f'mkdir -p {remote_dir}')
            stdout2.read()
        sftp.put(local_path, remote_path)
        server_total += 1
print(f'Backend: {server_total} files deployed')

# Upload package.json
sftp.put(os.path.join(local_server, 'package.json'), '/www/wwwroot/meoo/server/package.json')
print('package.json uploaded')
sftp.close()

# Install deps
print('Installing server dependencies...')
stdin, stdout, stderr = client.exec_command(
    'cd /www/wwwroot/meoo/server && npm install --production 2>&1'
)
out = stdout.read().decode()
err = stderr.read().decode()
print(out[-300:] if out else '')
print(err[-300:] if err else '')

# Restart backend: kill old process on port 3007, start new one
print('Restarting backend...')
stdin, stdout, stderr = client.exec_command(
    'PID=$(netstat -tlnp 2>/dev/null | grep :3007 | awk "{print \$NF}" | cut -d"/" -f1); '
    + 'if [ -n "$PID" ]; then kill $PID 2>/dev/null; echo "Killed PID $PID"; sleep 1; fi; '
    + 'cd /www/wwwroot/meoo/server && nohup node dist/index.js > /www/wwwlogs/meoo-server.log 2>&1 & '
    + 'sleep 2; netstat -tlnp 2>/dev/null | grep :3007 && echo "Backend started on port 3007"'
)
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
if err: print('ERR:', err[:300])

# Reload nginx
stdin, stdout, stderr = client.exec_command('nginx -s reload 2>&1 && echo "Nginx reloaded"')
print(stdout.read().decode().strip())

# Verify
stdin, stdout, stderr = client.exec_command('ls /www/wwwroot/meoo/dist/ | head -5 && echo "---" && ls /www/wwwroot/meoo/server/dist/ | head -5')
print('Verification:')
print(stdout.read().decode())

client.close()
print('Done!')
