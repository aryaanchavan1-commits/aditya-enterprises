const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { dataDir } = require('../db');
const { uploadImage } = require('../storage');

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
      else cb(new Error('Only image files are allowed'));
    }
  }
});

async function processAndUpload(filePath, filename) {
  const thumbName = `thumb_${filename}`;
  const thumbPath = path.join(uploadsDir, thumbName);
  try {
    const thumbBuffer = await sharp(filePath).resize(300, 300, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    fs.writeFileSync(thumbPath, thumbBuffer);

    const result = await uploadImage('uploads', fs.readFileSync(filePath), filename);
    await uploadImage('uploads', thumbBuffer, thumbName);

    return { original: result.url, thumbnail: `/data/uploads/${thumbName}`, filename };
  } catch (e) {
    return { original: `/data/uploads/${filename}`, thumbnail: `/data/uploads/${thumbName}`, filename };
  }
}

router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) res.json({ success: false, error: 'No file uploaded' }); return;
    const result = await processAndUpload(req.file.path, req.file.filename);
    res.json({ success: true, data: result });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/images', upload.array('images', 10), async (req, res) => {
  try {
    const files = [];
    for (const file of req.files) {
      const result = await processAndUpload(file.path, file.filename);
      files.push(result);
    }
    res.json({ success: true, data: files });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/ai-upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) res.json({ success: false, error: 'No file uploaded' }); return;
    res.json({ success: true, data: { filename: req.file.originalname, path: `/data/ai_uploads/${req.file.filename}`, type: req.file.mimetype, size: req.file.size } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
