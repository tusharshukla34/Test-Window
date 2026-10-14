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
    return {
      versionTag: String(file.metadata?.eTag || file.updated_at || file.id || Date.now()),
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
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(FILE_NAME);
    if (error || !data) {
      return { success: false, versionTag: null };
    }
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 0) {
      // Ensure target directory exists
      const dir = targetPath.substring(0, targetPath.lastIndexOf(/[/\\]/.test(targetPath) ? (targetPath.includes('/') ? '/' : '\\') : ''));
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, buffer);
      return { success: true, versionTag: new Date().toISOString() };
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
    if (buffer.length === 0) return { success: false, versionTag: null };

    const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(FILE_NAME, buffer, {
      upsert: true,
      contentType: 'application/x-sqlite3'
    });

    if (error) {
      console.warn('[CLOUD SYNC (push)]:', error.message);
      return { success: false, versionTag: null };
    }

    const versionTag = new Date().toISOString();
    return { success: true, versionTag };
  } catch (err) {
    console.warn('[CLOUD SYNC (push)]:', err);
    return { success: false, versionTag: null };
  } finally {
    isPushing = false;
  }
}
