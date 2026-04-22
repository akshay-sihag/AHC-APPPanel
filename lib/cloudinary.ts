/**
 * Cloudinary Image Upload Utility
 * 
 * Simple, reliable cloud image storage that works in all environments.
 * 
 * Setup:
 * 1. Create a free Cloudinary account at https://cloudinary.com
 * 2. Get your Cloud Name, API Key, and API Secret from the dashboard
 * 3. Add to .env:
 *    CLOUDINARY_CLOUD_NAME=your_cloud_name
 *    CLOUDINARY_API_KEY=your_api_key
 *    CLOUDINARY_API_SECRET=your_api_secret
 */

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

interface CloudinaryError {
  message: string;
  http_code?: number;
}

/**
 * Upload an image buffer to Cloudinary
 * 
 * @param buffer - Image file buffer
 * @param filename - Original filename (used for public_id)
 * @param folder - Folder path in Cloudinary (e.g., 'blog/image', 'medicine/images')
 * @returns Cloudinary upload result with secure_url
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env'
    );
  }

  // Create a unique public_id from filename (without extension)
  const publicId = `${folder}/${filename.replace(/\.[^/.]+$/, '')}`;

  // Convert buffer to base64 data URI
  const base64 = buffer.toString('base64');
  const dataUri = `data:image/auto;base64,${base64}`;

  // Generate signature for authenticated upload
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  
  // Create SHA-1 signature
  const crypto = await import('crypto');
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  // Prepare form data for upload
  const formData = new FormData();
  formData.append('file', dataUri);
  formData.append('public_id', publicId);
  formData.append('folder', folder);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  // Upload to Cloudinary
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as CloudinaryError;
    throw new Error(
      `Cloudinary upload failed: ${errorData.message || response.statusText}`
    );
  }

  const result = await response.json() as CloudinaryUploadResult;
  return result;
}

/**
 * Delete an image from Cloudinary
 * 
 * @param publicId - The public_id of the image to delete
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary credentials not configured, skipping delete');
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  
  const crypto = await import('crypto');
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const deleteUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
  
  const response = await fetch(deleteUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    console.error('Failed to delete image from Cloudinary:', publicId);
  }
}

/**
 * Extract public_id from a Cloudinary URL for deletion
 * 
 * @param url - Cloudinary URL
 * @returns public_id or null if not a Cloudinary URL
 */
export function getPublicIdFromUrl(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }
  
  try {
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{filename}.{ext}
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

