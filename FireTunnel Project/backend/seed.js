require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const FirewallRule = require("./models/FirewallRule");
const NetworkDevice = require("./models/NetworkDevice");

const defaultRules = [
  { name: "Internal to Internet", sourceZone: "INTERNAL", destinationZone: "EXTERNAL", protocol: "ANY", port: "ANY", action: "ALLOW", priority: 10 },
  { name: "Guest to Internet", sourceZone: "GUEST", destinationZone: "EXTERNAL", protocol: "ANY", port: "ANY", action: "ALLOW", priority: 20 },
  { name: "Block Guest to Internal", sourceZone: "GUEST", destinationZone: "INTERNAL", protocol: "ANY", port: "ANY", action: "BLOCK", priority: 30 },
  { name: "Allow External to DMZ HTTP", sourceZone: "EXTERNAL", destinationZone: "DMZ", protocol: "TCP", port: "80", action: "ALLOW", priority: 40 },
  { name: "Allow External to DMZ HTTPS", sourceZone: "EXTERNAL", destinationZone: "DMZ", protocol: "TCP", port: "443", action: "ALLOW", priority: 50 },
  { name: "Block External to Internal", sourceZone: "EXTERNAL", destinationZone: "INTERNAL", protocol: "ANY", port: "ANY", action: "BLOCK", priority: 60 },
  { name: "Block DMZ to Internal", sourceZone: "DMZ", destinationZone: "INTERNAL", protocol: "ANY", port: "ANY", action: "BLOCK", priority: 70 },
  { name: "VPN to Internal Web", sourceZone: "VPN", destinationZone: "INTERNAL", protocol: "TCP", port: "80", action: "ALLOW", priority: 80 },
];

const defaultDevices = [
  { name: "OPNsense Firewall", ip: "192.168.10.1", zone: "FIREWALL", type: "FIREWALL", os: "OPNsense" },
  { name: "Internal Server", ip: "192.168.10.10", zone: "INTERNAL", type: "SERVER", os: "Ubuntu 22.04" },
  { name: "DMZ Web Server", ip: "192.168.20.10", zone: "DMZ", type: "SERVER", os: "Ubuntu 22.04" },
  { name: "Guest PC", ip: "192.168.30.10", zone: "GUEST", type: "CLIENT", os: "Ubuntu 22.04" },
  { name: "Kali Linux", ip: "10.0.0.10", zone: "EXTERNAL", type: "CLIENT", os: "Kali Linux" },
  { name: "VPN Client", ip: "10.10.10.2", zone: "VPN", type: "CLIENT", os: "Ubuntu 22.04" },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  await User.deleteMany({});
  await FirewallRule.deleteMany({});
  await NetworkDevice.deleteMany({});

  const hashed = await bcrypt.hash("admin123", 10);
  await User.create({ username: "admin", password: hashed, role: "admin" });
  await FirewallRule.insertMany(defaultRules);
  await NetworkDevice.insertMany(defaultDevices);

  console.log("Seed complete: admin user, firewall rules, and devices created");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
