#!/bin/bash
# Ethical Hacking Test Matrix (SRS FR vii) for the CURRENT firewall mode.
# Output: results/<mode>/matrix.csv  + one evidence file per test in results/<mode>/evidence/
# Class column: 'auth' = legitimate access that should work, 'unauth' = attack/unauthorized attempt.
# Expected results follow the security policy of the mode (in Minimal Protection unauthorized access is EXPECTED to succeed - that is the baseline).
set -uo pipefail
source "$(dirname "$0")/lib.sh"
MATRIX="$MDIR/matrix.csv"
echo 'Test ID,Class,Source,Destination,Protocol/Port/Service,Expected,Actual,Pass/Fail,Evidence' > "$MATRIX"
say "== Test matrix  mode=$MODE  $(ts)"; hr

record() { # id class src dst svc expected actual evidence
  local pf="FAIL"; [ "$6" = "$7" ] && pf="PASS"
  local f=() x; for x in "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$pf" "$8"; do f+=("${x//,/;}"); done   # keep the CSV columns intact
  printf '%s,%s,%s,%s,%s,%s,%s,%s,%s\n' "${f[@]}" >> "$MATRIX"
  printf '%-5s %-6s %-22s -> %-26s %-24s exp=%-8s got=%-8s %s\n' "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$pf"
}
# t <id> <class> <srcnode> <srclabel> <dstip> <port> <service> <expected> [kind: tcp|http]
t() {
  local id=$1 cls=$2 node=$3 slabel=$4 dst=$5 port=$6 svc=$7 exp=$8 kind=${9:-tcp} actual; local ev="$EVD/$id.txt"
  { echo "# $id  $(ts)  mode=$MODE"; echo "# $slabel -> $dst:$port ($svc)  expected=$exp"; } > "$ev"
  if [ "$kind" = http ]; then
    echo "\$ curl -sS -m 6 -i http://$dst:$port/" >> "$ev"
    if dx "$node" curl -sS -m 6 -i "http://$dst:$port/" >> "$ev" 2>&1; then actual=Allowed; else actual=Blocked; fi
  else
    echo "\$ nc -vz -w 5 $dst $port" >> "$ev"
    if dx "$node" timeout 8 nc -vz -w 5 "$dst" "$port" >> "$ev" 2>&1; then actual=Allowed; else actual=Blocked; fi
  fi
  record "$id" "$cls" "$slabel" "$dst:$port" "$svc" "$exp" "$actual" "evidence/$id.txt"
}
# pcap_read <file> <tcpdump args...>: host tcpdump if installed, else the one in ft-kali (pcap via stdin)
pcap_read() { local f=$1; shift; if command -v tcpdump >/dev/null 2>&1; then tcpdump -r "$f" "$@"; else docker exec -i ft-kali tcpdump -r - "$@" < "$f"; fi; }
# expectation helpers: hardened = firewall / firewall-broken / vpn
H() { if [ "$MODE" = minimal ]; then echo "$1"; else echo "$2"; fi; }   # H <minimal-expectation> <hardened-expectation>

