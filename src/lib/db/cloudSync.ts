import { supabaseAdmin } from '../supabase';
import fs from 'fs';

const BUCKET_NAME = 'portal-state';
const FILE_NAME = 'portal.db';

let isPushing = false;

export interface CloudDbMetadata {
  versionTag: string;
  size: number;
}

export async function getCloudDatabaseMetadata(): Promise<CloudDbMetadata | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).list();
    if (error || !data) return null;
    const file = data.find(f => f.name === FILE_NAME);
    if (!file) return null;
    const versionTag = String(file.metadata?.eTag || file.id || file.updated_at || '');
    return {
      versionTag,
      size: (file.metadata?.size as number) || 0
    };
  } catch (err) {
    console.warn('[CLOUD SYNC (getMetadata)]:', err);
    return null;
  }
}

export async function pullDatabaseFromCloud(targetPath: string): Promise<{ success: boolean; versionTag: string | null }> {
  if (!supabaseAdmin) return { success: false, versionTag: null };
  try {
    const meta = await getCloudDatabaseMetadata();
    if (!meta) return { success: false, versionTag: null };

    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(FILE_NAME);
    if (error || !data) {
      return { success: false, versionTag: null };
    }
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate SQLite database header before replacing local file
    if (buffer.length >= 100 && buffer.subarray(0, 16).toString() === 'SQLite format 3\0') {
      const dir = targetPath.substring(0, targetPath.lastIndexOf(/[/\\]/.test(targetPath) ? (targetPath.includes('/') ? '/' : '\\') : ''));
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, buffer);
      return { success: true, versionTag: meta.versionTag };
    } else {
      console.warn('[CLOUD SYNC (pull)]: Cloud file is not a valid SQLite database! Skipped download to prevent database corruption.');
      return { success: false, versionTag: null };
    }
  } catch (err) {
    console.warn('[CLOUD SYNC (pull)]:', err);
  }
  return { success: false, versionTag: null };
}

export async function pushDatabaseToCloud(sourcePath: string): Promise<{ success: boolean; versionTag: string | null }> {
  if (!supabaseAdmin) return { success: false, versionTag: null };
  if (isPushing) return { success: false, versionTag: null };
  isPushing = true;

  try {
    if (!fs.existsSync(sourcePath)) return { success: false, versionTag: null };
    const buffer = fs.readFileSync(sourcePath);
    if (buffer.length < 100 || buffer.subarray(0, 16).toString() !== 'SQLite format 3\0') {
      console.warn('[CLOUD SYNC (push)]: Local file is not a valid SQLite database! Skipping push.');
      return { success: false, versionTag: null };
    }

    const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(FILE_NAME, buffer, {
      upsert: true,
      contentType: 'application/x-sqlite3'
    });

    if (error) {
      console.warn('[CLOUD SYNC (push)]:', error.message);
      return { success: false, versionTag: null };
    }

    // Retrieve fresh metadata to obtain the newly generated eTag
    const meta = await getCloudDatabaseMetadata();
    const versionTag = meta?.versionTag || new Date().toISOString();
    return { success: true, versionTag };
  } catch (err) {
    console.warn('[CLOUD SYNC (push)]:', err);
    return { success: false, versionTag: null };
  } finally {
    isPushing = false;
  }
}
