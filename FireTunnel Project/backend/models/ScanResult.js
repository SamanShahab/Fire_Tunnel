const mongoose = require("mongoose");

const scanResultSchema = new mongoose.Schema({
  scenario: { type: String, enum: ["MINIMAL", "FIREWALL", "FIREWALL_VPN"], required: true },
  timestamp: { type: Date, default: Date.now },
  targetNetwork: String,
  hostsDiscovered: Number,
  openPorts: Number,
  exposedServices: Number,
  rawOutput: String,
  hosts: [
    {
      ip: String,
      hostname: String,
      status: String,
      ports: [{ port: Number, protocol: String, state: String, service: String }],
    },
  ],
});

module.exports = mongoose.model("ScanResult", scanResultSchema);
