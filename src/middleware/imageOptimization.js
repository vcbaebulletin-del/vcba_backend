const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Image optimization middleware
const optimizeImage = async (req, res, next) => {
  // Only process image requests
  if (!req.path.startsWith('/uploads/') || !req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return next();
  }

  try {
    const imagePath = path.join(process.cwd(), 'public', req.path);
    const imageExists = await fs.access(imagePath).then(() => true).catch(() => false);
    
    if (!imageExists) {
      return next();
    }

    // Get query parameters for optimization
    const { w: width, h: height, q: quality = 80, f: format } = req.query;
    
    // If no optimization parameters, serve original
    if (!width && !height && !format && quality == 80) {
      return next();
    }

    // Generate cache key
    const cacheKey = `${req.path}_w${width || 'auto'}_h${height || 'auto'}_q${quality}_f${format || 'auto'}`;
    const cacheDir = path.join(process.cwd(), 'public', 'cache', 'images');
    const cachedImagePath = path.join(cacheDir, `${Buffer.from(cacheKey).toString('base64')}.webp`);

    // Check if cached version exists
    const cachedExists = await fs.access(cachedImagePath).then(() => true).catch(() => false);
    
    if (cachedExists) {
      // Serve cached version
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000', // 1 year
        'ETag': `"${cacheKey}"`,
        'Vary': 'Accept'
      });
      
      const cachedImage = await fs.readFile(cachedImagePath);
      return res.send(cachedImage);
    }

    // Create cache directory if it doesn't exist
    await fs.mkdir(cacheDir, { recursive: true });

    // Process image with Sharp
    let sharpInstance = sharp(imagePath);
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Apply transformations
    if (width || height) {
      const resizeOptions = {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        fit: 'inside',
        withoutEnlargement: true
      };
      sharpInstance = sharpInstance.resize(resizeOptions);
    }

    // Set quality and format
    const outputFormat = format || 'webp';
    const outputQuality = Math.min(Math.max(parseInt(quality), 10), 100);

    switch (outputFormat.toLowerCase()) {
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: outputQuality });
        break;
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality: outputQuality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality: outputQuality });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality: outputQuality });
    }

    // Generate optimized image
    const optimizedBuffer = await sharpInstance.toBuffer();
    
    // Cache the optimized image
    await fs.writeFile(cachedImagePath, optimizedBuffer);

    // Set response headers
    res.set({
      'Content-Type': `image/${outputFormat}`,
      'Content-Length': optimizedBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': `"${cacheKey}"`,
      'Vary': 'Accept'
    });

    // Send optimized image
    res.send(optimizedBuffer);

  } catch (error) {
    console.error('Image optimization error:', error);
    // Fall back to serving original image
    next();
  }
};

// Middleware to add cache headers for static images
const addImageCacheHeaders = (req, res, next) => {
  if (req.path.startsWith('/uploads/') && req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'Vary': 'Accept-Encoding'
    });
  }
  next();
};

// Preload critical images
const preloadCriticalImages = async () => {
  try {
    console.log('🔧 Preloading critical images...');
    
    // Define critical images that should be optimized and cached
    const criticalImages = [
      '/villamor-image/villamor-collge-BG-landscape.jpg',
      '/uploads/welcome/vcba_adv_1.jpg',
      '/uploads/welcome/vcba_adv_2.jpg',
      '/uploads/carousel/vcba_adv_4.jpg',
      '/uploads/carousel/vcba_adv_5.jpg'
    ];

    const optimizationSizes = [
      { w: 1920, h: 1080, q: 80 }, // Desktop
      { w: 1200, h: 800, q: 80 },  // Tablet
      { w: 768, h: 512, q: 80 },   // Mobile
      { w: 400, h: 300, q: 70 }    // Thumbnail
    ];

    for (const imagePath of criticalImages) {
      const fullPath = path.join(process.cwd(), 'public', imagePath);
      const imageExists = await fs.access(fullPath).then(() => true).catch(() => false);
      
      if (imageExists) {
        for (const size of optimizationSizes) {
          try {
            const cacheKey = `${imagePath}_w${size.w}_h${size.h}_q${size.q}_fwebp`;
            const cacheDir = path.join(process.cwd(), 'public', 'cache', 'images');
            const cachedImagePath = path.join(cacheDir, `${Buffer.from(cacheKey).toString('base64')}.webp`);
            
            // Skip if already cached
            const cachedExists = await fs.access(cachedImagePath).then(() => true).catch(() => false);
            if (cachedExists) continue;

            // Create cache directory
            await fs.mkdir(cacheDir, { recursive: true });

            // Optimize and cache
            const optimizedBuffer = await sharp(fullPath)
              .resize({
                width: size.w,
                height: size.h,
                fit: 'inside',
                withoutEnlargement: true
              })
              .webp({ quality: size.q })
              .toBuffer();

            await fs.writeFile(cachedImagePath, optimizedBuffer);
            console.log(`✅ Preloaded: ${imagePath} (${size.w}x${size.h})`);
          } catch (error) {
            console.warn(`⚠️ Failed to preload ${imagePath}:`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Critical images preloaded');
  } catch (error) {
    console.error('❌ Error preloading critical images:', error);
  }
};

// Clean old cache files (run periodically)
const cleanImageCache = async (maxAge = 30 * 24 * 60 * 60 * 1000) => { // 30 days
  try {
    const cacheDir = path.join(process.cwd(), 'public', 'cache', 'images');
    const cacheDirExists = await fs.access(cacheDir).then(() => true).catch(() => false);
    
    if (!cacheDirExists) return;

    const files = await fs.readdir(cacheDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} old cached images`);
    }
  } catch (error) {
    console.error('❌ Error cleaning image cache:', error);
  }
};

module.exports = {
  optimizeImage,
  addImageCacheHeaders,
  preloadCriticalImages,
  cleanImageCache
};
