const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to check if user has access to photo
const canAccessPhoto = (userId, userRole, photoFamilyId, userFamilyId, photoId, callback) => {
  if (photoFamilyId !== userFamilyId) {
    return callback(false);
  }
  
  // Check if photo is shared with this user
  const checkShareQuery = `
    SELECT ps.id FROM photo_shares ps
    WHERE ps.photo_id = ? AND ps.shared_with = ?
  `;
  
  db.query(checkShareQuery, [photoId, userId], (err, shareResults) => {
    if (err) return callback(false);
    if (shareResults.length > 0) {
      return callback(true);
    }
    return callback(true); // All family members can access family photos
  });
};

// -------------------- UPLOAD SINGLE PHOTO --------------------
exports.uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No photo file uploaded" });
  }

  const { description, tags } = req.body;
  const { member_id, family_id } = req.user;

  // Validate file type (images only)
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    // Delete the uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "Only image files are allowed (JPEG, PNG, GIF, WEBP, BMP)" });
  }

  const photoQuery = `
    INSERT INTO photos (family_id, uploaded_by, photo_name, file_path, file_size, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    photoQuery,
    [
      family_id,
      member_id,
      req.file.originalname,
      req.file.path,
      req.file.size,
      description || null,
      tags || null
    ],
    (err, result) => {
      if (err) {
        // Delete file if database insert fails
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        message: "Photo uploaded successfully",
        photo_id: result.insertId,
        photo_name: req.file.originalname,
        file_path: req.file.path
      });
    }
  );
};

// -------------------- UPLOAD MULTIPLE PHOTOS --------------------
exports.uploadMultiplePhotos = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No photo files uploaded" });
  }

  const { description, tags } = req.body;
  const { member_id, family_id } = req.user;
  
  const results = {
    successful: [],
    failed: []
  };

  // Process each file
  for (const file of req.files) {
    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      // Delete the uploaded file
      fs.unlinkSync(file.path);
      results.failed.push({
        filename: file.originalname,
        error: "Only image files are allowed (JPEG, PNG, GIF, WEBP, BMP)"
      });
      continue;
    }

    // Insert into database
    const photoQuery = `
      INSERT INTO photos (family_id, uploaded_by, photo_name, file_path, file_size, description, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await new Promise((resolve, reject) => {
        db.query(
          photoQuery,
          [
            family_id,
            member_id,
            file.originalname,
            file.path,
            file.size,
            description || null,
            tags || null
          ],
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });
      
      results.successful.push({
        photo_id: result.insertId,
        photo_name: file.originalname,
        file_path: file.path,
        size: file.size
      });
    } catch (err) {
      // Delete file if database insert fails
      fs.unlinkSync(file.path);
      results.failed.push({
        filename: file.originalname,
        error: err.message
      });
    }
  }

  res.status(201).json({
    message: `${results.successful.length} photos uploaded successfully, ${results.failed.length} failed`,
    successful: results.successful,
    failed: results.failed
  });
};

// -------------------- GET ALL PHOTOS --------------------
exports.getPhotos = (req, res) => {
  const { family_id } = req.user;
  const { page = 1, limit = 20, tags } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.*, 
           CONCAT(m.first_name, ' ', m.second_name, ' ', m.third_name) AS uploaded_by_name
    FROM photos p
    JOIN family_members m ON m.id = p.uploaded_by
    WHERE p.family_id = ?
  `;
  
  const queryParams = [family_id];
  
  if (tags) {
    query += ` AND p.tags LIKE ?`;
    queryParams.push(`%${tags}%`);
  }
  
  query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM photos WHERE family_id = ?`;
    const countParams = [family_id];
    
    if (tags) {
      countQuery += ` AND tags LIKE ?`;
      countParams.push(`%${tags}%`);
    }
    
    db.query(countQuery, countParams, (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.status(200).json({
        photos,
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit)
      });
    });
  });
};

