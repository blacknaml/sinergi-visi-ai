require("dotenv").config({ path: ".env.local" });
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const cors = require("cors");

// Import Custom Modules
const pool = require("./lib/db");
const { authenticateAgent } = require("./middlewares/auth");
const authController = require("./controllers/authController");
const claimController = require("./controllers/claimController");
const securityController = require("./controllers/securityController");
const socketManager = require("./sockets");

// App Setup
const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 10 * 1024 * 1024 // 10MB for base64 images
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})
const upload = multer({ storage: storage });

// Servir file statis dari folder uploads
app.use("/uploads", express.static("uploads"));

// --- API ROUTES ---
// Auth
app.post("/api/auth/login", authController.login);
app.get("/api/auth/me", authenticateAgent, authController.getMe);

// Agents Management
app.get("/api/agents", authenticateAgent, authController.getAgents);

// Claims
app.get("/api/claims", authenticateAgent, claimController.getClaims);
app.patch("/api/claims/:roomId/archive", authenticateAgent, (req, res) => claimController.archiveClaim(req, res, io));
app.patch("/api/claims/:roomId/decision", authenticateAgent, (req, res) => claimController.decideClaim(req, res, io));
app.patch("/api/claims/:roomId/order", authenticateAgent, (req, res) => claimController.updateClaimOrder(req, res, io));
app.get("/api/orders/:orderId", authenticateAgent, claimController.getOrderDetail);

// Vision AI & Logic
app.post("/api/analyze", upload.single("file"), claimController.analyzePhoto);
app.post("/api/log-refund", claimController.logRefund);

// Security
app.get("/api/security/logs", authenticateAgent, securityController.getSecurityLogs);
app.get("/api/security/stats", authenticateAgent, securityController.getSecurityStats);

// --- WebSocket Setup ---
socketManager(io);

// Start Server
const PORT = process.env.PORT || process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Integrated Server running on port ${PORT}`);
  console.log(` Mode: Modular (Clean Architecture)`);
  console.log(`=========================================`);
});
