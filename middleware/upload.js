const multer = require('multer');
const config = require('../config');
const { BadRequestError } = require('../utils/errors');

// Memory storage allows magic byte validation before disk persistence
const storage = multer.memoryStorage();

const uploadMedicalRecord = multer({
  storage,
  limits: {
    fileSize: config.storage.maxRecordSizeBytes || 102400, // 100 KB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only PDF documents are allowed for medical records'));
    }
  },
});

const uploadDoctorPhoto = multer({
  storage,
  limits: {
    fileSize: config.storage.maxPhotoSizeBytes || 5242880, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, or WebP images are allowed for profile photos'));
    }
  },
});

const uploadDoctorVideo = multer({
  storage,
  limits: {
    fileSize: config.storage.maxVideoSizeBytes || 52428800, // 50 MB
  },
  fileFilter: (req, file, cb) => {
    if (['video/mp4', 'video/webm'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only MP4 or WebM videos are allowed for profile videos'));
    }
  },
});

module.exports = {
  uploadMedicalRecord,
  uploadDoctorPhoto,
  uploadDoctorVideo,
};
