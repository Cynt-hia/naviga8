const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/naviga8";
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Schema with userId
const routeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    origin: { address: String },
    destination: { address: String },
  },
  { timestamps: true }
);
const Route = mongoose.model("Route", routeSchema);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API: Save route with userId
app.post("/save-route", async (req, res) => {
  const { userId, origin, destination } = req.body;
  if (!userId || !origin || !destination)
    return res.status(400).json({ msg: "All fields required" });

  try {
    const originObj = typeof origin === "string" ? { address: origin.trim() } : origin;
    const destinationObj = typeof destination === "string" ? { address: destination.trim() } : destination;

    const existingRoute = await Route.findOne({
      userId: userId,
      "origin.address": originObj.address,
      "destination.address": destinationObj.address
    });
    if (existingRoute) return res.status(409).json({ msg: "Route already saved!" });

    const newRoute = new Route({ userId, origin: originObj, destination: destinationObj });
    const savedRoute = await newRoute.save();
    res.json(savedRoute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to save route" });
  }
});

// API: Get routes for specific user
app.get("/routes", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: "User ID required" });
  
  try {
    const routes = await Route.find({ userId: userId }).sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch routes" });
  }
});

// API: Delete route with user check
app.delete("/delete-route/:id", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: "User ID required" });
  
  try {
    const deleted = await Route.findOneAndDelete({
      _id: req.params.id,
      userId: userId
    });
    if (!deleted) return res.status(404).json({ msg: "Route not found" });
    res.json({ msg: "Deleted", id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to delete route" });
  }
});

// API: Get Google Maps key
app.get("/api/google-key", (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ msg: "API key not configured" });
  res.json({ key });
});

// API: Generate user ID
app.get("/api/user-id", (req, res) => {
  const userId = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  res.json({ userId: userId });
});

// Serve map page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
