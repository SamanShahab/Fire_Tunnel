#!/bin/bash
# Generates the lab PKI with easy-rsa (EC P-256), the tls-crypt key, the hashed users file
# and inline .ovpn bundles for admin / staff / revoked. Runs INSIDE the firewall image:
#   ./lab.sh pki        (wrapper)   |   re-run with --force to regenerate everything
# Demo credentials (fictional, lab-only):  admin / Admin@Lab2026   staff / Staff@Lab2026
set -euo pipefail
BASE=/opt/lab/vpn; SRV=$BASE/server; CL=$BASE/clients
export EASYRSA=/usr/share/easy-rsa EASYRSA_PKI=$SRV/pki EASYRSA_BATCH=1
export EASYRSA_ALGO=ec EASYRSA_CURVE=prime256v1 EASYRSA_CA_EXPIRE=3650 EASYRSA_CERT_EXPIRE=825
ER=$EASYRSA/easyrsa
if [ -f "$EASYRSA_PKI/ca.crt" ] && [ "${1:-}" != "--force" ]; then
  echo "PKI already exists at $EASYRSA_PKI (use --force to regenerate)"; exit 0
fi
rm -rf "$EASYRSA_PKI" "$SRV/tc.key" "$CL"/*.ovpn "$CL/creds"
$ER init-pki
EASYRSA_REQ_CN="FireTunnel Lab CA" $ER build-ca nopass
$ER build-server-full server nopass
for c in admin staff revoked; do $ER build-client-full "$c" nopass; done
KEEP=$(mktemp -d)   # easy-rsa 3.1 moves the cert/key on revoke - keep copies for the bundles
for c in admin staff revoked; do cp "$EASYRSA_PKI/issued/$c.crt" "$EASYRSA_PKI/private/$c.key" "$KEEP/"; done
$ER revoke revoked
$ER gen-crl
chmod 644 "$EASYRSA_PKI/crl.pem"
openvpn --genkey secret "$SRV/tc.key"

h() { printf %s "$1" | sha256sum | cut -d' ' -f1; }
ADMIN_PW='Admin@Lab2026'; STAFF_PW='Staff@Lab2026'
{ echo "admin:$(h "$ADMIN_PW")"; echo "staff:$(h "$STAFF_PW")"; } > "$SRV/users.txt"
chmod 600 "$SRV/users.txt" "$SRV/tc.key"

mkdir -p "$CL/creds"
for c in admin staff revoked; do
  cat > "$CL/$c.ovpn" <<OVPN
client
dev tun
proto udp
remote 203.0.113.1 1194
nobind
resolv-retry 5
connect-retry-max 1
persist-key
persist-tun
remote-cert-tls server
auth-user-pass
tls-version-min 1.2
cipher AES-256-GCM
data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
auth SHA256
verb 3
<ca>
$(cat "$EASYRSA_PKI/ca.crt")
</ca>
<cert>
$(openssl x509 -in "$KEEP/$c.crt")
</cert>
<key>
$(cat "$KEEP/$c.key")
</key>
<tls-crypt>
$(grep -v '^#' "$SRV/tc.key")
</tls-crypt>
OVPN
done
printf 'admin\n%s\n' "$ADMIN_PW"   > "$CL/creds/admin.txt"
printf 'staff\n%s\n' "$STAFF_PW"   > "$CL/creds/staff.txt"
printf 'admin\nwrong-password-123\n' > "$CL/creds/admin-badpass.txt"
printf 'revoked\nRevoked@Lab2026\n' > "$CL/creds/revoked.txt"
chmod 644 "$CL"/*.ovpn "$CL"/creds/*.txt   # readable by the vpnclient container (lab only)
echo
echo "PKI ready:"; ls -1 "$CL"/*.ovpn
echo "Revoked serials:"; cat "$EASYRSA_PKI/index.txt" | grep '^R' || true
