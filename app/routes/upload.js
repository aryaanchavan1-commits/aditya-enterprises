const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { dataDir } = require('../db');

const uploadsDir = path.join(dataDir, 'uploads');
const aiUploadsDir = path.join(dataDir, 'ai_uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(aiUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.path.includes('ai-upload')) cb(null, aiUploadsDir);
    else cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImages = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const allowedDocs = ['.pdf', '.csv', '.xlsx', '.xls', '.txt', '.json', '.xml', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (req.path.includes('ai-upload')) {
      if ([...allowedImages, ...allowedDocs].includes(ext)) cb(null, true);
      else cb(new Error('File type not supported for AI upload'));
    } else {
      if (allowedImages.includes(ext)) cb(null, true);
      else cb(new Error('Only image files are allowed for product images'));
    }
  }
});

// Upload product image
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    
    const filename = req.file.filename;
    const filePath = path.join(uploadsDir, filename);
    
    // Create thumbnail
    const thumbName = `thumb_${filename}`;
    const thumbPath = path.join(uploadsDir, thumbName);
    await sharp(filePath).resize(300, 300, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(thumbPath);

    res.json({
      success: true,
      data: {
        original: `/data/uploads/${filename}`,
        thumbnail: `/data/uploads/${thumbName}`,
        filename
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload multiple images
router.post('/images', upload.array('images', 10), async (req, res) => {
  try {
    const files = [];
    for (const file of req.files) {
      const filePath = path.join(uploadsDir, file.filename);
      const thumbName = `thumb_${file.filename}`;
      const thumbPath = path.join(uploadsDir, thumbName);
      await sharp(filePath).resize(300, 300, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(thumbPath);
      files.push({ original: `/data/uploads/${file.filename}`, thumbnail: `/data/uploads/${thumbName}`, filename: file.filename });
    }
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI file upload
router.post('/ai-upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        path: `/data/ai_uploads/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
