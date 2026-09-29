# FireTunnel Lab (Docker edition)

Complete, scriptable implementation of the *FireTunnel – Smart Firewall and VPN Gateway* SRS (Aptech TechWiz 7, Ethical Cyber Horizons) as **six containers on one Ubuntu VM**. The SRS explicitly allows containers ("physical devices, virtual machines, containers, or a combination"). Firewall = **nftables** (allowed option), VPN = **OpenVPN** (allowed option), testing = **Kali Linux + Nmap + tcpdump/tshark + iperf3** (mandatory tools).

> Setting up on a new VMware/Ubuntu machine: follow `SETUP.md` (step-by-step, tested fixes, troubleshooting).
>
> Read `docs/network-background.md` first – it is the topology, system allocation table, IP plan and communication-path table the SRS asks for.

## What you get

| SRS requirement | Where it is implemented / evidence produced |
|---|---|
| FR i – topology, 4 zones + VPN, 6 systems | `docker-compose.yml`, `docs/network-background.md` |
| FR ii – baseline Nmap in Minimal Protection | `tests/run-nmap.sh` -> `results/minimal/scan.*` |
| FR iii – default-deny, stateful, NAT, port-forward, rule order, **rule-conflict exercise** | `firewall/nft/firewall.nft`, `firewall-broken.nft`, `tests/rule-conflict-exercise.sh` |
| FR iv – guest isolation with evidence | matrix T01–T03 + `evidence/cap-guest.pcap` + `fwlog.txt` |
| FR v/vi – VPN gateway, 2 profiles with different permissions, cert+password, revoked cert denied | `vpn/`, `firewall/nft/vpn.nft`, matrix V01–V10 |
| FR vii – Ethical Hacking Test Matrix | `tests/run-matrix.sh` -> `results/<mode>/matrix.csv` (+ one evidence file per test) |
| FR viii – encryption validation on the External side | matrix P01 (plaintext, baseline) and V11 (encrypted) + `.pcap` files |
| FR ix – security events (≥5 denied, ≥5 invalid VPN auth, unauthorized zone access) | `tests/detect-events.sh` -> `results/<mode>/events.txt` |
| FR x – monitoring | `./lab.sh monitor`, `./lab.sh status`, `./lab.sh fwlog`, Wireshark on `ft-wan`/`ft-lan` bridges |
| FR xi – security + performance comparison, % reduction, 3 runs, VPN connect time | `tests/run-perf.sh`, `tests/compare.py` -> `results/comparison.md` |
| FR xii – backup and recovery test | `tests/backup-restore-test.sh` |
| NFR reliability – restart/persistence test | `tests/persistence-test.sh` |
| Deliverable – sanitized config exports | `tests/export-configs.sh` -> `results/config-export/` |

## 1. Prerequisites

* VMware Workstation/Player -> **Ubuntu 24.04 LTS** VM, 4 vCPU, 6–8 GB RAM, 40 GB disk. Any VMware network mode (NAT is fine) – the lab never touches the real network. **No nested virtualization needed** (Docker, not VMs).
* Internet in the VM only for the image build.

```bash
sudo apt-get install -y git unzip
unzip firetunnel-lab.zip && cd firetunnel-lab
./host-setup.sh          # docker, compose v2, kernel modules, sysctl, journal access
# log out and back in (docker group), then:
```

## 2. Run it

```bash
./lab.sh up minimal            # builds 3 images (first time ~10 min, Kali is the slow one) and starts the lab
./lab.sh pki                   # generate CA, server/client certs, revoked cert, tls-crypt key, client .ovpn bundles
./lab.sh run-all               # the full evidence run for all three modes + comparison (~15 min)
```

`run-all` does, per mode (`minimal` -> `firewall` -> `vpn`): switch the gateway, Nmap from Kali, the whole test matrix, ping/iperf3 x3, VPN connect time x3, security-event extraction, then writes `results/comparison.md`.

Then run the three stand-alone exercises (also good to record for the video):

```bash
tests/rule-conflict-exercise.sh    # broken policy -> symptom -> fix -> retest
tests/backup-restore-test.sh       # export -> delete port-forward -> restore -> retest  (run in firewall or vpn mode)
tests/persistence-test.sh          # docker restart ft-firewall -> identical ruleset, tun0 back
tests/export-configs.sh            # sanitized configs for the submission ZIP
```