// -------------------- GET PHOTO BY ID --------------------
exports.getPhotoById = (req, res) => {
  const { photo_id } = req.params;
  const { member_id, family_id, role } = req.user;

  const photoQuery = `
    SELECT p.*, 
           CONCAT(m.first_name, ' ', m.second_name, ' ', m.third_name) AS uploaded_by_name
    FROM photos p
    JOIN family_members m ON m.id = p.uploaded_by
    WHERE p.id = ?
  `;

  db.query(photoQuery, [photo_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    const photo = photos[0];
    
    if (photo.family_id !== family_id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.status(200).json(photo);
  });
};

// -------------------- DOWNLOAD PHOTO --------------------
exports.downloadPhoto = (req, res) => {
  const { photo_id } = req.params;
  const { family_id } = req.user;

  const photoQuery = `SELECT * FROM photos WHERE id = ?`;
  
  db.query(photoQuery, [photo_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    const photo = photos[0];
    
    if (photo.family_id !== family_id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    if (!fs.existsSync(photo.file_path)) {
      return res.status(404).json({ message: "Photo file not found on server" });
    }
    
    res.download(photo.file_path, photo.photo_name);
  });
};

// -------------------- DELETE PHOTO --------------------
exports.deletePhoto = (req, res) => {
  const { photo_id } = req.params;
  const { member_id, family_id, role } = req.user;

  const photoQuery = `SELECT * FROM photos WHERE id = ?`;
  
  db.query(photoQuery, [photo_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    const photo = photos[0];
    
    // Check permissions: admin or uploader can delete
    if (photo.family_id !== family_id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    if (role !== "admin" && photo.uploaded_by !== member_id) {
      return res.status(403).json({ message: "Only admin or the uploader can delete this photo" });
    }
    
    // Delete from database first
    const deleteQuery = `DELETE FROM photos WHERE id = ?`;
    db.query(deleteQuery, [photo_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Delete file from disk
      if (fs.existsSync(photo.file_path)) {
        fs.unlinkSync(photo.file_path);
      }
      
      res.status(200).json({ message: "Photo deleted successfully" });
    });
  });
};

// -------------------- DELETE MULTIPLE PHOTOS --------------------
exports.deleteMultiplePhotos = (req, res) => {
  const { photo_ids } = req.body; // Expecting an array of photo IDs
  const { member_id, family_id, role } = req.user;

  if (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) {
    return res.status(400).json({ message: "Photo IDs array required" });
  }

  if (photo_ids.length > 50) {
    return res.status(400).json({ message: "Maximum 50 photos can be deleted at once" });
  }

  const results = {
    successful: [],
    failed: []
  };

  // Process each photo
  photo_ids.forEach((photo_id) => {
    const photoQuery = `SELECT * FROM photos WHERE id = ?`;
    
    db.query(photoQuery, [photo_id], (err, photos) => {
      if (err || photos.length === 0) {
        results.failed.push({
          photo_id: photo_id,
          error: err ? err.message : "Photo not found"
        });
        return;
      }
      
      const photo = photos[0];
      
      // Check permissions
      if (photo.family_id !== family_id) {
        results.failed.push({
          photo_id: photo_id,
          error: "Access denied"
        });
        return;
      }
      
      if (role !== "admin" && photo.uploaded_by !== member_id) {
        results.failed.push({
          photo_id: photo_id,
          error: "Only admin or the uploader can delete this photo"
        });
        return;
      }
      
      // Delete from database
      const deleteQuery = `DELETE FROM photos WHERE id = ?`;
      db.query(deleteQuery, [photo_id], (err) => {
        if (err) {
          results.failed.push({
            photo_id: photo_id,
            error: err.message
          });
        } else {
          // Delete file from disk
          if (fs.existsSync(photo.file_path)) {
            fs.unlinkSync(photo.file_path);
          }
          results.successful.push({
            photo_id: photo_id,
            photo_name: photo.photo_name
          });
        }
        
        // Check if all photos have been processed
        if (results.successful.length + results.failed.length === photo_ids.length) {
          res.status(200).json({
            message: `${results.successful.length} photos deleted successfully, ${results.failed.length} failed`,
            successful: results.successful,
            failed: results.failed
          });
        }
      });
    });
  });
};

// -------------------- UPDATE PHOTO DETAILS --------------------
exports.updatePhotoDetails = (req, res) => {
  const { photo_id } = req.params;
  const { description, tags } = req.body;
  const { member_id, family_id, role } = req.user;

  const photoQuery = `SELECT * FROM photos WHERE id = ?`;
  
  db.query(photoQuery, [photo_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    const photo = photos[0];
    
    if (photo.family_id !== family_id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Check permissions: admin or uploader can update
    if (role !== "admin" && photo.uploaded_by !== member_id) {
      return res.status(403).json({ message: "Only admin or the uploader can update this photo" });
    }
    
    const updateQuery = `
      UPDATE photos 
      SET description = COALESCE(?, description),
          tags = COALESCE(?, tags)
      WHERE id = ?
    `;
    
    db.query(updateQuery, [description || null, tags || null, photo_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ message: "Photo updated successfully" });
    });
  });
};

// -------------------- SHARE PHOTO WITH FAMILY MEMBER --------------------
exports.sharePhotoWithMember = (req, res) => {
  const { photo_id } = req.params;
  const { member_id_to_share } = req.body;
  const { member_id, family_id, role } = req.user;

  // Verify photo exists and belongs to user's family
  const photoQuery = `SELECT * FROM photos WHERE id = ? AND family_id = ?`;
  
  db.query(photoQuery, [photo_id, family_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    // Verify the member to share with exists in the same family
    const memberQuery = `SELECT * FROM family_members WHERE id = ? AND family_id = ?`;
    db.query(memberQuery, [member_id_to_share, family_id], (err, members) => {
      if (err) return res.status(500).json({ error: err.message });
      if (members.length === 0) return res.status(404).json({ message: "Family member not found" });
      
      // Check if already shared
      const checkShareQuery = `SELECT * FROM photo_shares WHERE photo_id = ? AND shared_with = ?`;
      db.query(checkShareQuery, [photo_id, member_id_to_share], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing.length > 0) {
          return res.status(400).json({ message: "Photo already shared with this member" });
        }
        
        // Create share record
        const shareQuery = `INSERT INTO photo_shares (photo_id, shared_with) VALUES (?, ?)`;
        db.query(shareQuery, [photo_id, member_id_to_share], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: "Photo shared successfully" });
        });
      });
    });
  });
};

