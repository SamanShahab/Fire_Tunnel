require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const seedScenarios = require("./seedScenarios");
const { setActiveScenario, getActiveScenario } = require("./seedScenarios");
const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const ruleRoutes = require("./routes/rules");
const vpnRoutes = require("./routes/vpn");
const scanRoutes = require("./routes/scans");
const testRoutes = require("./routes/tests");
const performanceRoutes = require("./routes/performance");
const deviceRoutes = require("./routes/devices");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Make io accessible in routes
app.set("io", io);

// Scenario switch API
app.get("/api/scenario/current", (req, res) => {
  res.json({ scenario: getActiveScenario() });
});

app.post("/api/scenario/set", (req, res) => {
  const { scenario } = req.body;
  if (!["MINIMAL", "FIREWALL", "FIREWALL_VPN"].includes(scenario))
    return res.status(400).json({ message: "Invalid scenario" });
  setActiveScenario(scenario);
  io.emit("scenarioChanged", { scenario });
  res.json({ message: `Active scenario set to ${scenario}` });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/vpn", vpnRoutes);
app.use("/api/scans", scanRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/devices", deviceRoutes);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
  socket.on("disconnect", () => console.log("Dashboard disconnected:", socket.id));
});

// MongoDB + server start
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await seedScenarios(io);
    server.listen(process.env.PORT, () =>
      console.log(`FireTunnel backend running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("MongoDB error:", err));
