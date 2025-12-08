const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require('dotenv').config();

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

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/naviga8";
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Schema with userId
const routeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    origin: { 
      address: { type: String, required: true, trim: true }
    },
    destination: { 
      address: { type: String, required: true, trim: true }
    },
  },
  { timestamps: true }
);

// Create indexes for better performance
routeSchema.index({ userId: 1, createdAt: -1 });

const Route = mongoose.model("Route", routeSchema);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// API: Save route with userId
app.post("/save-route", async (req, res) => {
  const { userId, origin, destination } = req.body;
  
  // Input validation
  if (!userId || !origin || !destination) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  // Sanitize inputs
  const sanitize = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, 200); // Limit length
  };

  try {
    const originAddress = typeof origin === 'string' ? sanitize(origin) : sanitize(origin.address || '');
    const destinationAddress = typeof destination === 'string' ? sanitize(destination) : sanitize(destination.address || '');

    // Check if route already exists for this user
    const existingRoute = await Route.findOne({
      userId: userId,
      "origin.address": originAddress,
      "destination.address": destinationAddress
    });
    
    if (existingRoute) {
      return res.status(409).json({ msg: "Route already saved!" });
    }

    const newRoute = new Route({ 
      userId, 
      origin: { address: originAddress }, 
      destination: { address: destinationAddress } 
    });
    
    const savedRoute = await newRoute.save();
    res.json(savedRoute);
  } catch (err) {
    console.error("Save route error:", err);
    res.status(500).json({ msg: "Failed to save route" });
  }
});

// API: Get routes for specific user
app.get("/routes", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: "User ID required" });
  
  try {
    const routes = await Route.find({ userId: userId })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to 50 routes per user
    res.json(routes);
  } catch (err) {
    console.error("Fetch routes error:", err);
    res.status(500).json({ msg: "Failed to fetch routes" });
  }
});

// API: Delete route with user check
app.delete("/delete-route/:id", async (req, res) => {
  const { userId } = req.query;
  const { id } = req.params;
  
  if (!userId) return res.status(400).json({ msg: "User ID required" });
  if (!id) return res.status(400).json({ msg: "Route ID required" });
  
  try {
    const deleted = await Route.findOneAndDelete({
      _id: id,
      userId: userId
    });
    
    if (!deleted) {
      return res.status(404).json({ msg: "Route not found" });
    }
    
    res.json({ msg: "Route deleted successfully", id: id });
  } catch (err) {
    console.error("Delete route error:", err);
    res.status(500).json({ msg: "Failed to delete route" });
  }
});

// API: Get Google Maps key
app.get("/api/google-key", (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return res.status(500).json({ msg: "API key not configured" });
  }
  res.json({ key });
});

// API: Generate user ID
app.get("/api/user-id", (req, res) => {
  const userId = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  res.json({ userId: userId });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Serve map page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

// Serve saved-routes page
app.get("/saved-routes.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "saved-routes.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: "Something went wrong!" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
