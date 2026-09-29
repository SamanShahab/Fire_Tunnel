#!/bin/bash
# OpenVPN auth-user-pass-verify (via-file). $1 = temp file: line1=username line2=password
# Rule 1: username must match the certificate CN (prevents cert of user A + password of user B)
# Rule 2: sha256(password) must match users.txt  (format  username:sha256hex)
USERS=/opt/lab/vpn/server/users.txt
u=$(sed -n 1p "$1"); p=$(sed -n 2p "$1")
if [ "$u" != "${common_name:-}" ]; then
  echo "FT-AUTH DENY user='$u' cn='${common_name:-}' reason=cn-mismatch src=${untrusted_ip:-?}" >&2; exit 1
fi
h=$(printf %s "$p" | sha256sum | cut -d' ' -f1)
if grep -qx "$u:$h" "$USERS" 2>/dev/null; then
  echo "FT-AUTH OK user='$u' src=${untrusted_ip:-?}" >&2; exit 0
fi
echo "FT-AUTH DENY user='$u' reason=bad-password src=${untrusted_ip:-?}" >&2; exit 1
