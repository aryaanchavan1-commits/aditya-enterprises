require('dotenv').config();
const fs = require('fs');
const path = require('path');

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (e) {
    console.warn('Supabase client creation failed:', e.message);
    return null;
  }
}

async function uploadFile(bucket, filePath, buffer, contentType) {
  const supabase = getSupabase();
  if (supabase) {
    const fileName = path.basename(filePath);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return { success: true, url: urlData.publicUrl, fileName };
    }
    console.warn('Supabase upload failed:', error.message);
  }
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const dir = path.join(DATA_DIR, bucket);
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, path.basename(filePath));
  fs.writeFileSync(destPath, buffer);
  return { success: true, url: `/data/${bucket}/${path.basename(filePath)}`, fileName: path.basename(filePath) };
}

async function uploadImage(bucket, buffer, fileName) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return { success: true, url: urlData.publicUrl, fileName };
    }
  }
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const dir = path.join(DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, fileName);
  fs.writeFileSync(destPath, buffer);
  return { success: true, url: `/data/uploads/${fileName}`, fileName };
}

async function deleteFile(bucket, fileName) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.storage.from(bucket).remove([fileName]);
    if (!error) return { success: true };
  }
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const filePath = path.join(DATA_DIR, bucket, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return { success: true };
}

module.exports = { uploadFile, uploadImage, deleteFile, getSupabase };
