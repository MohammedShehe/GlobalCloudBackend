const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

  for (const file of req.files) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      results.failed.push({
        filename: file.originalname,
        error: "Only image files are allowed (JPEG, PNG, GIF, WEBP, BMP)"
      });
      continue;
    }

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

// -------------------- GET ALL PHOTOS WITH ADVANCED FILTERS --------------------
exports.getPhotos = (req, res) => {
  const { family_id } = req.user;
  const { 
    page = 1, 
    limit = 20, 
    tags, 
    search, 
    date_from, 
    date_to,
    uploaded_by,
    sort_by = "created_at",
    sort_order = "DESC"
  } = req.query;
  
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT p.*, 
           CONCAT(m.first_name, ' ', m.second_name, ' ', m.third_name) AS uploaded_by_name,
           m.id as uploader_id
    FROM photos p
    JOIN family_members m ON m.id = p.uploaded_by
    WHERE p.family_id = ?
  `;
  
  const queryParams = [family_id];
  
  // Filter by tags (OR condition)
  if (tags) {
    const tagArray = tags.split(',');
    const tagConditions = tagArray.map(() => `p.tags LIKE ?`).join(' OR ');
    query += ` AND (${tagConditions})`;
    tagArray.forEach(tag => queryParams.push(`%${tag.trim()}%`));
  }
  
  // Filter by search term (searches in photo_name, description, tags)
  if (search) {
    query += ` AND (p.photo_name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)`;
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }
  
  // Filter by date range
  if (date_from) {
    query += ` AND DATE(p.created_at) >= ?`;
    queryParams.push(date_from);
  }
  
  if (date_to) {
    query += ` AND DATE(p.created_at) <= ?`;
    queryParams.push(date_to);
  }
  
  // Filter by uploader
  if (uploaded_by) {
    query += ` AND p.uploaded_by = ?`;
    queryParams.push(uploaded_by);
  }
  
  // Sorting
  const allowedSortFields = ['created_at', 'photo_name', 'file_size', 'uploaded_by'];
  const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  query += ` ORDER BY p.${sortField} ${sortOrder}`;
  
  // Pagination
  query += ` LIMIT ? OFFSET ?`;
  queryParams.push(parseInt(limit), parseInt(offset));
  
  db.query(query, queryParams, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get total count with same filters
    let countQuery = `SELECT COUNT(*) as total FROM photos p WHERE p.family_id = ?`;
    const countParams = [family_id];
    
    if (tags) {
      const tagArray = tags.split(',');
      const tagConditions = tagArray.map(() => `p.tags LIKE ?`).join(' OR ');
      countQuery += ` AND (${tagConditions})`;
      tagArray.forEach(tag => countParams.push(`%${tag.trim()}%`));
    }
    
    if (search) {
      countQuery += ` AND (p.photo_name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (date_from) {
      countQuery += ` AND DATE(p.created_at) >= ?`;
      countParams.push(date_from);
    }
    
    if (date_to) {
      countQuery += ` AND DATE(p.created_at) <= ?`;
      countParams.push(date_to);
    }
    
    if (uploaded_by) {
      countQuery += ` AND p.uploaded_by = ?`;
      countParams.push(uploaded_by);
    }
    
    db.query(countQuery, countParams, (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.status(200).json({
        photos,
        filters: {
          tags: tags || null,
          search: search || null,
          date_from: date_from || null,
          date_to: date_to || null,
          uploaded_by: uploaded_by || null,
          sort_by: sortField,
          sort_order: sortOrder
        },
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(countResult[0].total / limit),
          hasNext: parseInt(page) < Math.ceil(countResult[0].total / limit),
          hasPrev: parseInt(page) > 1
        }
      });
    });
  });
};