Manual work:

```bash
./lab.sh mode firewall          # switch modes any time: minimal | firewall | firewall-broken | vpn
./lab.sh status                 # ruleset with live counters, OpenVPN status
./lab.sh monitor                # live counters + firewall log + VPN sessions
./lab.sh fwlog "20 min ago"     # allow/deny log
./lab.sh shell kali             # then e.g.  nmap -sS -p- 203.0.113.1
sudo tcpdump -i ft-wan -w ext.pcap     # capture on the External side from the VM (open in Wireshark)
```

## 2b. Control panel (web frontend)

```bash
./lab.sh dashboard              # http://127.0.0.1:8088  (inside the VM)
./lab.sh dashboard 0.0.0.0      # also reachable from the VMware host via the VM's IP - no auth, lab use only
```

Standard-library Python, no packages, works offline. It wraps the same scripts (one job at a time, live console) and reads `results/`:

* **Scenario switcher** – Minimal / Firewall-Only / Rule-conflict exercise / Firewall + VPN (`lab.sh mode …`).
* **Topology & live paths** – real `nc` connection attempts from every node, drawn through the gateway, green/red against the policy of the current mode; VPN tunnel state.
* **Firewall** – rule counters (nftables `counter` per named rule), parsed allow/deny log with the ≥5-denials alert, full running ruleset.
* **VPN** – connected sessions (openvpn-status), authentication failures, server log.
* **Results & evidence** – test matrix, performance, events, Nmap output and every evidence file / pcap per mode.
* **Comparison** – the three-mode table; **Exercises** – rule-conflict, backup/restore, persistence, config export outputs.

For the SRS this is an *optional* extra (FR x says a custom dashboard is not required, and the built-in tools – `nft`, `journalctl`, Wireshark, openvpn-status – remain the primary monitoring evidence). Present it as the operator console, and still show the native tools in the video.

## 3. Lab facts you will be asked about

* **Zones** are Docker bridges named `ft-wan` (External/Test, 203.0.113.0/24), `ft-lan` (10.10.0.0/24), `ft-guest` (10.20.0.0/24), `ft-dmz` (10.30.0.0/24). VPN pool 10.40.0.0/24 is *not* a zone.
* Only `ft-firewall` is on all four bridges. Every other container's **default route points at the firewall**, and the firewall itself has **no default route** -> nothing can reach the real internet; the lab is isolated by construction (SRS 1.5).
* The **public IP** is 203.0.113.1. In hardened modes the DMZ web server is reachable from outside **only** via port-forward `203.0.113.1:80 -> 10.30.0.10:80`; everything else from outside is dropped.
* Two VPN profiles: `admin` (tunnel IP 10.40.0.10, may use internal 22/80/8080/5201) and `staff` (10.40.0.20, web :80 only). A third certificate, `revoked`, is on the CRL. Authentication = client certificate **and** username/password; the username must equal the certificate CN (`vpn/server/verify.sh`).
* Demo credentials (fictional, lab-only): `admin / Admin@Lab2026`, `staff / Staff@Lab2026`, SSH `labuser / LabUser@2026`. Never put the generated `pki/private`, `tc.key`, `users.txt` or `clients/creds` in the submission – `.gitignore` and `tests/export-configs.sh` take care of it.

## 4. Tricky steps (read before you demo)

