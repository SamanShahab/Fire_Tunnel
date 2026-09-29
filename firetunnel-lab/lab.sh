#!/bin/bash
# FireTunnel lab controller.
#   ./lab.sh up [mode]          build images (first run ~10 min), start lab in mode (default minimal)
#   ./lab.sh mode <mode>        switch firewall mode: minimal | firewall | firewall-broken | vpn
#   ./lab.sh pki                generate the OpenVPN PKI + client bundles (once, before vpn mode)
#   ./lab.sh status             current mode, containers, ruleset with counters
#   ./lab.sh verify             connectivity sanity checks for the current mode
#   ./lab.sh fwlog [since]      firewall allow/deny log (host kernel log), e.g. ./lab.sh fwlog "10 min ago"
#   ./lab.sh monitor            live: counters + firewall log + VPN status (Ctrl-C to stop)
#   ./lab.sh shell <node>       shell in firewall|internal|guest|dmz|kali|vpnclient
#   ./lab.sh run-all            full evidence run: 3 modes x (nmap + test matrix + perf + events) + comparison
#   ./lab.sh dashboard [host] [port]  web control panel (default 127.0.0.1:8088) - switch scenarios, run tests, view evidence
#   ./lab.sh down               stop and remove everything (results/ and vpn/ are kept)
set -euo pipefail
cd "$(dirname "$0")"
export MODE="${MODE:-}"
NODES="firewall internal guest dmz kali vpnclient"

current_mode() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' ft-firewall 2>/dev/null | awk -F= '$1=="MODE"{print $2}'; }
ensure_sysctl() {
  # both are set permanently by host-setup.sh; re-apply here if something reset them (Docker restart, reboot before host-setup)
  local need=""
  [ "$(sysctl -n net.bridge.bridge-nf-call-iptables 2>/dev/null || echo 0)" = "0" ] || need="1"
  [ "$(sysctl -n net.netfilter.nf_log_all_netns 2>/dev/null || echo 1)" = "1" ] || need="1"
  if [ -n "$need" ]; then
    echo "[lab] applying required sysctls (bridge-nf-call-iptables=0, nf_log_all_netns=1)"
    sudo -n sysctl -w net.bridge.bridge-nf-call-iptables=0 net.bridge.bridge-nf-call-ip6tables=0 net.netfilter.nf_log_all_netns=1 >/dev/null 2>&1 \
      || echo "[lab] WARNING: could not apply sysctls non-interactively - run ./host-setup.sh (or sudo sysctl --system)"
  fi
}
wait_fw() {
  local want="$1" i
  for i in $(seq 1 30); do
    if [ "$(current_mode)" = "$want" ] && docker exec ft-firewall nft list ruleset 2>/dev/null | grep -q 'table inet fw'; then
      if [ "$want" = "vpn" ]; then docker exec ft-firewall ip link show tun0 >/dev/null 2>&1 && return 0; else return 0; fi
    fi
    sleep 1
  done
  echo "[lab] firewall did not come up in mode '$want'"; docker logs --tail 30 ft-firewall; return 1
}

case "${1:-}" in
  up)
    m="${2:-minimal}"; ensure_sysctl
    chmod +x tests/*.sh vpn/*.sh vpn/server/verify.sh images/*/entrypoint.sh 2>/dev/null || true
    if [ "$m" = vpn ] && [ ! -f vpn/server/pki/ca.crt ]; then echo "[lab] no PKI yet - generating"; "$0" pki; fi
    docker compose build firewall internal kali        # internal builds the shared labnode image once
    MODE="$m" docker compose up -d --no-build
    wait_fw "$m" && echo "[lab] lab is up in mode: $m" && "$0" verify
    ;;
  mode)
    m="${2:?mode}"; ensure_sysctl
    [ -f "firewall/nft/$m.nft" ] || { echo "unknown mode $m"; exit 1; }
    if [ "$m" = vpn ] && [ ! -f vpn/server/pki/ca.crt ]; then "$0" pki; fi
    docker exec ft-vpnclient pkill openvpn 2>/dev/null || true
    MODE="$m" docker compose up -d --no-deps --no-build firewall
    for n in internal guest dmz kali vpnclient; do docker exec "ft-$n" ip neigh flush all 2>/dev/null || true; done
    wait_fw "$m" && echo "[lab] firewall now in mode: $m"
    ;;
  pki)
    chmod +x vpn/gen-pki.sh vpn/server/verify.sh
    docker compose build firewall
    docker run --rm -v "$PWD/vpn:/opt/lab/vpn" --entrypoint /opt/lab/vpn/gen-pki.sh firetunnel/firewall:1.0 "${2:-}"
    ;;
  status)
    echo "MODE: $(current_mode)"; docker compose ps
    echo; docker exec ft-firewall nft list ruleset
    if [ "$(current_mode)" = vpn ]; then echo; echo "--- OpenVPN status"; docker exec ft-firewall cat /opt/lab/vpn/server/openvpn-status.log 2>/dev/null || true; fi
    ;;
  verify)
    ok=1
    chk() { if "$@" >/dev/null 2>&1; then echo "  [OK]   $*"; else echo "  [FAIL] $*"; ok=0; fi; }
    echo "[verify] mode=$(current_mode)"
    for n in $NODES; do chk docker inspect -f '{{.State.Running}}' "ft-$n"; done
    chk docker exec ft-kali     ping -c1 -W2 203.0.113.1            # every node can reach its gateway
    chk docker exec ft-guest    ping -c1 -W2 10.20.0.1
    chk docker exec ft-internal ping -c1 -W2 10.10.0.1
    chk docker exec ft-internal curl -s -m4 -o /dev/null http://10.30.0.10/     # LAN -> DMZ allowed in all modes
    chk docker exec ft-internal curl -s -m4 -o /dev/null http://203.0.113.50:8000/   # LAN -> External allowed in all modes
    [ $ok = 1 ] && echo "[verify] basic connectivity OK" || { echo "[verify] problems - see README 'Tricky steps'"; exit 1; }
    ;;
  fwlog)
    since="${2:-10 min ago}"
    { journalctl -k --no-pager --since "$since" -o short-iso 2>/dev/null || sudo journalctl -k --no-pager --since "$since" -o short-iso; } | grep -E 'FW-(DROP|ALLOW)' || echo "(no FW- entries since '$since')"
    ;;
  monitor)
    watch -n 2 "docker exec ft-firewall nft list ruleset | grep -E 'counter packets [1-9]' | sed 's/^ *//' | cut -c1-140; echo; echo '--- last firewall log lines'; journalctl -k --no-pager --since '2 min ago' -o short-iso 2>/dev/null | grep -E 'FW-(DROP|ALLOW)' | tail -n 8 | cut -c1-160; echo; docker exec ft-firewall cat /opt/lab/vpn/server/openvpn-status.log 2>/dev/null | head -n 12"
    ;;
  shell) docker exec -it "ft-${2:?node}" bash ;;
  run-all)
    for m in minimal firewall vpn; do
      echo; echo "################  MODE: $m  ################"
      "$0" mode "$m"; sleep 3
      MODE="$m" tests/run-nmap.sh
      MODE="$m" tests/run-matrix.sh
      MODE="$m" tests/run-perf.sh
      MODE="$m" tests/detect-events.sh
    done
    python3 tests/compare.py
    echo; echo "All done. See results/comparison.md"
    ;;
  dashboard) exec python3 dashboard/server.py --host "${2:-127.0.0.1}" --port "${3:-8088}" ;;
  down) docker compose down --remove-orphans ;;
  *) sed -n '2,15p' "$0" ;;
esac
