#!/bin/bash
# Security event detection in NATIVE logs (SRS FR ix). Reads:
#   - host kernel log (nftables 'log' lines, prefix FW-DROP/FW-ALLOW)  -> denied connections per source, unauthorized zone access
#   - docker logs ft-firewall (OpenVPN)                                -> invalid VPN authentication per source
# Threshold: >= 5 events from the same source within WINDOW  => ALERT.
# Output: results/<mode>/events.csv, events.txt, fwlog.txt
set -uo pipefail
source "$(dirname "$0")/lib.sh"
WINDOW="${WINDOW:-30 min ago}"; THRESH=5
EV="$MDIR/events.csv"; TXT="$MDIR/events.txt"; FWLOG="$MDIR/fwlog.txt"
say "== Security events  mode=$MODE  window='$WINDOW'  threshold=$THRESH"
{ journalctl -k --no-pager --since "$WINDOW" -o short-iso 2>/dev/null || sudo -n journalctl -k --no-pager --since "$WINDOW" -o short-iso 2>/dev/null; } | grep -E 'FW-(DROP|ALLOW)' > "$FWLOG" || true
[ -s "$FWLOG" ] || echo "(no FW- log lines found - if you are not in the systemd-journal group, log out/in or run with sudo)"
echo 'event,source,count,alert,detail' > "$EV"
{
echo "# Security events  mode=$MODE  $(ts)  window since: $WINDOW"
echo; echo "## 1) Repeated denied connections (>= $THRESH from one source = ALERT)"
grep 'FW-DROP' "$FWLOG" | grep -o 'SRC=[0-9.]*' | sort | uniq -c | sort -rn | while read -r c s; do
  src=${s#SRC=}; al=no; [ "$c" -ge $THRESH ] && al=ALERT
  echo "  $src  denied=$c  $al"; echo "repeated-denied,$src,$c,$al,FW-DROP entries in kernel log" >> "$EV"; done
echo; echo "## 2) Unauthorized zone access attempts (guest/external/dmz -> protected internal)"
for k in guest-to-lan ext-to-lan dmz-to-lan vpn-unauthorized; do
  c=$(grep -c "FW-DROP $k" "$FWLOG" || true); [ "$c" -gt 0 ] || continue
  al=no; [ "$c" -ge $THRESH ] && al=ALERT
  echo "  $k  blocked=$c  $al"; echo "unauthorized-zone-access,$k,$c,$al,rule '$k' drop+log" >> "$EV"; done
grep 'FW-DROP guest-to-lan\|FW-DROP ext-to-lan\|FW-DROP dmz-to-lan' "$FWLOG" | tail -n 5 | cut -c1-170 | sed 's/^/    /'
echo; echo "## 3) Invalid VPN authentication / revoked certificate (OpenVPN server log)"
docker logs --since "$(date -u -d "$WINDOW" +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo 30m)" ft-firewall 2>&1 | grep -E 'FT-AUTH DENY|AUTH_FAILED|verification failed|certificate revoked|VERIFY ERROR' > "$MDIR/vpn-auth-failures.txt" || true
grep -oE 'src=[0-9.]+|[0-9.]+:[0-9]+ (VERIFY ERROR|TLS)' "$MDIR/vpn-auth-failures.txt" | sed -E 's/src=//; s/:[0-9]+ .*//' | sort | uniq -c | sort -rn | while read -r c s; do
  al=no; [ "$c" -ge $THRESH ] && al=ALERT; echo "  $s  failures=$c  $al"; echo "invalid-vpn-auth,$s,$c,$al,OpenVPN server log" >> "$EV"; done
[ -s "$MDIR/vpn-auth-failures.txt" ] || echo "  (none in window)"
echo; echo "## Allowed events logged (FW-ALLOW): $(grep -c 'FW-ALLOW' "$FWLOG" || true)"
} | tee "$TXT"
echo; echo "Written: $EV, $TXT, $FWLOG"
