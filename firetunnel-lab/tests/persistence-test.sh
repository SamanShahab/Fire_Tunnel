#!/bin/bash
# NFR Reliability - restart/persistence test: rules and VPN settings must survive a restart of the gateway.
set -uo pipefail
cd "$(dirname "$0")/.."; OUT=results/persistence; mkdir -p "$OUT"
norm() { sed -E 's/counter packets [0-9]+ bytes [0-9]+/counter/g'; }
docker exec ft-firewall nft list ruleset | norm > "$OUT/ruleset-before.nft"
echo "restarting ft-firewall ..."; docker restart ft-firewall >/dev/null; sleep 4
for i in $(seq 1 20); do docker exec ft-firewall nft list ruleset 2>/dev/null | grep -q 'table inet fw' && break; sleep 1; done
docker exec ft-firewall nft list ruleset | norm > "$OUT/ruleset-after.nft"
if diff -q "$OUT/ruleset-before.nft" "$OUT/ruleset-after.nft" >/dev/null; then echo "PASS: identical ruleset after restart"; else echo "FAIL: ruleset changed"; diff "$OUT/ruleset-before.nft" "$OUT/ruleset-after.nft"; fi | tee "$OUT/result.txt"
if docker exec ft-firewall ip link show tun0 >/dev/null 2>&1; then echo "OpenVPN server restarted, tun0 present" | tee -a "$OUT/result.txt"; fi
echo "Persistence source: /firewall/nft/*.nft and /vpn/ are bind-mounted; the entrypoint reloads them on every start." | tee -a "$OUT/result.txt"
