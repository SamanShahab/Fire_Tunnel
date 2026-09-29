#!/bin/bash
# SRS FR xii - configuration backup and recovery test (run in MODE=firewall or vpn).
set -uo pipefail
cd "$(dirname "$0")/.."; OUT=results/backup-restore; mkdir -p "$OUT"
say() { printf '\033[1m%s\033[0m\n' "$*"; }
probe() { if docker exec ft-kali curl -s -m 5 -o /dev/null -w '%{http_code}' http://203.0.113.1/ 2>/dev/null | grep -q 200; then echo "External -> DMZ web via port-forward: ALLOWED (200)"; else echo "External -> DMZ web via port-forward: BLOCKED"; fi; }
say "== 1. Export running configuration"
docker exec ft-firewall nft list ruleset > "$OUT/backup-ruleset.nft"; sha256sum "$OUT/backup-ruleset.nft" | tee "$OUT/backup-sha256.txt"
say "== 2. Baseline behaviour"; probe | tee "$OUT/1-before.txt"
say "== 3. Simulate configuration loss: delete the DMZ port-forward rule"
h=$(docker exec ft-firewall nft -a list chain ip nat prerouting | awk '/portfwd-dmz-web/{for(i=1;i<=NF;i++) if($i=="handle") print $(i+1)}')
docker exec ft-firewall nft delete rule ip nat prerouting handle "$h" && echo "deleted prerouting rule handle $h" | tee "$OUT/2-deleted.txt"
probe | tee -a "$OUT/2-deleted.txt"
say "== 4. Restore from backup"
docker cp "$OUT/backup-ruleset.nft" ft-firewall:/tmp/restore.nft
docker exec ft-firewall bash -c 'nft flush ruleset && nft -f /tmp/restore.nft' && echo "ruleset restored"
say "== 5. Retest"; probe | tee "$OUT/3-after-restore.txt"
docker exec ft-firewall nft list ruleset | sed -E 's/counter packets [0-9]+ bytes [0-9]+/counter/g' > /tmp/after.nft
sed -E 's/counter packets [0-9]+ bytes [0-9]+/counter/g' "$OUT/backup-ruleset.nft" > /tmp/before.nft
if diff -q /tmp/before.nft /tmp/after.nft >/dev/null; then echo "Restored ruleset is identical to the backup (counters ignored)"; else echo "WARNING: ruleset differs from backup"; diff /tmp/before.nft /tmp/after.nft; fi | tee "$OUT/4-diff.txt"
say "VPN config backup"; cp vpn/server/server.conf "$OUT/openvpn-server.conf.bak"; echo "copied server.conf (no secrets inside)"
