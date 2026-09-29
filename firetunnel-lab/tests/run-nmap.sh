#!/bin/bash
# Authorized reconnaissance from the Kali node (External/Test zone) for the CURRENT mode (SRS FR ii + xi).
# Targets are ONLY the lab subnets + the gateway public IP. Host bridge addresses (.254 = the Ubuntu VM) are excluded.
# Output: results/<mode>/scan.{nmap,gnmap,xml}  and scan-udp1194.*  (also copied into evidence/)
set -uo pipefail
source "$(dirname "$0")/lib.sh"
say "== Nmap reconnaissance from Kali  mode=$MODE  $(ts)"
TARGETS="10.10.0.0/24 10.20.0.0/24 10.30.0.0/24 203.0.113.1"
EXCL="10.10.0.254,10.20.0.254,10.30.0.254,203.0.113.254,203.0.113.50"
PORTS="1-1024,1194,5201,8000,8080"
dx kali rm -f /tmp/scan.nmap /tmp/scan.gnmap /tmp/scan.xml
echo "\$ nmap -sS -T4 --max-retries 1 --host-timeout 90s -p $PORTS --exclude $EXCL $TARGETS -oA /tmp/scan"
dx kali nmap -sS -T4 --max-retries 1 --host-timeout 90s -p "$PORTS" --exclude "$EXCL" $TARGETS -oA /tmp/scan | tail -n 40
for e in nmap gnmap xml; do docker cp "ft-kali:/tmp/scan.$e" "$MDIR/scan.$e"; done
if [ "$MODE" = vpn ]; then
  echo; echo "\$ nmap -sU -p 1194 203.0.113.1   (OpenVPN with tls-crypt does not answer probes -> open|filtered)"
  dx kali nmap -sU -p 1194 --max-retries 1 203.0.113.1 -oN /tmp/scan-udp.nmap | tail -n 8
  docker cp ft-kali:/tmp/scan-udp.nmap "$MDIR/scan-udp1194.nmap"
fi
cp "$MDIR/scan.nmap" "$EVD/nmap-$MODE.txt"
hosts=$(grep -c 'Status: Up' "$MDIR/scan.gnmap" || true); ports=$(grep -o '[0-9]*/open/' "$MDIR/scan.gnmap" | wc -l)
echo; echo "Reachable hosts: $hosts   Open TCP ports: $ports   -> $MDIR/scan.nmap"
