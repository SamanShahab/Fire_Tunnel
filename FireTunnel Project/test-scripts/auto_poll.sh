#!/bin/bash
# FireTunnel — Auto Polling Script
# Usage: ./auto_poll.sh <SCENARIO> <INTERVAL_SECONDS>
# Example: ./auto_poll.sh MINIMAL 5
#          ./auto_poll.sh FIREWALL 5
#          ./auto_poll.sh FIREWALL_VPN 5

SCENARIO=${1:-MINIMAL}
INTERVAL=${2:-5}
BACKEND_URL="http://localhost:5000/api"
TOKEN="<your_jwt_token_here>"

# ─── Scenario Definitions ───────────────────────────────────────────────────

declare -A TESTS_SOURCE
declare -A TESTS_DEST
declare -A TESTS_PROTO
declare -A TESTS_PORT
declare -A TESTS_SRC_ZONE
declare -A TESTS_DST_ZONE
declare -A TESTS_EXPECTED

if [ "$SCENARIO" = "MINIMAL" ]; then
  TESTS=(
    "Guest_to_Internal"
    "Guest_to_Internet"
    "DMZ_to_Internal"
    "External_to_Internal"
  )
  TESTS_SOURCE=(  [Guest_to_Internal]="192.168.30.10" [Guest_to_Internet]="192.168.30.10" [DMZ_to_Internal]="192.168.20.10" [External_to_Internal]="10.0.0.10" )
  TESTS_DEST=(    [Guest_to_Internal]="192.168.10.10" [Guest_to_Internet]="8.8.8.8"       [DMZ_to_Internal]="192.168.10.10" [External_to_Internal]="192.168.10.10" )
  TESTS_PROTO=(   [Guest_to_Internal]="ICMP"          [Guest_to_Internet]="ICMP"           [DMZ_to_Internal]="ICMP"          [External_to_Internal]="TCP" )
  TESTS_PORT=(    [Guest_to_Internal]=0               [Guest_to_Internet]=0                [DMZ_to_Internal]=0               [External_to_Internal]=80 )
  TESTS_SRC_ZONE=([Guest_to_Internal]="GUEST"         [Guest_to_Internet]="GUEST"          [DMZ_to_Internal]="DMZ"           [External_to_Internal]="EXTERNAL" )
  TESTS_DST_ZONE=([Guest_to_Internal]="INTERNAL"      [Guest_to_Internet]="EXTERNAL"       [DMZ_to_Internal]="INTERNAL"      [External_to_Internal]="INTERNAL" )
  TESTS_EXPECTED=([Guest_to_Internal]="BLOCK"         [Guest_to_Internet]="ALLOW"          [DMZ_to_Internal]="BLOCK"         [External_to_Internal]="BLOCK" )

elif [ "$SCENARIO" = "FIREWALL" ]; then
  TESTS=(
    "Guest_to_Internal"
    "DMZ_to_Internal"
    "External_to_DMZ_HTTP"
    "External_to_Internal"
  )
  TESTS_SOURCE=(  [Guest_to_Internal]="192.168.30.10" [DMZ_to_Internal]="192.168.20.10" [External_to_DMZ_HTTP]="10.0.0.10" [External_to_Internal]="10.0.0.10" )
  TESTS_DEST=(    [Guest_to_Internal]="192.168.10.10" [DMZ_to_Internal]="192.168.10.10" [External_to_DMZ_HTTP]="192.168.20.10" [External_to_Internal]="192.168.10.10" )
  TESTS_PROTO=(   [Guest_to_Internal]="ICMP"          [DMZ_to_Internal]="ICMP"          [External_to_DMZ_HTTP]="TCP"           [External_to_Internal]="TCP" )
  TESTS_PORT=(    [Guest_to_Internal]=0               [DMZ_to_Internal]=0               [External_to_DMZ_HTTP]=80              [External_to_Internal]=80 )
  TESTS_SRC_ZONE=([Guest_to_Internal]="GUEST"         [DMZ_to_Internal]="DMZ"           [External_to_DMZ_HTTP]="EXTERNAL"      [External_to_Internal]="EXTERNAL" )
  TESTS_DST_ZONE=([Guest_to_Internal]="INTERNAL"      [DMZ_to_Internal]="INTERNAL"      [External_to_DMZ_HTTP]="DMZ"           [External_to_Internal]="INTERNAL" )
  TESTS_EXPECTED=([Guest_to_Internal]="BLOCK"         [DMZ_to_Internal]="BLOCK"         [External_to_DMZ_HTTP]="ALLOW"         [External_to_Internal]="BLOCK" )

