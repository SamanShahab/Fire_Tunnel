#!/bin/bash
# Deliverable: sanitized firewall + VPN configuration exports (SRS 1.9). Never ship pki/private, tc.key, users.txt, creds/.
set -uo pipefail
cd "$(dirname "$0")/.."; OUT=results/config-export; rm -rf "$OUT"; mkdir -p "$OUT/nft" "$OUT/openvpn/ccd" "$OUT/openvpn/clients"
cp firewall/nft/*.nft "$OUT/nft/"
docker exec ft-firewall nft list ruleset > "$OUT/nft/running-ruleset-$(date +%Y%m%d-%H%M).nft" 2>/dev/null || true
cp vpn/server/server.conf vpn/server/verify.sh "$OUT/openvpn/"; cp vpn/server/ccd/* "$OUT/openvpn/ccd/"
# pki/ is root-only on the host (created inside the container) - fall back to reading these two public files via ft-firewall
pki_cp() { if [ -r "vpn/server/pki/$1" ]; then cp "vpn/server/pki/$1" "$2"; else docker exec ft-firewall cat "/opt/lab/vpn/server/pki/$1" > "$2" 2>/dev/null || rm -f "$2"; fi; }
pki_cp ca.crt    "$OUT/openvpn/ca.crt"          # public cert: fine
pki_cp index.txt "$OUT/openvpn/pki-index.txt"   # shows revoked entry (R)
for f in vpn/clients/*.ovpn; do [ -f "$f" ] || continue
  python3 - "$f" "$OUT/openvpn/clients/$(basename "$f")" <<'PY'
import re,sys
s=open(sys.argv[1]).read()
for tag in ("key","tls-crypt"):
    s=re.sub(rf"<{tag}>.*?</{tag}>", f"<{tag}>\n-----REDACTED FOR SUBMISSION-----\n</{tag}>", s, flags=re.S)
open(sys.argv[2],"w").write(s)
PY
done
cp docker-compose.yml "$OUT/"
sed 's/LabUser@2026/<redacted-demo-password>/' images/labnode/Dockerfile > "$OUT/labnode.Dockerfile"
if grep -rlE 'BEGIN (EC PRIVATE|RSA PRIVATE|PRIVATE|OpenVPN Static key)' "$OUT" | grep -v ca.crt; then echo "!! secret material found in export - check above"; exit 1; fi
echo "Sanitized export in $OUT/ ($(find "$OUT" -type f | wc -l) files)"
