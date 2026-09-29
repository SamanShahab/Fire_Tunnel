# FireTunnel — OPNsense Firewall Rules Reference

## Default Policy: BLOCK ALL

## Rules (applied in priority order)

| Priority | Name                      | Source Zone | Destination Zone | Protocol | Port | Action |
|----------|---------------------------|-------------|------------------|----------|------|--------|
| 10       | Internal to Internet      | INTERNAL    | WAN              | ANY      | ANY  | ALLOW  |
| 20       | Guest to Internet         | GUEST       | WAN              | ANY      | ANY  | ALLOW  |
| 30       | Block Guest to Internal   | GUEST       | INTERNAL         | ANY      | ANY  | BLOCK  |
| 40       | External to DMZ HTTP      | WAN         | DMZ              | TCP      | 80   | ALLOW  |
| 50       | External to DMZ HTTPS     | WAN         | DMZ              | TCP      | 443  | ALLOW  |
| 60       | Block External to Internal| WAN         | INTERNAL         | ANY      | ANY  | BLOCK  |
| 70       | Block DMZ to Internal     | DMZ         | INTERNAL         | ANY      | ANY  | BLOCK  |
| 80       | VPN to Internal Web       | VPN         | INTERNAL         | TCP      | 80   | ALLOW  |
| 999      | Default Deny All          | ANY         | ANY              | ANY      | ANY  | BLOCK  |

## NAT Rules

| Type    | Interface | Source          | Destination | Translation     |
|---------|-----------|-----------------|-------------|-----------------|
| Outbound| WAN       | 192.168.10.0/24 | ANY         | WAN IP (masq)   |
| Outbound| WAN       | 192.168.30.0/24 | ANY         | WAN IP (masq)   |

## Rule Conflict Demo

To demonstrate rule conflict:
1. Add Rule: GUEST → ANY = ALLOW (priority 5)
2. Test: Guest can reach Internal (unexpected)
3. Fix: Remove broad rule or lower its priority below rule 30
4. Test again: Guest blocked from Internal