1. **Firewall logs are in the HOST kernel log, not in the container.** nftables `log` writes to the kernel ring buffer, which containers share with the VM. Use `./lab.sh fwlog` (`sudo journalctl -k | grep FW-`), not `docker logs`. OpenVPN logs *are* in `docker logs ft-firewall`.
2. **`net.bridge.bridge-nf-call-iptables=0` is required.** Docker's own iptables rules otherwise inspect bridged traffic and can drop packets that our firewall container is routing between zones. `host-setup.sh` sets it permanently; `lab.sh` re-applies it (sudo) if it was reset. Symptom if missing: `./lab.sh verify` fails on the ping tests in minimal mode.
3. **Interface names in the firewall are not stable** (Docker attaches networks in arbitrary order). The entrypoint maps interfaces by IP and writes `/run/lab/ifaces.nft`; the rulesets use `$WAN/$LAN/$GUEST/$DMZ`. Never hard-code eth0/eth1.
4. **Kernel modules.** nft NAT/log/ct and `tun` must be loaded on the host before containers use them (`host-setup.sh` does it and persists it). Symptom: `nft -f` errors like "Could not process rule: No such file or directory".
5. **Switching mode recreates the firewall container**, which resets conntrack and drops any open VPN tunnel – that is expected. Other containers keep running.
6. **Minimal Protection is deliberately a plain router without NAT.** That is why Kali can scan 10.x directly in the baseline and why the baseline exposure is meaningful (see the earlier gotcha about a NATed baseline showing nothing).
7. **Performance comparison path.** `remote->internal` is *blocked* in Firewall-Only by design (no VPN, no access). The report must say so rather than leave a blank; `internal->dmz` gives the firewall-only overhead figure in all three modes. Bridge throughput is multi-Gbps, so absolute numbers are less interesting than the VPN delta.
8. **OpenVPN client with a revoked cert does not fail instantly** – the server rejects the TLS handshake and the client keeps retrying until its handshake timer expires. The test waits 25 s and then checks the server log for `certificate revoked`.
9. **Nmap UDP on 1194 shows `open|filtered`.** OpenVPN with `tls-crypt` silently ignores probes; that is correct behaviour and worth explaining in the report.
10. **`nft flush ruleset` inside the firewall container also removes Docker's embedded-DNS NAT rules** for that container. Irrelevant here (everything uses IPs and `/etc/hosts`), but `apt` or `curl example.com` inside `ft-firewall` will not resolve.
11. **Files created by `./lab.sh pki` are root-owned on the host** (bind mount). Use `sudo` to delete them.
12. **Kali image build** downloads several hundred MB; on a slow link run `docker compose build kali` separately first. If `kalilinux/kali-rolling` pulls fail, retry – the mirror is flaky at times.
13. **`net.netfilter.nf_log_all_netns=1` is required** or nftables `log` lines from inside the container are silently discarded by the kernel and `./lab.sh fwlog` stays empty while everything else works. `host-setup.sh` sets it; `lab.sh` re-applies it.
14. **Very noisy scans can overflow the kernel ring buffer** (a full Nmap run logs thousands of drops). journald normally keeps up; if `fwlog` shows gaps, add `log_buf_len=8M` to the VM's kernel command line or shorten the port range in `tests/run-nmap.sh`.
15. **This project has not been executed on real hardware by the author of these files**; run `./lab.sh verify` after `up`, and read the first errors from `docker logs ft-firewall` – 90% of first-run issues are items 2 and 4 above.

## 5. Mapping to the three scenarios

| Mode (`./lab.sh mode …`) | Ruleset | What changes |
|---|---|---|
| `minimal` | `firewall/nft/minimal.nft` | route everything, no NAT, counters only |
| `firewall` | `firewall.nft` | default-deny in/out, stateful, guest isolation, DMZ isolation, outbound NAT, one inbound port-forward, allow/deny logging |
| `firewall-broken` | `firewall-broken.nft` | `firewall` + a deliberately overly-permissive rule that shadows a specific drop (troubleshooting exercise) |
| `vpn` | `vpn.nft` + OpenVPN | `firewall` + udp/1194 open, per-profile tunnel authorization |

## 6. Results layout

```
results/
  minimal|firewall|vpn/
    scan.nmap|gnmap|xml     Nmap before/after evidence
    matrix.csv               Ethical Hacking Test Matrix (Test ID, Class, Source, Destination, Service, Expected, Actual, Pass/Fail, Evidence)
    evidence/*.txt, *.pcap   per-test command output and packet captures
    perf.csv, vpn-connect.csv
    events.csv, events.txt, fwlog.txt, vpn-auth-failures.txt
  comparison.md / comparison.csv   three-mode comparison incl. % reduction
  rule-conflict/  backup-restore/  persistence/  config-export/
  dashboard-jobs/                  console log of every job started from the control panel
```

## 7. Video checklist (SRS 1.9)

baseline exposure + Nmap before -> `mode firewall` -> Nmap after -> external->DMZ allowed / external->internal blocked -> guest isolation (T01 + fwlog) -> rule-conflict exercise -> `mode vpn` -> admin tunnel + access, staff blocked from admin panel, wrong password x5, revoked cert -> `./lab.sh fwlog` and `docker logs ft-firewall` showing the events -> Wireshark on `ft-wan` showing UDP/1194 only -> backup/restore -> `results/comparison.md`.
