#!/bin/bash
# FireTunnel — Performance Test Script
# Run from any VM in the lab
# Usage: ./perf_test.sh <scenario> <target_ip>

SCENARIO=${1:-FIREWALL}
TARGET=${2:-192.168.10.10}
BACKEND_URL="http://localhost:5000/api"
TOKEN="<your_jwt_token_here>"

echo "=== FireTunnel Performance Test ==="
echo "Scenario: $SCENARIO | Target: $TARGET"
echo ""

# Latency — 3 runs
echo "--- Latency Test (ping) ---"
for RUN in 1 2 3; do
  LATENCY=$(ping -c 5 $TARGET | tail -1 | awk -F'/' '{print $5}')
  echo "Run $RUN: ${LATENCY} ms"

  curl -s -X POST "$BACKEND_URL/performance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"scenario\":\"$SCENARIO\",\"metricType\":\"LATENCY\",\"run\":$RUN,\"value\":$LATENCY,\"unit\":\"ms\",\"source\":\"$(hostname)\",\"destination\":\"$TARGET\"}" > /dev/null
done

# Throughput — requires iperf3 server running on target
echo ""
echo "--- Throughput Test (iperf3) ---"
echo "Make sure iperf3 -s is running on $TARGET"
for RUN in 1 2 3; do
  THROUGHPUT=$(iperf3 -c $TARGET -t 5 -J 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(d['end']['sum_received']['bits_per_second']/1e6, 2))" 2>/dev/null || echo "0")
  echo "Run $RUN: ${THROUGHPUT} Mbps"

  curl -s -X POST "$BACKEND_URL/performance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"scenario\":\"$SCENARIO\",\"metricType\":\"THROUGHPUT\",\"run\":$RUN,\"value\":$THROUGHPUT,\"unit\":\"Mbps\",\"source\":\"$(hostname)\",\"destination\":\"$TARGET\"}" > /dev/null
done

echo ""
echo "Performance results posted to dashboard."