// -------------------- GET SHAREABLE LINK --------------------
exports.getShareableLink = (req, res) => {
  const { photo_id } = req.params;
  const { member_id, family_id } = req.user;
  const { expires_in_hours = 168 } = req.query; // Default 7 days

  // Verify photo exists and belongs to user's family
  const photoQuery = `SELECT * FROM photos WHERE id = ? AND family_id = ?`;
  
  db.query(photoQuery, [photo_id, family_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    // Generate unique token
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = expires_in_hours ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000) : null;
    
    const insertQuery = `
      INSERT INTO photo_share_links (photo_id, share_token, created_by, expires_at)
      VALUES (?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [photo_id, shareToken, member_id, expiresAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const shareableUrl = `${req.protocol}://${req.get('host')}/api/photos/downloadShared/${shareToken}`;
      res.status(200).json({
        shareable_url: shareableUrl,
        share_token: shareToken,
        expires_at: expiresAt
      });
    });
  });
};

// -------------------- DOWNLOAD VIA SHARED LINK --------------------
exports.downloadSharedPhoto = (req, res) => {
  const { token } = req.params;
  
  const linkQuery = `
    SELECT pl.*, p.file_path, p.photo_name, p.family_id
    FROM photo_share_links pl
    JOIN photos p ON p.id = pl.photo_id
    WHERE pl.share_token = ?
  `;
  
  db.query(linkQuery, [token], (err, links) => {
    if (err) return res.status(500).json({ error: err.message });
    if (links.length === 0) return res.status(404).json({ message: "Invalid share link" });
    
    const link = links[0];
    
    // Check if link has expired
    if (link.expires_at && new Date() > new Date(link.expires_at)) {
      return res.status(410).json({ message: "Share link has expired" });
    }
    
    if (!fs.existsSync(link.file_path)) {
      return res.status(404).json({ message: "Photo file not found" });
    }
    
    res.download(link.file_path, link.photo_name);
  });
};

// -------------------- GET PHOTOS BY TAGS --------------------
exports.getPhotosByTags = (req, res) => {
  const { family_id } = req.user;
  const { tags } = req.query;
  
  if (!tags) {
    return res.status(400).json({ message: "Tags parameter required" });
  }
  
  const tagArray = tags.split(',');
  let query = `
    SELECT p.*, 
           CONCAT(m.first_name, ' ', m.second_name, ' ', m.third_name) AS uploaded_by_name
    FROM photos p
    JOIN family_members m ON m.id = p.uploaded_by
    WHERE p.family_id = ?
  `;
  
  const queryParams = [family_id];
  
  // Add conditions for each tag
  tagArray.forEach((tag, index) => {
    query += ` AND p.tags LIKE ?`;
    queryParams.push(`%${tag.trim()}%`);
  });
  
  query += ` ORDER BY p.created_at DESC`;
  
  db.query(query, queryParams, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(photos);
  });
};