#!/bin/bash
# One-time preparation of the Ubuntu VM (tested target: Ubuntu 24.04 LTS inside VMware Workstation).
# Docker only - no nested virtualization needed.
set -euo pipefail
echo "== Installing Docker, Compose v2 and host tools"
sudo apt-get update
sudo apt-get install -y tcpdump nftables conntrack iproute2 python3 jq unzip
# keep an existing Docker install (e.g. docker-ce from docker.com): docker.io would conflict with its containerd.io
if command -v docker >/dev/null 2>&1; then
  echo "   Docker already installed: $(docker --version)"
  docker compose version >/dev/null 2>&1 || { echo "!! 'docker compose' (v2) missing - install docker-compose-plugin (docker-ce) or docker-compose-v2 (docker.io)"; exit 1; }
else
  sudo apt-get install -y docker.io docker-compose-v2
fi
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "== Loading kernel modules the containers need (nftables NAT/log/ct, tun)"
sudo modprobe -a nf_tables nft_ct nft_log nft_nat nft_masq nft_reject nft_reject_inet nft_limit \
                 nf_conntrack nf_nat nf_log_syslog tun bridge br_netfilter 2>/dev/null || true
echo 'nf_tables
nft_ct
nft_log
nft_nat
nft_masq
nft_reject
nft_reject_inet
nf_log_syslog
tun' | sudo tee /etc/modules-load.d/firetunnel.conf >/dev/null

echo "== Kernel log access for evidence (nftables 'log' lines land in the HOST kernel log)"
sudo usermod -aG adm,systemd-journal "$USER"

echo "== Sysctls: firewall container is the only policy point + container firewall logs reach the host kernel log"
echo "   bridged traffic must not be filtered by the host's Docker iptables rules"
sudo tee /etc/sysctl.d/99-firetunnel.conf >/dev/null <<SYS
net.bridge.bridge-nf-call-iptables = 0
net.bridge.bridge-nf-call-ip6tables = 0
# nftables 'log' inside a container namespace is silently discarded unless this is 1
net.netfilter.nf_log_all_netns = 1
kernel.dmesg_restrict = 0
SYS
sudo sysctl --system >/dev/null

ls -l /dev/net/tun
echo
echo "Done. LOG OUT AND BACK IN (group membership), then:  ./lab.sh up minimal   and   ./lab.sh dashboard"
