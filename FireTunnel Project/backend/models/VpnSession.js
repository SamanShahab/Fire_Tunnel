const mongoose = require("mongoose");

const vpnSessionSchema = new mongoose.Schema({
  username: String,
  assignedIP: String,
  publicKey: String,
  allowedNetworks: [String],
  connectedAt: { type: Date, default: Date.now },
  disconnectedAt: Date,
  status: { type: String, enum: ["CONNECTED", "DISCONNECTED"], default: "CONNECTED" },
  bytesReceived: { type: Number, default: 0 },
  bytesSent: { type: Number, default: 0 },
});

module.exports = mongoose.model("VpnSession", vpnSessionSchema);