# ---------------- Guest / Untrusted ----------------
cap_start guest cap-guest
t T01 unauth guest "Guest (10.20.0.10)"    $INTERNAL 80   "TCP/80 intranet web"        "$(H Allowed Blocked)" http
t T02 unauth guest "Guest (10.20.0.10)"    $INTERNAL 22   "TCP/22 SSH"                 "$(H Allowed Blocked)"
t T03 auth   guest "Guest (10.20.0.10)"    $KALI     8000 "TCP/8000 external web"      Allowed http
cap_stop guest cap-guest
# ---------------- External / Test (Kali) ----------------
t T04 auth   kali  "External/Kali (203.0.113.50)" $DMZ_PUBLIC 80  "TCP/80 approved DMZ web"       Allowed http
t T05 unauth kali  "External/Kali (203.0.113.50)" $DMZ_PUBLIC 8080 "TCP/8080 unauthorized port"   "$(H Allowed Blocked)"
t T06 unauth kali  "External/Kali (203.0.113.50)" $INTERNAL 80   "TCP/80 intranet web"        "$(H Allowed Blocked)" http
t T07 unauth kali  "External/Kali (203.0.113.50)" $INTERNAL 22   "TCP/22 SSH"                 "$(H Allowed Blocked)"
# ---------------- Trusted / Internal ----------------
t T08 auth   internal "Internal (10.10.0.10)" $DMZ  80   "TCP/80 approved DMZ web"    Allowed http
t T09 auth   internal "Internal (10.10.0.10)" $KALI 8000 "TCP/8000 external web"      Allowed http
# ---------------- DMZ ----------------
t T10 unauth dmz  "DMZ (10.30.0.10)"       $INTERNAL 80   "TCP/80 intranet web"        "$(H Allowed Blocked)" http
t T11 unauth dmz  "DMZ (10.30.0.10)"       $INTERNAL 22   "TCP/22 SSH"                 "$(H Allowed Blocked)"
# ---------------- Remote user WITHOUT VPN ----------------
vpn_down
cap_start vpnclient cap-remote-novpn
t T12 unauth vpnclient "Remote user, no VPN (203.0.113.60)" $INTERNAL 80 "TCP/80 intranet web" "$(H Allowed Blocked)" http
cap_stop vpnclient cap-remote-novpn
# ---------------- Repeated denied attempts (security event #1) ----------------
ev="$EVD/T13.txt"; { echo "# T13 $(ts) 6 x connection attempts External/Kali -> $INTERNAL:22 (expected: all $(H Allowed Blocked); >=5 denials must appear in FW log)"; } > "$ev"
okc=0; for i in 1 2 3 4 5 6; do echo "attempt $i: \$ nc -vz -w 3 $INTERNAL 22" >> "$ev"; dx kali timeout 5 nc -vz -w 3 $INTERNAL 22 >> "$ev" 2>&1 && okc=$((okc+1)); sleep 0.5; done
echo "# successful attempts: $okc/6" >> "$ev"
[ $okc -gt 0 ] && a=Allowed || a=Blocked
record T13 unauth "External/Kali (203.0.113.50) x6" "$INTERNAL:22" "TCP/22 repeated attempts" "$(H Allowed Blocked)" "$a" "evidence/T13.txt + fwlog"

