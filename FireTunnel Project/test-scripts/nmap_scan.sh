MI
mkdir -p $OUTPUT_DIR

NETWORKS=("192.168.10.0/24" "192.168.20.0/24" "192.168.30.0/24")
BACKEND_URL="http://localhost:5000/api"
TOKEN="<your_jwt_token_here>"

echo "=== FireTunnel Nmap Scan ==="
echo "Scenario: $SCENARIO"
echo "Timestamp: $TIMESTAMP"
echo ""

TOTAL_HOSTS=0
TOTAL_PORTS=0
TOTAL_SERVICES=0

for NETWORK in "${NETWORKS[@]}"; do
  echo "Scanning: $NETWORK"
  OUTPUT_FILE="$OUTPUT_DIR/${SCENARIO}_${NETWORK//\//_}_${TIMESTAMP}.txt"

  nmap -sV -T4 $NETWORK -oN $OUTPUT_FILE 2>/dev/null

  HOSTS=$(grep -c "Host:" $OUTPUT_FILE 2>/dev/null || echo 0)
  PORTS=$(grep -c "open" $OUTPUT_FILE 2>/dev/null || echo 0)
  SERVICES=$(grep "open" $OUTPUT_FILE | awk '{print $3}' | sort -u | wc -l 2>/dev/null || echo 0)

  TOTAL_HOSTS=$((TOTAL_HOSTS + HOSTS))
  TOTAL_PORTS=$((TOTAL_PORTS + PORTS))
  TOTAL_SERVICES=$((TOTAL_SERVICES + SERVICES))

  echo "  Hosts: $HOSTS | Open Ports: $PORTS | Services: $SERVICES"
done

echo ""
echo "=== TOTALS ==="
echo "Hosts: $TOTAL_HOSTS"
echo "Open Ports: $TOTAL_PORTS"
echo "Services: $TOTAL_SERVICES"

# Post results to FireTunnel backend
curl -s -X POST "$BACKEND_URL/scans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"scenario\": \"$SCENARIO\",
    \"targetNetwork\": \"Multiple\",
    \"hostsDiscovered\": $TOTAL_HOSTS,
    \"openPorts\": $TOTAL_PORTS,
    \"exposedServices\": $TOTAL_SERVICES,
    \"rawOutput\": \"Scan saved to $OUTPUT_DIR\"
  }" > /dev/null

echo ""
echo "Results saved to $OUTPUT_DIR and posted to dashboard."
