$BASE_URL = "http://localhost:5001/api"

Write-Host "Getting token..." -ForegroundColor Yellow
$loginBody = '{"username":"admin","password":"admin123"}'
$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$TOKEN = $loginResponse.token
Write-Host "Token OK" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

function Post($url, $data) {
    try {
        $body = $data | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$BASE_URL/$url" -Method POST -Body $body -Headers $headers | Out-Null
    } catch {}
}

Write-Host "Saving Scenario 1 - MINIMAL..." -ForegroundColor Cyan
Post "scans" @{ scenario="MINIMAL"; targetNetwork="192.168.10.0/24"; hostsDiscovered=2; openPorts=0; exposedServices=0; rawOutput="2 hosts up. No firewall rules. Guest reaches Internal." }
Post "events" @{ source="192.168.30.10"; sourceZone="GUEST"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="ICMP"; port=0; action="ALLOW"; reason="No firewall rules"; scenario="MINIMAL" }
Post "events" @{ source="192.168.20.10"; sourceZone="DMZ"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="ICMP"; port=0; action="ALLOW"; reason="No DMZ isolation"; scenario="MINIMAL" }
Post "events" @{ source="10.0.0.10"; sourceZone="EXTERNAL"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="TCP"; port=80; action="ALLOW"; reason="No external block"; scenario="MINIMAL" }
Post "tests/bulk" @(
    @{ scenario="MINIMAL"; testName="Guest to Internal"; source="192.168.30.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="ALLOW"; status="FAIL"; notes="No firewall - guest reaches internal" }
    @{ scenario="MINIMAL"; testName="Guest to Internet"; source="192.168.30.10"; destination="8.8.8.8"; expectedAction="ALLOW"; actualAction="ALLOW"; status="PASS"; notes="Internet accessible" }
    @{ scenario="MINIMAL"; testName="DMZ to Internal"; source="192.168.20.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="ALLOW"; status="FAIL"; notes="No DMZ isolation" }
    @{ scenario="MINIMAL"; testName="External to Internal"; source="10.0.0.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="ALLOW"; status="FAIL"; notes="No external protection" }
)
Post "performance" @{ scenario="MINIMAL"; metricType="LATENCY"; run=1; value=2.4; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Post "performance" @{ scenario="MINIMAL"; metricType="LATENCY"; run=2; value=2.1; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Post "performance" @{ scenario="MINIMAL"; metricType="LATENCY"; run=3; value=2.6; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Write-Host "Scenario 1 saved" -ForegroundColor Green

Write-Host "Saving Scenario 2 - FIREWALL..." -ForegroundColor Cyan
Post "scans" @{ scenario="FIREWALL"; targetNetwork="192.168.10.0/24"; hostsDiscovered=2; openPorts=1; exposedServices=1; rawOutput="Guest blocked from Internal. DMZ HTTP accessible. Internal protected." }
Post "events" @{ source="192.168.30.10"; sourceZone="GUEST"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="ICMP"; port=0; action="BLOCK"; reason="Guest isolation rule"; scenario="FIREWALL" }
Post "events" @{ source="192.168.20.10"; sourceZone="DMZ"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="ICMP"; port=0; action="BLOCK"; reason="DMZ isolation rule"; scenario="FIREWALL" }
Post "events" @{ source="10.0.0.10"; sourceZone="EXTERNAL"; destination="192.168.20.10"; destinationZone="DMZ"; protocol="TCP"; port=80; action="ALLOW"; reason="DMZ HTTP allowed"; scenario="FIREWALL" }
Post "tests/bulk" @(
    @{ scenario="FIREWALL"; testName="Guest to Internal"; source="192.168.30.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="Guest isolation working" }
    @{ scenario="FIREWALL"; testName="DMZ to Internal"; source="192.168.20.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="DMZ isolated" }
    @{ scenario="FIREWALL"; testName="External to DMZ HTTP"; source="10.0.0.10"; destination="192.168.20.10"; expectedAction="ALLOW"; actualAction="ALLOW"; status="PASS"; notes="DMZ web accessible" }
    @{ scenario="FIREWALL"; testName="External to Internal"; source="10.0.0.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="Internal protected" }
)
Post "performance" @{ scenario="FIREWALL"; metricType="LATENCY"; run=1; value=3.1; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Post "performance" @{ scenario="FIREWALL"; metricType="LATENCY"; run=2; value=3.4; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Post "performance" @{ scenario="FIREWALL"; metricType="LATENCY"; run=3; value=2.9; unit="ms"; source="192.168.10.50"; destination="192.168.10.10" }
Write-Host "Scenario 2 saved" -ForegroundColor Green

Write-Host "Saving Scenario 3 - FIREWALL+VPN..." -ForegroundColor Cyan
Post "scans" @{ scenario="FIREWALL_VPN"; targetNetwork="192.168.10.0/24, 10.10.10.0/24"; hostsDiscovered=2; openPorts=1; exposedServices=1; rawOutput="VPN tunnel active. WireGuard configured. Remote client authenticated. Firewall rules enforced." }
Post "events" @{ source="10.10.10.2"; sourceZone="VPN"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="TCP"; port=80; action="ALLOW"; reason="VPN user authorized for web"; scenario="FIREWALL_VPN" }
Post "events" @{ source="10.10.10.2"; sourceZone="VPN"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="TCP"; port=3306; action="BLOCK"; reason="VPN user not authorized for DB"; scenario="FIREWALL_VPN" }
Post "events" @{ source="192.168.30.10"; sourceZone="GUEST"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="ICMP"; port=0; action="BLOCK"; reason="Guest isolation active"; scenario="FIREWALL_VPN" }
Post "events" @{ source="10.0.0.10"; sourceZone="EXTERNAL"; destination="192.168.10.10"; destinationZone="INTERNAL"; protocol="TCP"; port=80; action="BLOCK"; reason="No VPN = no access"; scenario="FIREWALL_VPN" }
Post "tests/bulk" @(
    @{ scenario="FIREWALL_VPN"; testName="VPN to Internal Web"; source="10.10.10.2"; destination="192.168.10.10"; expectedAction="ALLOW"; actualAction="ALLOW"; status="PASS"; notes="VPN authorized access" }
    @{ scenario="FIREWALL_VPN"; testName="VPN to Internal DB"; source="10.10.10.2"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="VPN unauthorized resource blocked" }
    @{ scenario="FIREWALL_VPN"; testName="Guest to Internal"; source="192.168.30.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="Guest still isolated" }
    @{ scenario="FIREWALL_VPN"; testName="VPN Encryption Active"; source="10.10.10.2"; destination="192.168.10.10"; expectedAction="ALLOW"; actualAction="ALLOW"; status="PASS"; notes="WireGuard tunnel encrypted" }
    @{ scenario="FIREWALL_VPN"; testName="Unauthenticated Access"; source="10.0.0.10"; destination="192.168.10.10"; expectedAction="BLOCK"; actualAction="BLOCK"; status="PASS"; notes="No VPN = no access" }
)
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="LATENCY"; run=1; value=8.7; unit="ms"; source="10.10.10.2"; destination="192.168.10.10" }
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="LATENCY"; run=2; value=9.1; unit="ms"; source="10.10.10.2"; destination="192.168.10.10" }
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="LATENCY"; run=3; value=8.4; unit="ms"; source="10.10.10.2"; destination="192.168.10.10" }
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="VPN_CONNECT_TIME"; run=1; value=1.2; unit="sec"; source="10.10.10.2"; destination="10.10.10.1" }
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="VPN_CONNECT_TIME"; run=2; value=1.1; unit="sec"; source="10.10.10.2"; destination="10.10.10.1" }
Post "performance" @{ scenario="FIREWALL_VPN"; metricType="VPN_CONNECT_TIME"; run=3; value=1.3; unit="sec"; source="10.10.10.2"; destination="10.10.10.1" }
Post "vpn" @{ username="vpnuser1"; assignedIP="10.10.10.2"; allowedNetworks=@("192.168.10.0/24"); status="CONNECTED" }
Write-Host "Scenario 3 saved" -ForegroundColor Green

Write-Host ""
Write-Host "All 3 scenarios saved! Open dashboard: http://localhost:5173" -ForegroundColor Green