elif [ "$SCENARIO" = "FIREWALL_VPN" ]; then
  TESTS=(
    "VPN_to_Internal_Web"
    "VPN_to_Internal_DB"
    "Guest_to_Internal"
    "Unauthenticated_Access"
  )
  TESTS_SOURCE=(  [VPN_to_Internal_Web]="10.10.10.2"  [VPN_to_Internal_DB]="10.10.10.2"  [Guest_to_Internal]="192.168.30.10" [Unauthenticated_Access]="10.0.0.10" )
  TESTS_DEST=(    [VPN_to_Internal_Web]="192.168.10.10" [VPN_to_Internal_DB]="192.168.10.10" [Guest_to_Internal]="192.168.10.10" [Unauthenticated_Access]="192.168.10.10" )
  TESTS_PROTO=(   [VPN_to_Internal_Web]="TCP"          [VPN_to_Internal_DB]="TCP"          [Guest_to_Internal]="ICMP"          [Unauthenticated_Access]="TCP" )
  TESTS_PORT=(    [VPN_to_Internal_Web]=80             [VPN_to_Internal_DB]=3306           [Guest_to_Internal]=0               [Unauthenticated_Access]=80 )
  TESTS_SRC_ZONE=([VPN_to_Internal_Web]="VPN"          [VPN_to_Internal_DB]="VPN"          [Guest_to_Internal]="GUEST"         [Unauthenticated_Access]="EXTERNAL" )
  TESTS_DST_ZONE=([VPN_to_Internal_Web]="INTERNAL"     [VPN_to_Internal_DB]="INTERNAL"     [Guest_to_Internal]="INTERNAL"      [Unauthenticated_Access]="INTERNAL" )
  TESTS_EXPECTED=([VPN_to_Internal_Web]="ALLOW"        [VPN_to_Internal_DB]="BLOCK"        [Guest_to_Internal]="BLOCK"         [Unauthenticated_Access]="BLOCK" )

else
  echo "Unknown scenario: $SCENARIO"
  echo "Use: MINIMAL | FIREWALL | FIREWALL_VPN"
  exit 1
fi

# ─── Polling Loop ────────────────────────────────────────────────────────────

echo "=== FireTunnel Auto Polling ==="
echo "Scenario : $SCENARIO"
echo "Interval : ${INTERVAL}s"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] Running $SCENARIO tests..."

  for TEST in "${TESTS[@]}"; do
    SRC="${TESTS_SOURCE[$TEST]}"
    DST="${TESTS_DEST[$TEST]}"
    PROTO="${TESTS_PROTO[$TEST]}"
    PORT="${TESTS_PORT[$TEST]}"
    SRC_ZONE="${TESTS_SRC_ZONE[$TEST]}"
    DST_ZONE="${TESTS_DST_ZONE[$TEST]}"
    EXPECTED="${TESTS_EXPECTED[$TEST]}"

    # Actual connectivity check
    if [ "$PROTO" = "ICMP" ]; then
      ping -c 1 -W 1 "$DST" > /dev/null 2>&1 && ACTUAL="ALLOW" || ACTUAL="BLOCK"
    else
      # TCP check using /dev/tcp
      (echo > /dev/tcp/$DST/$PORT) > /dev/null 2>&1 && ACTUAL="ALLOW" || ACTUAL="BLOCK"
    fi

    STATUS=$( [ "$ACTUAL" = "$EXPECTED" ] && echo "PASS" || echo "FAIL" )
    TEST_NAME="${TEST//_/ }"

    echo "  $TEST_NAME: expected=$EXPECTED actual=$ACTUAL [$STATUS]"

    # POST security event
    curl -s -X POST "$BACKEND_URL/events" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"source\":\"$SRC\",\"sourceZone\":\"$SRC_ZONE\",\"destination\":\"$DST\",\"destinationZone\":\"$DST_ZONE\",\"protocol\":\"$PROTO\",\"port\":$PORT,\"action\":\"$ACTUAL\",\"reason\":\"Auto poll - $TEST_NAME\",\"scenario\":\"$SCENARIO\"}" > /dev/null

    # POST test result
    curl -s -X POST "$BACKEND_URL/tests" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"scenario\":\"$SCENARIO\",\"testName\":\"$TEST_NAME\",\"source\":\"$SRC\",\"destination\":\"$DST\",\"expectedAction\":\"$EXPECTED\",\"actualAction\":\"$ACTUAL\",\"status\":\"$STATUS\",\"notes\":\"Auto poll at $TIMESTAMP\"}" > /dev/null

    # POST latency metric
    LATENCY=$(ping -c 1 -W 1 "$DST" 2>/dev/null | tail -1 | awk -F'/' '{print $5}')
    if [ -n "$LATENCY" ] && [ "$LATENCY" != "0" ]; then
      curl -s -X POST "$BACKEND_URL/performance" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"scenario\":\"$SCENARIO\",\"metricType\":\"LATENCY\",\"run\":$(date +%s),\"value\":$LATENCY,\"unit\":\"ms\",\"source\":\"$SRC\",\"destination\":\"$DST\"}" > /dev/null
    fi
  done

  echo ""
  sleep "$INTERVAL"
done
