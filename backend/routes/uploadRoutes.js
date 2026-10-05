const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: timestamp-random-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Upload single file endpoint
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    // Return the accessible URL path
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
