# FireTunnel Lab – Setup on VMware + Ubuntu + Docker

Step-by-step guide to run the lab on an Ubuntu VM (VMware Workstation/Player) with Docker installed inside Ubuntu. See `README.md` for what the lab does and `docs/network-background.md` for the topology.

> Use **`firetunnel-lab-fixed.zip`**, not the original `firetunnel-lab.zip`. The fixed package contains the corrections below; the original fails at PKI generation, the test matrix and packet captures.

## What was fixed compared to the original package

| File | Problem | Fix |
|---|---|---|
| `vpn/gen-pki.sh` | Easy-RSA 3.1.7 (Ubuntu 24.04) rejects `EASYRSA_REQ_CN` for `build-server-full`; `revoke` moves the revoked cert/key, so `revoked.ovpn` was built empty | CN set only for `build-ca`; client cert/key copied to a temp dir before revoking |
| `tests/run-matrix.sh` | `local ... ev="$EVD/$id.txt"` read `$id` before it was set (crash under `set -u`); commas in labels shifted `matrix.csv` columns; pcaps read with host `tcpdump` | separate `local`; commas replaced in CSV fields; falls back to `tcpdump` inside `ft-kali` if the host has none |
| `tests/lib.sh` | captures were empty (24-byte pcaps): `tcpdump` buffered packets and lost them on stop | `tcpdump --immediate-mode` |
| `tests/export-configs.sh` | `ca.crt` / `pki-index.txt` silently skipped because `vpn/server/pki/` is root-only | read through `ft-firewall` when not readable |
| `host-setup.sh` | always installed `docker.io`, which conflicts with an existing docker-ce install | keeps an existing Docker, only checks that `docker compose` v2 is present |
| `dashboard/` | not usable on phones/tablets; pcap viewer needed host `tcpdump` | responsive layout; "Network access by scenario" matrix on the Comparison tab; pcap viewer falls back to `ft-kali` |

## 1. VM requirements

* Ubuntu **24.04 LTS**, 4 vCPU, 6–8 GB RAM, 40 GB disk.
* Any VMware network mode (NAT is fine). The lab never touches the real network.
* Internet access in the VM for the first image build only.
* No nested virtualization needed.

## 2. Copy the zip into the VM

Use drag-and-drop, a USB drive or a VMware shared folder, then **move the zip into your home folder**. Do not run the lab from inside `/mnt/hgfs` – shared folders break file permissions and executable bits.

## 3. Unzip

```bash
cd ~ && unzip firetunnel-lab-fixed.zip && cd firetunnel-lab
```

## 4. One-time host setup

Installs the host tools, loads the kernel modules and sets the required sysctls permanently (asks for your sudo password):

```bash
./host-setup.sh
```

Then **log out and back in** (or reboot) so your user is in the `docker`, `adm` and `systemd-journal` groups.

## 5. Check the host

```bash
docker ps && sysctl net.bridge.bridge-nf-call-iptables net.netfilter.nf_log_all_netns
```

Expected: no sudo prompt, `net.bridge.bridge-nf-call-iptables = 0` and `net.netfilter.nf_log_all_netns = 1`.

If Docker came from **snap** (`snap list docker` lists it), remove the snap and run step 4 again – snap confinement can block the lab's bind mounts and `/dev/net/tun`.

## 6. Build and start the lab

First run takes about 10 minutes (the Kali image is the slow one). It must end with `[verify] basic connectivity OK`:

```bash
./lab.sh up minimal
```

## 7. Generate the VPN PKI

CA, server/client certificates, a revoked certificate, the tls-crypt key and the client `.ovpn` bundles:

```bash
./lab.sh pki
```

## 8. Full evidence run

All three modes (Nmap, test matrix, performance, security events) plus `results/comparison.md`. About 20 minutes. **Do not click buttons in the dashboard while it runs** – switching modes from the dashboard restarts the firewall under the running tests.

```bash
./lab.sh run-all
```

Expected matrix results: minimal 14/14, firewall 13/13, vpn 24/24.

## 9. Stand-alone exercises

Rule-conflict troubleshooting and backup/restore (end in firewall mode):

```bash
tests/rule-conflict-exercise.sh && tests/backup-restore-test.sh
```

Persistence (run in vpn mode so the tunnel check is included) and the sanitized config export for the submission:

```bash
./lab.sh mode vpn && tests/persistence-test.sh && tests/export-configs.sh
```

## 10. Dashboard

```bash
./lab.sh dashboard 0.0.0.0
```

* Inside the VM: `http://127.0.0.1:8088`
* From the Windows host: `http://<VM-IP>:8088` (find the IP with `hostname -I`). The dashboard has no authentication – lab use only.
* **Comparison** tab: the three-mode metrics table and the *Network access by scenario* matrix (Allowed / Blocked per connection attempt in each mode).
* The "PKI: missing" badge can show even when the PKI exists: `vpn/server/pki/` is root-only and the dashboard runs as your user. VPN mode still works.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `failed to create network ft_wan: Pool overlaps with other one` | Another Docker network uses one of the lab subnets (`203.0.113.0/24`, `10.10.0.0/24`, `10.20.0.0/24`, `10.30.0.0/24`). Find it with `docker network ls` and `docker network inspect`, then remove it or stop that project. |
| Kali image build fails while pulling | The Kali mirror is flaky. Run `./lab.sh up minimal` again – cached layers are reused. |
| `./lab.sh verify` fails on ping, or `./lab.sh fwlog` is empty | The sysctls were reset. Run `sudo sysctl --system` and retry. |
| `nft -f` errors like "Could not process rule: No such file or directory" | Kernel modules not loaded. Run `./host-setup.sh` again (or reboot after it). |
| Start over from scratch | `./lab.sh down`, then `sudo rm -rf vpn/server/pki results/*` (PKI files are root-owned), then step 6. |

## Useful commands

```bash
./lab.sh status              # current mode, containers, ruleset with counters
./lab.sh mode firewall       # minimal | firewall | firewall-broken | vpn
./lab.sh fwlog "20 min ago"  # firewall allow/deny log
./lab.sh monitor             # live counters + firewall log + VPN sessions
./lab.sh shell kali          # shell in a lab node
sudo tcpdump -i ft-wan -w ext.pcap   # capture on the External side (open in Wireshark)
./lab.sh down                # stop and remove the lab (results/ and vpn/ are kept)
```
