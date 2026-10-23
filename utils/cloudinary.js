// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    
    // Determine resource type based on file extension
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
    const videoExts = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm'];
    
    let resourceType = 'raw'; // Default for PDFs and docs
    if (imageExts.includes(ext)) resourceType = 'image';
    else if (videoExts.includes(ext)) resourceType = 'video';
    // PDFs, Word docs, Excel files all go under 'raw' 
    // but PDFs use 'image' resource type on Cloudinary to be viewable

    return {
      folder: 'fpu-uploads',
      resource_type: resourceType,
      format: ext,
      public_id: `file-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      access_mode: 'public',       // Force public access
      type: 'upload',              // Standard upload type
      overwrite: true,
    };
  },
});

module.exports = { cloudinary, storage };