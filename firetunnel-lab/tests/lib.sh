#!/bin/bash
# Shared helpers for all test scripts. Source this file.
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS="$LAB_DIR/results"
current_mode() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' ft-firewall 2>/dev/null | awk -F= '$1=="MODE"{print $2}'; }
MODE="${MODE:-$(current_mode)}"
[ -n "$MODE" ] || { echo "firewall container not running (./lab.sh up)"; exit 1; }
if [ "$(current_mode)" != "$MODE" ]; then echo "Requested MODE=$MODE but firewall runs '$(current_mode)'. Run: ./lab.sh mode $MODE"; exit 1; fi
MDIR="$RESULTS/$MODE"; EVD="$MDIR/evidence"; mkdir -p "$EVD"

# Lab addresses
PUBLIC_IP=203.0.113.1; INTERNAL=10.10.0.10; GUEST=10.20.0.10; DMZ=10.30.0.10; KALI=203.0.113.50; VPNCLIENT=203.0.113.60
# In Minimal Protection there is no NAT: the DMZ is reached directly. In hardened modes only via the public IP port-forward.
if [ "$MODE" = minimal ]; then DMZ_PUBLIC=$DMZ; else DMZ_PUBLIC=$PUBLIC_IP; fi

ts()  { date -u +%Y-%m-%dT%H:%M:%SZ; }
dx()  { local c=$1; shift; docker exec "ft-$c" "$@"; }
hr()  { printf '%s\n' "----------------------------------------------------------------------"; }
say() { printf '\033[1m%s\033[0m\n' "$*"; }

# --- packet capture helpers (inside a node, eth0) ---
# --immediate-mode: without it TPACKET_V3 holds packets in a ring block and SIGINT drops them (empty 24-byte pcaps)
cap_start() { dx "$1" rm -f "/tmp/$2.pcap"; docker exec -d "ft-$1" tcpdump --immediate-mode -i eth0 -U -w "/tmp/$2.pcap" not arp; sleep 1; }
cap_stop()  { dx "$1" pkill -INT tcpdump 2>/dev/null || true; sleep 1; docker cp "ft-$1:/tmp/$2.pcap" "$EVD/$2.pcap" 2>/dev/null || true; }

# --- OpenVPN client control (vpnclient node) ---
vpn_up() {   # vpn_up <profile> <credsfile>  -> 0 if tunnel established within 25s
  local prof=$1 creds=$2 i
  dx vpnclient bash -c 'pkill openvpn 2>/dev/null; sleep 1; rm -f /tmp/ovpn.log' || true
  dx vpnclient openvpn --config "/opt/lab/vpn/clients/$prof.ovpn" --auth-user-pass "/opt/lab/vpn/clients/creds/$creds.txt" \
       --daemon --log /tmp/ovpn.log --writepid /tmp/ovpn.pid
  for i in $(seq 1 25); do
    if dx vpnclient grep -q 'Initialization Sequence Completed' /tmp/ovpn.log 2>/dev/null; then return 0; fi
    if dx vpnclient grep -qE 'AUTH_FAILED|TLS Error|certificate revoked|Exiting' /tmp/ovpn.log 2>/dev/null; then return 1; fi
    sleep 1
  done
  return 1
}
vpn_down() { dx vpnclient pkill openvpn 2>/dev/null || true; sleep 1; }
vpn_log()  { dx vpnclient cat /tmp/ovpn.log 2>/dev/null || true; }
