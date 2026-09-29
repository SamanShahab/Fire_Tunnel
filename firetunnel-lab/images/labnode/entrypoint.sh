#!/bin/bash
# Generic lab node. ROLE decides which services run. GW = firewall IP in this zone.
set -e
if [ -n "${GW:-}" ]; then
  ip route replace default via "$GW"
fi
case "${ROLE:-none}" in
  internal)
    cp /opt/lab/www/internal/index.html /var/www/html/index.html
    nginx                                                   # tcp/80  intranet site
    mkdir -p /run/sshd && /usr/sbin/sshd                    # tcp/22  ssh
    (cd /opt/lab/www/internal-admin && nohup python3 -m http.server 8080 --bind 0.0.0.0 >/var/log/admin-panel.log 2>&1 &)   # tcp/8080 restricted admin panel
    iperf3 -s -D                                            # tcp/5201 perf server
    ;;
  dmz)
    cp /opt/lab/www/dmz/index.html /var/www/html/index.html
    nginx                                                   # tcp/80  approved public service
    (cd /opt/lab/www/dmz-extra && nohup python3 -m http.server 8080 --bind 0.0.0.0 >/var/log/dmz-extra.log 2>&1 &)          # tcp/8080 "unnecessary" service (should be unreachable from outside)
    iperf3 -s -D
    ;;
  guest|vpnclient) ;;
esac
echo "[$ROLE] ready. default route: $(ip route show default)"
exec sleep infinity
