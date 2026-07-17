const multer      = require("multer");
const streamifier = require("streamifier");
const cloudinary  = require("../utils/cloudinary");

// Keep files in memory — stream directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, PDF, WEBP files are allowed"), false);
  },
});

// Middleware: upload buffer → Cloudinary, attach result to req.cloudinaryResult
upload.uploadToCloudinary = (folder = "dihadii/temp") =>
  async (req, _res, next) => {
    if (!req.file) return next();
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id:     `labour_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            resource_type: "auto",
          },
          (err, res) => { if (err) reject(err); else resolve(res); }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      req.cloudinaryResult = result; // { secure_url, public_id, ... }
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = upload;
