const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

// -------------------- Multer Setup --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|docx|doc|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error("Only PDF, Word, Excel files are allowed"));
  }
}).single("file");

// -------------------- Upload Document --------------------
exports.uploadDocument = (req, res) => {
  upload(req, res, function (err) {
    if (err) return res.status(400).json({ message: err.message });

    const { file_name, description, tags } = req.body;
    const family_id = req.user.family_id;
    const uploaded_by = req.user.member_id;

    if (!file_name) return res.status(400).json({ message: "File name required" });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const file_type = ext.includes("pdf") ? "pdf" :
                      (ext.includes("doc") ? "word" : "excel");

    const file_path = req.file.path;

    const query = `
      INSERT INTO documents (family_id, uploaded_by, file_name, file_path, file_type, description, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [family_id, uploaded_by, file_name, file_path, file_type, description || null, tags || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.status(201).json({ message: "Document uploaded successfully", document_id: result.insertId });
      }
    );
  });
};

// -------------------- Get Documents --------------------
exports.getDocuments = (req, res) => {
  const family_id = req.user.family_id;
  const { filter, search } = req.query;

  let query = `SELECT * FROM documents WHERE family_id = ?`;
  const params = [family_id];

  if (filter && filter.toLowerCase() !== "all") {
    query += " AND file_type = ?";
    params.push(filter.toLowerCase());
  }

  if (search) {
    query += " AND (file_name LIKE ? OR tags LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  query += " ORDER BY created_at DESC";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.status(200).json(results);
  });
};

// -------------------- Download Document --------------------
exports.downloadDocument = (req, res) => {
  const { document_id } = req.params;
  const family_id = req.user.family_id;

  const query = "SELECT file_path, file_name FROM documents WHERE id = ? AND family_id = ?";
  db.query(query, [document_id, family_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Document not found" });

    const doc = results[0];
    res.download(path.resolve(doc.file_path), doc.file_name);
  });
};

// -------------------- Generate Shareable Link for Social Media --------------------
exports.getShareableLink = (req, res) => {
  const { document_id } = req.params;
  const family_id = req.user.family_id;

  const query = "SELECT id, file_name FROM documents WHERE id = ? AND family_id = ?";
  db.query(query, [document_id, family_id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Document not found" });

    const doc = results[0];

    // Create a JWT token valid for 24 hours (for external share)
    const token = jwt.sign({ document_id: doc.id }, JWT_SECRET, { expiresIn: '24h' });
    const shareableUrl = `${req.protocol}://${req.get('host')}/api/documents/downloadShared/${token}`;

    // Can be shared via WhatsApp, Telegram, etc.
    res.status(200).json({ shareable_url: shareableUrl });
  });
};

// -------------------- Download Shared Document via Token --------------------
exports.downloadSharedDocument = (req, res) => {
  const { token } = req.params;

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: "Invalid or expired link" });

    const document_id = payload.document_id;

    const query = "SELECT file_path, file_name FROM documents WHERE id = ?";
    db.query(query, [document_id], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) return res.status(404).json({ message: "Document not found" });

      const doc = results[0];
      res.download(path.resolve(doc.file_path), doc.file_name);
    });
  });
};