// -------------------- GET PHOTO BY ID --------------------
exports.getPhotoById = (req, res) => {
  const { photo_id } = req.params;
  const { family_id } = req.user;

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
    
    if (photo.family_id !== family_id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    if (role !== "admin" && photo.uploaded_by !== member_id) {
      return res.status(403).json({ message: "Only admin or the uploader can delete this photo" });
    }
    
    const deleteQuery = `DELETE FROM photos WHERE id = ?`;
    db.query(deleteQuery, [photo_id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (fs.existsSync(photo.file_path)) {
        fs.unlinkSync(photo.file_path);
      }
      
      res.status(200).json({ message: "Photo deleted successfully" });
    });
  });
};

// -------------------- DELETE MULTIPLE PHOTOS --------------------
exports.deleteMultiplePhotos = (req, res) => {
  const { photo_ids } = req.body;
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

  let processed = 0;

  photo_ids.forEach((photo_id) => {
    const photoQuery = `SELECT * FROM photos WHERE id = ?`;
    
    db.query(photoQuery, [photo_id], (err, photos) => {
      if (err || photos.length === 0) {
        results.failed.push({
          photo_id: photo_id,
          error: err ? err.message : "Photo not found"
        });
        processed++;
        checkCompletion();
        return;
      }
      
      const photo = photos[0];
      
      if (photo.family_id !== family_id) {
        results.failed.push({
          photo_id: photo_id,
          error: "Access denied"
        });
        processed++;
        checkCompletion();
        return;
      }
      
      if (role !== "admin" && photo.uploaded_by !== member_id) {
        results.failed.push({
          photo_id: photo_id,
          error: "Only admin or the uploader can delete this photo"
        });
        processed++;
        checkCompletion();
        return;
      }
      
      const deleteQuery = `DELETE FROM photos WHERE id = ?`;
      db.query(deleteQuery, [photo_id], (err) => {
        if (err) {
          results.failed.push({
            photo_id: photo_id,
            error: err.message
          });
        } else {
          if (fs.existsSync(photo.file_path)) {
            fs.unlinkSync(photo.file_path);
          }
          results.successful.push({
            photo_id: photo_id,
            photo_name: photo.photo_name
          });
        }
        processed++;
        checkCompletion();
      });
    });
  });

  function checkCompletion() {
    if (processed === photo_ids.length) {
      res.status(200).json({
        message: `${results.successful.length} photos deleted successfully, ${results.failed.length} failed`,
        successful: results.successful,
        failed: results.failed
      });
    }
  }
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
  const { family_id } = req.user;

  const photoQuery = `SELECT * FROM photos WHERE id = ? AND family_id = ?`;
  
  db.query(photoQuery, [photo_id, family_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
    const memberQuery = `SELECT * FROM family_members WHERE id = ? AND family_id = ?`;
    db.query(memberQuery, [member_id_to_share, family_id], (err, members) => {
      if (err) return res.status(500).json({ error: err.message });
      if (members.length === 0) return res.status(404).json({ message: "Family member not found" });
      
      const checkShareQuery = `SELECT * FROM photo_shares WHERE photo_id = ? AND shared_with = ?`;
      db.query(checkShareQuery, [photo_id, member_id_to_share], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing.length > 0) {
          return res.status(400).json({ message: "Photo already shared with this member" });
        }
        
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
  const { expires_in_hours = 168 } = req.query;

  const photoQuery = `SELECT * FROM photos WHERE id = ? AND family_id = ?`;
  
  db.query(photoQuery, [photo_id, family_id], (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    if (photos.length === 0) return res.status(404).json({ message: "Photo not found" });
    
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
  
  tagArray.forEach((tag) => {
    query += ` AND p.tags LIKE ?`;
    queryParams.push(`%${tag.trim()}%`);
  });
  
  query += ` ORDER BY p.created_at DESC`;
  
  db.query(query, queryParams, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(photos);
  });
};

// -------------------- GET FILTER OPTIONS --------------------
exports.getFilterOptions = (req, res) => {
  const { family_id } = req.user;
  
  const tagsQuery = `
    SELECT DISTINCT tags 
    FROM photos 
    WHERE family_id = ? AND tags IS NOT NULL AND tags != ''
  `;
  
  const membersQuery = `
    SELECT id, first_name, second_name, third_name 
    FROM family_members 
    WHERE family_id = ?
  `;
  
  const dateRangeQuery = `
    SELECT 
      MIN(DATE(created_at)) as earliest_date,
      MAX(DATE(created_at)) as latest_date
    FROM photos 
    WHERE family_id = ?
  `;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(tagsQuery, [family_id], (err, results) => {
        if (err) reject(err);
        else {
          const allTags = [];
          results.forEach(row => {
            if (row.tags) {
              const tags = row.tags.split(',').map(t => t.trim());
              tags.forEach(tag => {
                if (tag && !allTags.includes(tag)) allTags.push(tag);
              });
            }
          });
          resolve(allTags.sort());
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.query(membersQuery, [family_id], (err, results) => {
        if (err) reject(err);
        else {
          const members = results.map(m => ({
            id: m.id,
            name: `${m.first_name} ${m.second_name} ${m.third_name}`.trim()
          }));
          resolve(members);
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.query(dateRangeQuery, [family_id], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || { earliest_date: null, latest_date: null });
      });
    })
  ]).then(([tags, members, dateRange]) => {
    res.status(200).json({
      tags: tags,
      members: members,
      date_range: {
        from: dateRange.earliest_date,
        to: dateRange.latest_date
      }
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
};

// -------------------- GET PHOTOS BY MONTH/YEAR --------------------
exports.getPhotosByMonth = (req, res) => {
  const { family_id } = req.user;
  const { year, month } = req.query;
  
  if (!year) {
    return res.status(400).json({ message: "Year parameter required" });
  }
  
  let query = `
    SELECT p.*, 
           CONCAT(m.first_name, ' ', m.second_name, ' ', m.third_name) AS uploaded_by_name,
           DATE_FORMAT(p.created_at, '%Y-%m') as month_year
    FROM photos p
    JOIN family_members m ON m.id = p.uploaded_by
    WHERE p.family_id = ? AND YEAR(p.created_at) = ?
  `;
  
  const queryParams = [family_id, year];
  
  if (month) {
    query += ` AND MONTH(p.created_at) = ?`;
    queryParams.push(month);
  }
  
  query += ` ORDER BY p.created_at DESC`;
  
  db.query(query, queryParams, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(photos);
  });
};

// -------------------- GET PHOTO STATISTICS --------------------
exports.getPhotoStats = (req, res) => {
  const { family_id } = req.user;
  
  const statsQuery = `
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m') as month,
      COUNT(*) as photos_uploaded,
      SUM(file_size) as total_size_bytes
    FROM photos
    WHERE family_id = ?
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `;
  
  db.query(statsQuery, [family_id], (err, monthlyStats) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const totalSizeQuery = `
      SELECT 
        COUNT(*) as total_photos,
        SUM(file_size) as total_size_bytes,
        COUNT(DISTINCT uploaded_by) as total_contributors
      FROM photos 
      WHERE family_id = ?
    `;
    
    db.query(totalSizeQuery, [family_id], (err, totals) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const summary = totals[0] || { total_photos: 0, total_size_bytes: 0, total_contributors: 0 };
      
      res.status(200).json({
        summary: {
          total_photos: summary.total_photos,
          total_size_bytes: summary.total_size_bytes,
          total_size_mb: ((summary.total_size_bytes || 0) / (1024 * 1024)).toFixed(2),
          total_contributors: summary.total_contributors
        },
        monthly_breakdown: monthlyStats.map(stat => ({
          month: stat.month,
          photos_uploaded: stat.photos_uploaded,
          total_size_mb: ((stat.total_size_bytes || 0) / (1024 * 1024)).toFixed(2)
        }))
      });
    });
  });
};