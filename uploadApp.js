/**
 * TinyMCE image upload + static serving for article images.
 * POST /api/upload-image → { location: "/uploads/articles/..." }
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function createUploadApp(rootDir) {
  const publicUploadsRoot = path.join(rootDir, 'public', 'uploads');
  const articleUploadsDir = path.join(publicUploadsRoot, 'articles');
  fs.mkdirSync(articleUploadsDir, { recursive: true });

  // Mirror path under ./uploads for nginx volume mounts that map ./uploads → /uploads
  const nginxMirrorDir = path.join(rootDir, 'uploads', 'articles');
  fs.mkdirSync(nginxMirrorDir, { recursive: true });

  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, articleUploadsDir);
    },
    filename(_req, file, cb) {
      const mime = String(file.mimetype || '').toLowerCase();
      const fromName = path.extname(file.originalname || '').toLowerCase();
      const ext =
        EXT_BY_MIME[mime] ||
        (/\.(jpe?g|png|webp|gif)$/i.test(fromName) ? fromName : '.jpg');
      const safeBase = String(file.originalname || 'image')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';
      cb(null, `${safeBase}-${Date.now()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
      const mime = String(file.mimetype || '').toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        cb(new Error('Only jpeg, png, webp, and gif images are allowed'));
        return;
      }
      cb(null, true);
    },
  });

  const app = express();

  // Serve public/uploads at /uploads (TinyMCE + HTML <img> paths)
  app.use('/uploads', express.static(publicUploadsRoot, {
    fallthrough: true,
    maxAge: '365d',
    etag: true,
  }));

  // Also serve legacy ./uploads for older admin uploads
  app.use('/uploads', express.static(path.join(rootDir, 'uploads'), {
    fallthrough: true,
    maxAge: '365d',
  }));

  function handleUpload(req, res) {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Image too large (max 5 MB)'
            : err.message || 'Upload failed';
        res.status(400).json({ error: msg });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message || 'Upload failed' });
        return;
      }
      if (!req.file || !req.file.filename) {
        res.status(400).json({ error: 'No image file received (field name: file)' });
        return;
      }

      // Mirror into ./uploads/articles for nginx static mount
      try {
        const src = req.file.path;
        const dest = path.join(nginxMirrorDir, req.file.filename);
        if (src !== dest) fs.copyFileSync(src, dest);
      } catch (copyErr) {
        console.warn('[upload] nginx mirror copy failed:', copyErr.message);
      }

      const location = `/uploads/articles/${req.file.filename}`;
      res.status(200).json({ location });
    });
  }

  // TinyMCE default field is "file"; also accept "image" for flexibility
  app.post('/api/upload-image', (req, res) => {
    // Peek content-type; multer reads the stream
    handleUpload(req, res);
  });

  app.use((err, _req, res, _next) => {
    console.error('[upload]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal upload error' });
    }
  });

  return app;
}

module.exports = { createUploadApp };
