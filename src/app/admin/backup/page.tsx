'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  Database,
  ExternalLink,
  ShieldCheck,
  Zap,
  Code2,
  Table
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/ui/ClayComponents';
import { Exam } from '@/lib/db/types';

export default function AdminBackupPage() {
  const router = useRouter();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [sheetTitle, setSheetTitle] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Operations state
  const [savingUrl, setSavingUrl] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [backingUpAll, setBackingUpAll] = useState(false);
  const [syncingExam, setSyncingExam] = useState(false);

  // Status banners
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Exams list for dedicated exam sheet sync
  const [exams, setExams] = useState<(Exam & { attempt_count?: number })[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Copy code state
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [resStatus, resExams] = await Promise.all([
        fetch('/api/admin/backup'),
        fetch('/api/admin/exams')
      ]);

      if (resStatus.status === 401 || resStatus.status === 403) {
        router.push('/login');
        return;
      }

      const statusData = await resStatus.json();
      const examsData = await resExams.json();

      if (statusData) {
        setIsConfigured(Boolean(statusData.configured));
        setWebhookUrl(statusData.webhookUrl || '');
        setSpreadsheetUrl(statusData.spreadsheetUrl || null);
        setSheetTitle(statusData.sheetTitle || null);
        setLastSync(statusData.lastSync || null);
      }

      if (Array.isArray(examsData)) {
        setExams(examsData);
        if (examsData.length > 0 && !selectedExamId) {
          setSelectedExamId(examsData[0].id);
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google Apps Script Webhook URL.' });
      return;
    }

    setSavingUrl(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_url', webhook_url: webhookUrl.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setIsConfigured(true);
        setStatusMessage({ type: 'success', text: data.message || 'Webhook URL saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save URL' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error connecting to server' });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Enter your Google Apps Script Webhook URL first.' });
      return;
    }

    setTestingConnection(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection', webhook_url: webhookUrl.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setIsConfigured(true);
        if (data.sheet_url) setSpreadsheetUrl(data.sheet_url);
        if (data.sheet_title) setSheetTitle(data.sheet_title);
        setStatusMessage({ type: 'success', text: `🟢 Verified! ${data.message}` });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Connection failed' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Connection timed out or failed to reach Google Sheet' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFullBackup = async () => {
    setBackingUpAll(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all' })
      });

      const data = await res.json();
      if (res.ok) {
        setLastSync(data.lastSync || new Date().toISOString());
        setStatusMessage({
          type: 'success',
          text: '🎉 Full Database Backup Completed! All tables (Batches, Students, Assignments, Exams) are now synced in your Google Sheet.'
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Backup failed' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error executing full backup' });
    } finally {
      setBackingUpAll(false);
    }
  };

  const handleSyncExam = async () => {
    if (!selectedExamId) {
      setStatusMessage({ type: 'error', text: 'Please select an exam to sync.' });
      return;
    }

    setSyncingExam(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_exam', exam_id: selectedExamId })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `📄 Dedicated Exam Sheet Synced! ${data.message}`
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to sync exam sheet' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error syncing exam sheet' });
    } finally {
      setSyncingExam(false);
    }
  };

  const appsScriptCode = `function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheetUrl = ss.getUrl();
    var sheetTitle = ss.getName();

    // 1. Dedicated Exam Sheet Creation & Result Record
    if (action === "record_exam_result") {
      var examTitle = data.exam_title || "Exam";
      var safeSheetName = ("Exam - " + examTitle).substring(0, 100);
      var sheet = ss.getSheetByName(safeSheetName);

      if (!sheet) {
        sheet = ss.insertSheet(safeSheetName);
        var headers = [
          "Student ID",
          "Student Name",
          "Email",
          "Batch",
          "Score Obtained",
          "Max Marks",
          "Percentage (%)",
          "Accuracy (%)",
          "Correct Answers",
          "Incorrect Answers",
          "Unattempted",
          "Time Spent (Mins)",
          "Submission Time",
          "Evaluation Status"
        ];
        sheet.appendRow(headers);
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#4338ca"); // Indigo
        headerRange.setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }

      var studentId = String(data.student_id || data.student_id_code || "");
      var dataRange = sheet.getDataRange().getValues();
      var rowIndex = -1;
      for (var r = 1; r < dataRange.length; r++) {
        if (String(dataRange[r][0]) === studentId && studentId !== "") {
          rowIndex = r + 1;
          break;
        }
      }

      var rowValues = [
        studentId,
        data.student_name || "",
        data.student_email || "",
        data.batch_name || "",
        data.score !== undefined ? data.score : 0,
        data.max_marks || 0,
        data.percentage !== undefined ? data.percentage + "%" : "0%",
        data.accuracy !== undefined ? data.accuracy + "%" : "0%",
        data.total_correct || 0,
        data.total_incorrect || 0,
        data.total_unattempted || 0,
        data.time_spent_mins || 0,
        data.submitted_at || new Date().toLocaleString(),
        data.evaluation_status || "Completed"
      ];

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "exam_result_recorded", sheet: safeSheetName, sheet_url: sheetUrl, sheet_title: sheetTitle }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Generic Event Sync (Batches, Students, Assignments, Submissions)
    if (action === "sync_event") {
      var targetSheetName = data.sheet_name || "Activity_Log";
      var targetSheet = ss.getSheetByName(targetSheetName);

      if (!targetSheet) {
        targetSheet = ss.insertSheet(targetSheetName);
        if (data.headers && data.headers.length > 0) {
          targetSheet.appendRow(data.headers);
          var hRange = targetSheet.getRange(1, 1, 1, data.headers.length);
          hRange.setFontWeight("bold");
          hRange.setBackground("#1e293b"); // Slate 800
          hRange.setFontColor("#ffffff");
          targetSheet.setFrozenRows(1);
        }
      }

      if (data.row) {
        targetSheet.appendRow(data.row);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", sheet: targetSheetName, sheet_url: sheetUrl, sheet_title: sheetTitle }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Full Bulk Backup Sync
    if (action === "full_backup") {
      var datasets = data.datasets || {};
      for (var tab in datasets) {
        var tabInfo = datasets[tab];
        var s = ss.getSheetByName(tab);
        if (s) {
          s.clear();
        } else {
          s = ss.insertSheet(tab);
        }

        if (tabInfo.headers && tabInfo.headers.length > 0) {
          s.appendRow(tabInfo.headers);
          var range = s.getRange(1, 1, 1, tabInfo.headers.length);
          range.setFontWeight("bold");
          range.setBackground("#312e81");
          range.setFontColor("#ffffff");
          s.setFrozenRows(1);
        }

        if (tabInfo.rows && tabInfo.rows.length > 0) {
          s.getRange(2, 1, tabInfo.rows.length, tabInfo.rows[0].length).setValues(tabInfo.rows);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Full backup completed", sheet_url: sheetUrl, sheet_title: sheetTitle }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Ping / Test
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Google Sheet Webhook Active & Connected!", title: sheetTitle, sheet_url: sheetUrl, sheet_title: sheetTitle }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Send Email Notifications (Only for Task Assignment & Exam Scheduling)
    if (action === "send_email_notification") {
      var recipients = data.recipients || [];
      var subject = data.subject || "Academic Portal Notification";
      var htmlBody = data.html_body || "";
      var sentCount = 0;

      for (var i = 0; i < recipients.length; i++) {
        var toEmail = typeof recipients[i] === 'string' ? recipients[i] : (recipients[i].email || "");
        toEmail = toEmail.trim();
        if (toEmail && toEmail.indexOf("@") > 0) {
          try {
            MailApp.sendEmail({
              to: toEmail,
              subject: subject,
              htmlBody: htmlBody
            });
            sentCount++;
          } catch (mailErr) {
            Logger.log("Failed to send email to " + toEmail + ": " + mailErr);
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        type: "emails_sent",
        count: sentCount,
        sheet_url: sheetUrl,
        sheet_title: sheetTitle
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Cloud size={15} /> Real-Time Cloud Persistence
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight break-words">
            Google Sheets Auto-Backup & Exam Syncer
          </h1>
          <p className="text-emerald-200 text-xs sm:text-sm mt-1 max-w-xl">
            Automatically backup all batches, student registrations, and daily homework in real-time, plus create dedicated sheet tabs for every examination taken.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-white text-emerald-950 hover:bg-emerald-50 shadow-md inline-flex items-center gap-2 transition"
            >
              <ExternalLink size={15} className="text-emerald-700" /> Open Live Google Sheet
            </a>
          )}
          <div className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${
            isConfigured
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
              : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {isConfigured ? 'Real-Time Sync Active' : 'Webhook Not Configured'}
          </div>
        </div>
      </div>

      {/* Connected Sheet Card with Direct Link */}
      {spreadsheetUrl && (
        <ClayCard className="p-4 bg-emerald-50/90 border border-emerald-200 shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                  Connected Google Spreadsheet
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {sheetTitle || 'Cybrom Portal – Live Backup & Exam Results'}
                </h4>
              </div>
            </div>
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs inline-flex items-center gap-2 shrink-0 transition"
            >
              <ExternalLink size={15} /> Open Spreadsheet in New Tab
            </a>
          </div>
        </ClayCard>
      )}

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border shadow-xs animate-in fade-in ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <p className="text-xs sm:text-sm font-semibold">{statusMessage.text}</p>
        </div>
      )}

      {/* Main Grid: Webhook Configuration + Exam Sync + Full Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Configuration & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Webhook Connection Setup */}
          <ClayCard className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Zap size={18} className="text-indigo-600" /> Google Apps Script Webhook URL
              </h3>
              {lastSync && (
                <span className="text-[11px] font-mono text-slate-400">
                  Last Sync: {new Date(lastSync).toLocaleTimeString()}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Deployment Web App URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="clay-input w-full p-3 text-xs font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Obtained from your Google Sheet by clicking <b>Deploy</b> ➔ <b>New deployment</b> ➔ <b>Web App</b>.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <ClayButton
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={savingUrl}
                  className="font-bold text-xs shadow-md"
                >
                  {savingUrl ? 'Saving...' : 'Save Webhook URL'}
                </ClayButton>

                <ClayButton
                  variant="outline"
                  size="md"
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !webhookUrl}
                  className="font-bold text-xs"
                >
                  {testingConnection ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </ClayButton>
              </div>
            </form>
          </ClayCard>

          {/* Card 2: Dedicated Exam Sheet Creator (Specific User Request) */}
          <ClayCard className="p-5 border-l-4 border-l-indigo-600">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-indigo-600" /> Dedicated Exam Results Sheet Tab
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Creates a dedicated tab (e.g. <b>Exam - Python Mid-Term</b>) in your Google Sheet with all student scores, accuracy, and answers.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Select Exam to Create / Sync Sheet Tab
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="clay-input w-full p-2.5 text-xs font-semibold"
                >
                  {exams.length === 0 ? (
                    <option value="">No published exams found</option>
                  ) : (
                    exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} • {ex.duration_minutes} Mins • Max {ex.max_marks} Marks ({ex.attempt_count || 0} student attempts)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  <span>
                    <b>Real-time trigger:</b> When students finish an exam, their score is automatically saved to this dedicated tab.
                  </span>
                </div>

                <ClayButton
                  variant="teal"
                  size="md"
                  type="button"
                  onClick={handleSyncExam}
                  disabled={syncingExam || !isConfigured || exams.length === 0}
                  className="font-bold text-xs shadow-md"
                >
                  {syncingExam ? <RefreshCw size={14} className="animate-spin" /> : <Table size={15} />}
                  {syncingExam ? 'Syncing Sheet Tab...' : 'Create / Sync Exam Tab Now'}
                </ClayButton>
              </div>
            </div>
          </ClayCard>

          {/* Card 3: Full Database Bulk Backup */}
          <ClayCard className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Database size={18} className="text-emerald-600" /> 1-Click Full Database Backup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exports your entire database into separate tabs: <b>Batches</b>, <b>Students</b>, <b>Assignments</b>, and <b>Exams</b>.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">Complete Historical Sync</p>
                <p className="text-[11px] text-slate-400">
                  Ideal for backing up past data or refreshing all sheets at once.
                </p>
              </div>

              <ClayButton
                variant="primary"
                size="md"
                onClick={handleFullBackup}
                disabled={backingUpAll || !isConfigured}
                className="font-bold text-xs shadow-md shrink-0"
              >
                {backingUpAll ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={15} />}
                {backingUpAll ? 'Backing Up Entire Database...' : 'Backup Entire Database Now'}
              </ClayButton>
            </div>
          </ClayCard>
        </div>

        {/* Right Col: Setup Instructions & Copyable Google Apps Script */}
        <div className="space-y-6">
          <ClayCard className="p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Code2 size={18} className="text-indigo-400" /> 2-Minute Google Sheet Setup
              </h3>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 font-semibold"
              >
                Open Google Sheets <ExternalLink size={12} />
              </a>
            </div>

            {/* Steps List */}
            <ol className="space-y-3 text-xs text-indigo-100">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <div>
                  <p className="font-bold text-white">Create a blank Google Sheet</p>
                  <p className="text-[11px] text-indigo-300">Open <a href="https://sheets.new" target="_blank" className="underline font-mono">sheets.new</a> and name your spreadsheet.</p>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <div>
                  <p className="font-bold text-white">Open Apps Script</p>
                  <p className="text-[11px] text-indigo-300">In the Google Sheet menu, click <b>Extensions</b> ➔ <b>Apps Script</b>.</p>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <div>
                  <p className="font-bold text-white">Paste the Webhook Code</p>
                  <p className="text-[11px] text-indigo-300">Replace any code with the script below and click Save.</p>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                <div>
                  <p className="font-bold text-white">Deploy as Web App</p>
                  <p className="text-[11px] text-indigo-300">
                    Click <b>Deploy</b> ➔ <b>New deployment</b> ➔ Select <b>Web app</b>. Set <b>"Who has access"</b> to <b>Anyone</b>, copy the URL, and paste it into the Webhook URL box on the left.
                  </p>
                </div>
              </li>
            </ol>

            {/* Script Box with Copy Button */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Google Apps Script Code</span>
                <button
                  type="button"
                  onClick={copyScriptToClipboard}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition"
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  {copiedCode ? 'Copied to Clipboard!' : 'Copy Script'}
                </button>
              </div>

              <div className="bg-black/50 rounded-xl p-3 max-h-48 overflow-y-auto text-[10px] font-mono text-emerald-300 border border-white/5">
                <pre>{appsScriptCode}</pre>
              </div>
            </div>
          </ClayCard>
        </div>
      </div>
    </div>
  );
}
