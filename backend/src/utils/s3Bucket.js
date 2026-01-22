const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

/**
 * Fundamentally the logic here is rather simple, a simple post to an s3 where most logic
 * is handled via the library / SDK
 */
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// yay posts to s3
async function uploadToS3(file, objectRefUUID) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: objectRefUUID,
    Body: file.buffer, // If using multer with memoryStorage
    ContentType: file.mimetype,
    // Optional: Add metadata
    Metadata: {
      originalName: file.originalname,
      uploadDate: new Date().toISOString()
    }
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);
    console.log(`File uploaded successfully to ${objectRefUUID}`);
    return response;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

// VERY DANGEROUS -- ONLY FOR POST ARTWORK IF FAILS -- removes potential duplicated data
async function deleteFromS3(objectRefUUID) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: objectRefUUID
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    console.log(`File deleted successfully: ${objectRefUUID}`);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error(`S3 delete failed: ${error.message}`);
  }
}

// Gets a pre-signed URL to view the object (expires after specified time)
async function getS3Url(objectRefUUID, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectRefUUID,
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw new Error(`Failed to generate S3 URL: ${error.message}`);
  }
}

// exports key functions -- vital for post ARTWORK and for verify logic
module.exports = {
  uploadToS3,
  deleteFromS3,
  getS3Url
};