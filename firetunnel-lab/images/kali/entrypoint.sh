#!/bin/bash
set -e
[ -n "${GW:-}" ] && ip route replace default via "$GW"
# Kali also plays the "simulated internet website" on tcp/8000 so Guest/Internal -> External tests have a target.
(cd /srv/www && nohup python3 -m http.server 8000 --bind 0.0.0.0 >/var/log/simweb.log 2>&1 &)
echo "[kali] ready. default route: $(ip route show default)"
exec sleep infinity
