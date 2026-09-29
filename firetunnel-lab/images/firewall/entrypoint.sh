#!/bin/bash
# Firewall / VPN gateway entrypoint.
# 1) Map zone interfaces by IP (Docker does not guarantee eth0/eth1 order)
# 2) Remove the default route so the gateway can never leak lab traffic to the real internet
# 3) Load the nftables ruleset for $MODE
# 4) In vpn mode, start the OpenVPN server in the foreground (logs -> `docker logs ft-firewall`)
set -euo pipefail
MODE="${MODE:-minimal}"
RULES="/opt/lab/nft/${MODE}.nft"
[ -f "$RULES" ] || { echo "Unknown MODE '$MODE' (no $RULES)"; exit 1; }

iface_for() { ip -o -4 addr show | awk -v ip="$1/" 'index($4, ip)==1 {print $2; exit}'; }
WAN=$(iface_for 203.0.113.1); LAN=$(iface_for 10.10.0.1)
GUEST=$(iface_for 10.20.0.1); DMZ=$(iface_for 10.30.0.1)
for v in WAN LAN GUEST DMZ; do [ -n "${!v}" ] || { echo "Interface for $v not found"; ip -o -4 addr; exit 1; }; done

mkdir -p /run/lab
cat > /run/lab/ifaces.nft <<NFT
define WAN   = "$WAN"
define LAN   = "$LAN"
define GUEST = "$GUEST"
define DMZ   = "$DMZ"
NFT
echo "[firewall] zones: WAN=$WAN LAN=$LAN GUEST=$GUEST DMZ=$DMZ  MODE=$MODE"

ip route del default 2>/dev/null || true      # isolation: no path out of the lab

nft -f "$RULES"
echo "[firewall] ruleset loaded from $RULES"
{ nft list ruleset | head -n 60; } || true

if [ "$MODE" = "vpn" ]; then
  SRV=/opt/lab/vpn/server
  [ -f "$SRV/pki/ca.crt" ] || { echo "PKI missing. Run: ./lab.sh pki"; exit 1; }
  chmod +x "$SRV/verify.sh"
  echo "[firewall] starting OpenVPN server"
  exec openvpn --config "$SRV/server.conf"
fi
exec sleep infinity
