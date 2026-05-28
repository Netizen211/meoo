import paramiko
import os

host = '121.40.196.79'
user = 'root'
key_path = os.path.expanduser('~/.ssh/meoo_deploy')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, key_filename=key_path, timeout=10)
print('Connected!')

# Create admin directory
stdin, stdout, stderr = client.exec_command('mkdir -p /www/wwwroot/meoo-admin/dist && echo ok')
print(stdout.read().decode().strip())

# Upload dist-admin
sftp = client.open_sftp()
local_admin = 'E:/RJ/SSBB/meoo_zip_1779612767549/dist-admin'
total = 0
for root, dirs, files in os.walk(local_admin):
    for fname in files:
        local_path = os.path.join(root, fname)
        rel_path = os.path.relpath(local_path, local_admin).replace('\\', '/')
        remote_path = '/www/wwwroot/meoo-admin/dist/' + rel_path
        remote_dir = os.path.dirname(remote_path).replace('\\', '/')
        try:
            sftp.stat(remote_dir)
        except:
            stdin2, stdout2, stderr2 = client.exec_command('mkdir -p "' + remote_dir + '"')
            stdout2.read()
        sftp.put(local_path, remote_path)
        total += 1
print(f'Admin: {total} files deployed')

sftp.close()

# Verify
stdin, stdout, stderr = client.exec_command('ls -la /www/wwwroot/meoo-admin/dist/')
print(stdout.read().decode())

# Reload nginx
stdin, stdout, stderr = client.exec_command('nginx -s reload && echo reload-ok')
print(stdout.read().decode().strip())

client.close()
print('Done!')
