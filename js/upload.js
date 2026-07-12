// THE CYANOTYPE NETWORK · upload.js — resize on device, upload to storage
const Upload = {

  // File -> resized JPEG Blob (long edge capped, EXIF orientation respected
  // by createImageBitmap in modern browsers)
  async prepare(file) {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, CONFIG.MAX_IMAGE_PX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", CONFIG.JPEG_QUALITY));
    if (!blob) throw new Error("Couldn't process that image — try a JPEG or PNG.");
    return blob;
  },

  // returns the storage path on success
  async send(file) {
    const blob = await Upload.prepare(file);
    const path = `${DB.uid()}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(CONFIG.BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return path;
  }
};
