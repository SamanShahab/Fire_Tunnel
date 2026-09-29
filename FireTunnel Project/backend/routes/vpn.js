const router = require("express").Router();
const VpnSession = require("../models/VpnSession");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const sessions = await VpnSession.find().sort({ connectedAt: -1 });
  res.json(sessions);
});

router.get("/active", authMiddleware, async (req, res) => {
  const sessions = await VpnSession.find({ status: "CONNECTED" });
  res.json(sessions);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const session = await VpnSession.create(req.body);
    req.app.get("io").emit("vpnConnect", session);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id/disconnect", authMiddleware, async (req, res) => {
  const session = await VpnSession.findByIdAndUpdate(
    req.params.id,
    { status: "DISCONNECTED", disconnectedAt: new Date() },
    { new: true }
  );
  req.app.get("io").emit("vpnDisconnect", session);
  res.json(session);
});

module.exports = router;
