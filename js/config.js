// THE CYANOTYPE NETWORK · config.js
// Fill these in from your Supabase project: Settings → API.
// The anon key is PUBLIC by design — security lives in the RLS policies.
const CONFIG = {
  SUPABASE_URL: "https://skhxenqfmatjjuldyrqj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Vy3t5e3HNHP48pzOt3J4JA_BVr9iJH0",
  BUCKET: "prints",
  MAX_IMAGE_PX: 1600,      // client-side resize ceiling (long edge)
  JPEG_QUALITY: 0.85,
  SIGNED_URL_TTL: 3600     // seconds
};
