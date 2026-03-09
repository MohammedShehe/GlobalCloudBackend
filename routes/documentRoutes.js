const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const { authenticateToken } = require("../controllers/authController");

// Auth-protected endpoints
router.post("/upload", authenticateToken, documentController.uploadDocument);
router.get("/all", authenticateToken, documentController.getDocuments);
router.get("/download/:document_id", authenticateToken, documentController.downloadDocument);

// Social media shareable links
router.get("/shareLink/:document_id", authenticateToken, documentController.getShareableLink);
router.get("/downloadShared/:token", documentController.downloadSharedDocument);

module.exports = router;