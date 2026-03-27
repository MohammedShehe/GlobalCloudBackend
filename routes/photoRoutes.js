const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const photoController = require("../controllers/photoController");
const { authenticateToken } = require("../controllers/authController");

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/photos"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  },
  fileFilter: fileFilter
});

// Upload endpoints
router.post("/upload", authenticateToken, upload.single("photo"), photoController.uploadPhoto);
router.post("/upload-multiple", authenticateToken, upload.array("photos", 20), photoController.uploadMultiplePhotos);

// Filter and search endpoints
router.get("/all", authenticateToken, photoController.getPhotos);
router.get("/filter-options", authenticateToken, photoController.getFilterOptions);
router.get("/by-month", authenticateToken, photoController.getPhotosByMonth);
router.get("/stats", authenticateToken, photoController.getPhotoStats);
router.get("/tags/search", authenticateToken, photoController.getPhotosByTags);

// Single photo operations
router.get("/:photo_id", authenticateToken, photoController.getPhotoById);
router.get("/download/:photo_id", authenticateToken, photoController.downloadPhoto);
router.delete("/:photo_id", authenticateToken, photoController.deletePhoto);
router.put("/:photo_id", authenticateToken, photoController.updatePhotoDetails);

// Sharing endpoints
router.post("/:photo_id/share", authenticateToken, photoController.sharePhotoWithMember);
router.post("/delete-multiple", authenticateToken, photoController.deleteMultiplePhotos);

// Social media shareable links
router.get("/shareLink/:photo_id", authenticateToken, photoController.getShareableLink);
router.get("/downloadShared/:token", photoController.downloadSharedPhoto);

module.exports = router;