# ================= VPN-specific tests (Firewall + VPN mode only) =================
if [ "$MODE" = vpn ]; then
  hr; say "-- VPN tests"
  # V01 admin connects
  ev="$EVD/V01.txt"; if vpn_up admin admin; then a=Allowed; else a=Blocked; fi
  { echo "# V01 $(ts) admin profile: cert + password -> tunnel"; vpn_log; echo; echo "\$ ip -4 addr show tun0"; dx vpnclient ip -4 addr show tun0; } > "$ev" 2>&1
  record V01 auth "Remote VPN client admin (203.0.113.60)" "$PUBLIC_IP:1194" "UDP/1194 OpenVPN handshake+auth" Allowed "$a" "evidence/V01.txt"
  # encryption evidence: capture on the External side while traffic flows through the tunnel (FR viii)
  cap_start vpnclient cap-remote-vpn
  t V02 auth vpnclient "VPN admin (10.40.0.10)" $INTERNAL 80   "TCP/80 intranet web via VPN"   Allowed http
  t V03 auth vpnclient "VPN admin (10.40.0.10)" $INTERNAL 8080 "TCP/8080 admin panel via VPN"  Allowed http
  t V04 auth vpnclient "VPN admin (10.40.0.10)" $INTERNAL 22   "TCP/22 SSH via VPN"            Allowed
  cap_stop vpnclient cap-remote-vpn
  vpn_down
  # V05..V08 staff (web only)
  ev="$EVD/V05.txt"; if vpn_up staff staff; then a=Allowed; else a=Blocked; fi
  { echo "# V05 $(ts) staff profile connects"; vpn_log; dx vpnclient ip -4 addr show tun0; } > "$ev" 2>&1
  record V05 auth "Remote VPN client staff (203.0.113.60)" "$PUBLIC_IP:1194" "UDP/1194 OpenVPN handshake+auth" Allowed "$a" "evidence/V05.txt"
  t V06 auth   vpnclient "VPN staff (10.40.0.20)" $INTERNAL 80   "TCP/80 intranet web via VPN"      Allowed http
  t V07 unauth vpnclient "VPN staff (10.40.0.20)" $INTERNAL 8080 "TCP/8080 admin panel (restricted)" Blocked
  t V08 unauth vpnclient "VPN staff (10.40.0.20)" $INTERNAL 22   "TCP/22 SSH (restricted)"          Blocked
  vpn_down
  # V09 invalid password x5 (security event #2)
  ev="$EVD/V09.txt"; echo "# V09 $(ts) 5 x admin cert with WRONG password" > "$ev"; okc=0
  for i in 1 2 3 4 5; do echo "--- attempt $i" >> "$ev"; if vpn_up admin admin-badpass; then okc=$((okc+1)); fi; vpn_log | grep -E 'AUTH|TLS|Exiting|Initialization' >> "$ev"; vpn_down; done
  echo "# tunnels established: $okc/5" >> "$ev"; [ $okc -gt 0 ] && a=Allowed || a=Blocked
  record V09 unauth "Remote client, bad password x5" "$PUBLIC_IP:1194" "UDP/1194 invalid VPN auth" Blocked "$a" "evidence/V09.txt + docker logs ft-firewall"
  # V10 revoked certificate
  ev="$EVD/V10.txt"; echo "# V10 $(ts) revoked client certificate" > "$ev"
  if vpn_up revoked revoked; then a=Allowed; else a=Blocked; fi
  vpn_log >> "$ev"; echo "--- server side:" >> "$ev"; docker logs --since 40s ft-firewall 2>&1 | grep -iE 'revoked|VERIFY' >> "$ev" || true; vpn_down
  record V10 unauth "Remote client, revoked cert" "$PUBLIC_IP:1194" "UDP/1194 revoked certificate" Blocked "$a" "evidence/V10.txt"
  # V11 encryption validation from the pcap taken during V02-V04
  ev="$EVD/V11.txt"; p="$EVD/cap-remote-vpn.pcap"
  if [ -f "$p" ]; then
    http_pkts=$(pcap_read "$p" -nn 'tcp port 80 or tcp port 8080 or tcp port 22' 2>/dev/null | wc -l)
    vpn_pkts=$(pcap_read "$p" -nn 'udp port 1194' 2>/dev/null | wc -l)
    { echo "# V11 $(ts) capture point: External side (vpnclient eth0) while admin used web/ssh through the tunnel"
      echo "packets with plaintext TCP 80/8080/22 headers : $http_pkts   (expected 0)"
      echo "encapsulated OpenVPN UDP/1194 packets           : $vpn_pkts   (expected > 0)"
      echo; echo "\$ tcpdump -nn -r cap-remote-vpn.pcap | head"; pcap_read "$p" -nn 2>/dev/null | head -n 15; } > "$ev"
    [ "$http_pkts" = 0 ] && [ "$vpn_pkts" -gt 0 ] && a=Encrypted || a=Plaintext
    record V11 auth "VPN admin traffic on External side" "pcap analysis" "Inner traffic readable?" Encrypted "$a" "evidence/V11.txt + cap-remote-vpn.pcap"
  fi
fi

# Baseline plaintext evidence (Minimal mode): the same remote->internal web request is readable on the wire
if [ "$MODE" = minimal ] && [ -f "$EVD/cap-remote-novpn.pcap" ]; then
  ev="$EVD/P01.txt"; n=$(pcap_read "$EVD/cap-remote-novpn.pcap" -nn -A 'tcp port 80' 2>/dev/null | grep -c -E 'GET / HTTP|Intranet' || true)
  { echo "# P01 $(ts) Minimal Protection: remote user HTTP request to internal is PLAINTEXT on the External side"; echo "plaintext HTTP markers found in capture: $n (expected > 0)"; pcap_read "$EVD/cap-remote-novpn.pcap" -nn -A 'tcp port 80' 2>/dev/null | grep -E 'GET / HTTP|Host:|<h1>' | head -n 6; } > "$ev"
  [ "${n:-0}" -gt 0 ] && a=Plaintext || a=Encrypted
  record P01 unauth "Remote user traffic on External side" "pcap analysis" "Inner traffic readable?" Plaintext "$a" "evidence/P01.txt + cap-remote-novpn.pcap"
fi
hr
echo "Matrix written: $MATRIX"
awk -F, 'NR>1{t++; if($8=="PASS")p++} END{printf "PASS %d / %d\n", p, t}' "$MATRIX"
