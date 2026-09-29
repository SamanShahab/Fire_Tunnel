const mongoose = require("mongoose");

const networkDeviceSchema = new mongoose.Schema({
  name: String,
  ip: String,
  zone: { type: String, enum: ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN", "FIREWALL"] },
  type: { type: String, enum: ["SERVER", "CLIENT", "FIREWALL", "ROUTER"] },
  os: String,
  status: { type: String, enum: ["ONLINE", "OFFLINE"], default: "ONLINE" },
});

module.exports = mongoose.model("NetworkDevice", networkDeviceSchema);
