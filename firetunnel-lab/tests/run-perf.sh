#!/bin/bash
# Performance measurements (SRS FR xi + NFR Performance): ping latency, iperf3 throughput, VPN connection time.
# Two fixed paths, same endpoints in every mode:
#   A  remote -> internal   : vpnclient (203.0.113.60) -> internal.lab (10.10.0.10)   [minimal: direct | firewall: BLOCKED by policy | vpn: through tunnel]
#   B  internal -> dmz      : internal (10.10.0.10) -> dmz.lab (10.30.0.10)           [routed through the firewall in every mode]
# 3 runs each. Output: results/<mode>/perf.csv, results/<mode>/vpn-connect.csv (vpn mode)
set -uo pipefail
source "$(dirname "$0")/lib.sh"
RUNS=3; PING_N=10; IPERF_T=5
PERF="$MDIR/perf.csv"; echo 'mode,path,run,latency_avg_ms,throughput_mbps,note' > "$PERF"
say "== Performance  mode=$MODE  $(ts)  (runs=$RUNS, ping x$PING_N, iperf3 ${IPERF_T}s)"

measure() { # measure <path-label> <srcnode> <dstip> <note>
  local label=$1 node=$2 dst=$3 note=$4 r lat thr out
  for r in $(seq 1 $RUNS); do
    lat=$(dx "$node" ping -c $PING_N -i 0.2 -W 2 "$dst" 2>/dev/null | awk -F'/' '/rtt|round-trip/{print $5}')
    out=$(dx "$node" iperf3 -c "$dst" -t $IPERF_T -J 2>/dev/null)
    thr=$(printf '%s' "$out" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); print(round(d["end"]["sum_received"]["bits_per_second"]/1e6,1))
except Exception: print("")')
    printf '%s,%s,%s,%s,%s,%s\n' "$MODE" "$label" "$r" "${lat:-}" "${thr:-}" "$note" >> "$PERF"
    printf '  %-20s run %s  latency=%-8s ms  throughput=%-9s Mbps\n' "$label" "$r" "${lat:-n/a}" "${thr:-n/a}"
  done
}
blocked_row() { local r; for r in $(seq 1 $RUNS); do printf '%s,%s,%s,,,%s\n' "$MODE" "$1" "$r" "$2" >> "$PERF"; done; echo "  $1: $2"; }

# Path B always
measure "internal->dmz" internal $DMZ "routed via firewall"
# Path A depends on mode
case "$MODE" in
  minimal)  vpn_down; measure "remote->internal" vpnclient $INTERNAL "direct, no NAT, unencrypted" ;;
  firewall|firewall-broken)
            vpn_down
            if dx vpnclient ping -c1 -W2 $INTERNAL >/dev/null 2>&1; then measure "remote->internal" vpnclient $INTERNAL "UNEXPECTED: reachable"; else blocked_row "remote->internal" "blocked by policy (no VPN) - expected"; fi ;;
  vpn)
    VC="$MDIR/vpn-connect.csv"; echo 'mode,attempt,connect_time_s,note' > "$VC"
    say "-- VPN connection time (tunnel start -> first successful HTTP 200 from internal.lab), $RUNS attempts"
    for r in $(seq 1 $RUNS); do
      vpn_down; t0=$(date +%s.%N)
      if vpn_up admin admin; then
        for i in $(seq 1 60); do dx vpnclient curl -s -m 1 -o /dev/null -w '%{http_code}' http://$INTERNAL/ 2>/dev/null | grep -q 200 && break; sleep 0.2; done
        t1=$(date +%s.%N); dt=$(awk "BEGIN{printf \"%.2f\", $t1-$t0}")
        echo "$MODE,$r,$dt,admin profile, cert+password" >> "$VC"; echo "  attempt $r: ${dt}s"
      else echo "$MODE,$r,,FAILED to connect" >> "$VC"; echo "  attempt $r: FAILED"; fi
    done
    # throughput/latency through the tunnel (admin is connected from the last attempt)
    measure "remote->internal" vpnclient $INTERNAL "through OpenVPN tunnel (AES-256-GCM) - extra encryption hop, documented path change"
    vpn_down ;;
esac
echo; echo "Written: $PERF"
