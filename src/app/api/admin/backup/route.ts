import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { dbService, ensureCloudSyncReady } from '@/lib/db/database';
import {
  pingGoogleSheet,
  syncFullDatabaseBackup,
  syncAllAttemptsForExam
} from '@/lib/services/googleSheets';

export async function GET() {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();

    const webhookUrl = dbService.getGoogleSheetWebhookUrl();
    const lastSync = dbService.getSetting('google_sheet_last_sync');

    return NextResponse.json({
      configured: Boolean(webhookUrl),
      webhookUrl: webhookUrl || '',
      lastSync: lastSync || null
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch backup settings';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureCloudSyncReady();

    const body = await req.json();
    const { action } = body;

    // 1. Save Webhook URL
    if (action === 'save_url') {
      const { webhook_url } = body;
      dbService.setSetting('google_sheet_webhook_url', (webhook_url || '').trim());
      return NextResponse.json({
        success: true,
        message: 'Google Sheet Webhook URL saved successfully'
      });
    }

    // 2. Test Connection (Ping)
    if (action === 'test_connection') {
      const { webhook_url } = body;
      const targetUrl = webhook_url || dbService.getGoogleSheetWebhookUrl();
      if (!targetUrl) {
        return NextResponse.json({ error: 'Please enter a Google Apps Script Webhook URL first.' }, { status: 400 });
      }

      const res = await pingGoogleSheet(targetUrl);
      if (res.success) {
        return NextResponse.json({
          success: true,
          message: res.message || 'Connected to Google Sheet successfully!'
        });
      } else {
        return NextResponse.json({
          error: res.message || 'Failed to connect to Google Sheet. Check your Webhook deployment permissions.'
        }, { status: 400 });
      }
    }

    // 3. Full Database Backup
    if (action === 'sync_all') {
      const res = await syncFullDatabaseBackup();
      if (res.success) {
        const now = new Date().toISOString();
        dbService.setSetting('google_sheet_last_sync', now);
        return NextResponse.json({
          success: true,
          message: 'All Batches, Students, Assignments, and Exams have been backed up to Google Sheets!',
          lastSync: now
        });
      } else {
        return NextResponse.json({ error: res.message || 'Backup failed.' }, { status: 500 });
      }
    }

    // 4. Dedicated Exam Sheet Sync
    if (action === 'sync_exam') {
      const { exam_id } = body;
      if (!exam_id) {
        return NextResponse.json({ error: 'exam_id is required' }, { status: 400 });
      }

      const res = await syncAllAttemptsForExam(exam_id);
      return NextResponse.json({
        success: true,
        message: `Created/updated sheet tab "Exam - ${res.exam_title}" with ${res.count} student result rows!`,
        syncedCount: res.count
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Backup operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
