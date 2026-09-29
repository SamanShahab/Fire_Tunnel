#!/bin/bash
# SRS FR iii - firewall rule-conflict / rule-order troubleshooting exercise (record this for the video).
# 1. load the deliberately broken policy   2. show the symptom + the shadowed rule with 0 packets
# 3. load the corrected policy              4. retest -> guest isolation enforced
set -uo pipefail
cd "$(dirname "$0")/.."; OUT=results/rule-conflict; mkdir -p "$OUT"
say() { printf '\033[1m%s\033[0m\n' "$*"; }
say "== Step 1: load broken policy (MODE=firewall-broken)"; ./lab.sh mode firewall-broken >/dev/null
say "== Step 2: symptom - Guest -> internal intranet (tcp/80) should be BLOCKED but is:"
docker exec ft-guest curl -s -m 5 -i http://10.10.0.10/ | head -n 3 | tee "$OUT/1-symptom-guest-web.txt"
docker exec ft-guest curl -s -m 5 -o /dev/null -w 'HTTP %{http_code}\n' http://10.10.0.10/ | tee -a "$OUT/1-symptom-guest-web.txt"
say "== Rules involved (note BUG-1 has traffic, BUG-2 'shadowed' has 0 packets):"
docker exec ft-firewall nft -a list chain inet fw forward | grep -E 'BUG|guest-isolation' | tee "$OUT/2-broken-rules-with-counters.txt"
docker exec ft-firewall nft list ruleset > "$OUT/2-broken-ruleset-full.nft"
say "== Step 3: corrected policy (MODE=firewall)"; ./lab.sh mode firewall >/dev/null
say "== Step 4: retest"
if docker exec ft-guest curl -s -m 5 -o /dev/null http://10.10.0.10/; then echo "STILL ALLOWED - fix failed"; else echo "Guest -> internal:80 now BLOCKED (curl timed out) - policy enforced"; fi | tee "$OUT/3-retest-after-fix.txt"
docker exec ft-firewall nft -a list chain inet fw forward | grep -E 'guest' | tee "$OUT/4-fixed-rules.txt"
diff <(grep -vE '^\s*#|^\s*$' firewall/nft/firewall-broken.nft) <(grep -vE '^\s*#|^\s*$' firewall/nft/firewall.nft) > "$OUT/5-diff-broken-vs-fixed.txt" || true
echo; echo "Evidence in $OUT/. Root cause: rule order - a broad accept placed before a specific drop shadows it."
