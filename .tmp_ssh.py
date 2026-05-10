"""Tiny SSH helper for VPS setup. Used only in this session.
Usage:
  python .tmp_ssh.py exec "<command>"
  python .tmp_ssh.py upload <local> <remote>
"""
import sys, os, io, paramiko
# Force UTF-8 stdout so Cyrillic / arrows survive on Windows cp1251 console
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

HOST = "94.241.170.144"
USER = "root"
PASS = "qywz*aCXwL2Sr7"
KEY_PATH = os.path.expanduser("~/.ssh/zov_vps_ed25519")


def make_client():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    # Try key first, fall back to password
    try:
        client.connect(HOST, username=USER, key_filename=KEY_PATH, timeout=15)
    except (paramiko.AuthenticationException, paramiko.SSHException, OSError):
        client.connect(HOST, username=USER, password=PASS, timeout=15, allow_agent=False, look_for_keys=False)
    return client


def run(cmd, timeout=120):
    c = make_client()
    try:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
        rc = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return rc, out, err
    finally:
        c.close()


def upload(local, remote):
    c = make_client()
    try:
        sftp = c.open_sftp()
        sftp.put(local, remote)
        sftp.close()
    finally:
        c.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("commands: exec <cmd> | upload <local> <remote>")
        sys.exit(1)
    op = args[0]
    if op == "exec":
        rc, out, err = run(" ".join(args[1:]))
        if out:
            sys.stdout.write(out)
        if err:
            sys.stderr.write(err)
        sys.exit(rc)
    elif op == "upload":
        upload(args[1], args[2])
        print("uploaded")
    else:
        print("unknown op:", op)
        sys.exit(1)
