# FireTunnel — IP Addressing Plan

## Network Zones

| Zone     | Network           | Gateway        |
|----------|-------------------|----------------|
| INTERNAL | 192.168.10.0/24   | 192.168.10.1   |
| DMZ      | 192.168.20.0/24   | 192.168.20.1   |
| GUEST    | 192.168.30.0/24   | 192.168.30.1   |
| VPN      | 10.10.10.0/24     | 10.10.10.1     |
| WAN/TEST | 10.0.0.0/24       | 10.0.0.1       |

## Devices

| Device              | IP              | Zone     | VM  |
|---------------------|-----------------|----------|-----|
| OPNsense Firewall   | 192.168.10.1    | FIREWALL | VM1 |
| Internal Server     | 192.168.10.10   | INTERNAL | VM2 |
| DMZ Web Server      | 192.168.20.10   | DMZ      | VM3 |
| Guest PC            | 192.168.30.10   | GUEST    | VM4 |
| Kali Linux          | 10.0.0.10       | EXTERNAL | VM5 |
| VPN Client          | 10.10.10.2      | VPN      | VM6 |

## VirtualBox Network Adapters

| VM          | Adapter 1         | Adapter 2         |
|-------------|-------------------|-------------------|
| OPNsense    | NAT (WAN)         | Internal: intnet1 (LAN) |
| OPNsense    | Internal: intnet2 (DMZ) | Internal: intnet3 (GUEST) |
| Internal    | Internal: intnet1 | —                 |
| DMZ Server  | Internal: intnet2 | —                 |
| Guest PC    | Internal: intnet3 | —                 |
| Kali Linux  | NAT               | —                 |
| VPN Client  | NAT               | —                 |
