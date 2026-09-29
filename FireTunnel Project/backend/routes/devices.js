const router = require("express").Router();
const NetworkDevice = require("../models/NetworkDevice");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const devices = await NetworkDevice.find();
  res.json(devices);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const device = await NetworkDevice.create(req.body);
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  const device = await NetworkDevice.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(device);
});

module.exports = router;
