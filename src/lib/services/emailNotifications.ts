import { postToGoogleSheet } from './googleSheets';

export interface StudentRecipient {
  name: string;
  email: string;
  student_id?: string | null;
}

export interface TaskEmailPayload {
  title: string;
  subject: string;
  instructions: string;
  deadline: string;
  maxScore?: number;
  batchNames: string[];
  recipients: StudentRecipient[];
}

export interface ExamEmailPayload {
  title: string;
  description?: string;
  durationMinutes: number;
  totalQuestions?: number;
  negativeMarking?: number;
  batchNames: string[];
  recipients: StudentRecipient[];
}

/**
 * Builds a clean, responsive HTML email template for academic notices
 */
function buildHtmlEmail({
  badgeText,
  badgeBg,
  heading,
  studentName,
  detailsHtml,
  ctaText,
  ctaUrl,
  note
}: {
  badgeText: string;
  badgeBg: string;
  heading: string;
  studentName?: string;
  detailsHtml: string;
  ctaText: string;
  ctaUrl: string;
  note?: string;
}): string {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://test-window.vercel.app';
  const fullCtaUrl = ctaUrl.startsWith('http') ? ctaUrl : `${portalUrl}${ctaUrl}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #0d9488 100%); padding: 32px 28px; text-align: left;">
              <span style="display: inline-block; padding: 4px 12px; background-color: ${badgeBg}; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-radius: 9999px; margin-bottom: 12px;">
                ${badgeText}
              </span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; line-height: 1.3;">
                ${heading}
              </h1>
              <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 13px;">
                Tushar Shukla • Academic Workspace
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">
              ${studentName ? `<p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #0f172a;">Hello ${studentName},</p>` : ''}
              
              <!-- Details Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 22px;">
                ${detailsHtml}
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0 18px 0;">
                <a href="${fullCtaUrl}" style="display: inline-block; background-color: #0d9488; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);">
                  ${ctaText} →
                </a>
              </div>

              ${note ? `<p style="margin: 18px 0 0 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">${note}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600;">
                Tushar Shukla Academic Portal • Real-Time Notification System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 1. Send Task / Daily Homework Assignment Email Notification
 * Only triggers when a trainer creates & assigns a task to batches.
 */
export async function sendTaskAssignedEmail(payload: TaskEmailPayload): Promise<{ success: boolean; count: number }> {
  try {
    const validRecipients = payload.recipients.filter(r => r.email && r.email.includes('@'));
    if (validRecipients.length === 0) {
      return { success: false, count: 0 };
    }

    const detailsHtml = `
      <div style="margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Assignment Title</span>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${payload.title}</div>
      </div>
      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div style="margin-right: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Subject</span>
          <div style="font-size: 13px; font-weight: 700; color: #0d9488;">${payload.subject}</div>
        </div>
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Submission Deadline</span>
          <div style="font-size: 13px; font-weight: 700; color: #e11d48;">${new Date(payload.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Assigned Batch(es)</span>
        <div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 2px;">${payload.batchNames.join(', ')}</div>
      </div>
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Instructions</span>
        <p style="font-size: 13px; color: #334155; margin: 4px 0 0 0; line-height: 1.4; white-space: pre-wrap;">${payload.instructions.slice(0, 300)}${payload.instructions.length > 300 ? '...' : ''}</p>
      </div>
    `;

    const htmlBody = buildHtmlEmail({
      badgeText: 'New Task Assigned',
      badgeBg: '#0d9488',
      heading: `Homework: ${payload.title}`,
      detailsHtml,
      ctaText: 'Open Assignment Workspace',
      ctaUrl: '/student/assignments',
      note: 'Please submit your solution before the specified deadline to receive evaluation marks and feedback.'
    });

    const emailList = validRecipients.map(r => r.email);

    // Run non-blocking through Google Apps Script webhook
    postToGoogleSheet({
      action: 'send_email_notification',
      notification_type: 'task',
      subject: `New Homework Assigned: ${payload.title}`,
      recipients: emailList,
      html_body: htmlBody
    }).catch(err => {
      console.warn('[EmailNotification] Task email error:', err);
    });

    return { success: true, count: validRecipients.length };
  } catch (err) {
    console.warn('[EmailNotification] Failed to send task email:', err);
    return { success: false, count: 0 };
  }
}

/**
 * 2. Send Online Examination Scheduled Email Notification
 * Only triggers when a trainer creates & schedules an exam for batches.
 */
export async function sendExamScheduledEmail(payload: ExamEmailPayload): Promise<{ success: boolean; count: number }> {
  try {
    const validRecipients = payload.recipients.filter(r => r.email && r.email.includes('@'));
    if (validRecipients.length === 0) {
      return { success: false, count: 0 };
    }

    const detailsHtml = `
      <div style="margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Exam Title</span>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${payload.title}</div>
      </div>
      <div style="display: flex; gap: 20px; margin-bottom: 12px;">
        <div style="margin-right: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Duration</span>
          <div style="font-size: 13px; font-weight: 800; color: #0284c7;">${payload.durationMinutes} Minutes</div>
        </div>
        ${payload.totalQuestions ? `
        <div style="margin-right: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Questions</span>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${payload.totalQuestions} Items</div>
        </div>` : ''}
        ${payload.negativeMarking ? `
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Negative Penalty</span>
          <div style="font-size: 13px; font-weight: 800; color: #e11d48;">-${payload.negativeMarking} per wrong</div>
        </div>` : ''}
      </div>
      <div style="margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Assigned Batch(es)</span>
        <div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 2px;">${payload.batchNames.join(', ')}</div>
      </div>
      ${payload.description ? `
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Description</span>
        <p style="font-size: 13px; color: #334155; margin: 4px 0 0 0; line-height: 1.4;">${payload.description}</p>
      </div>` : ''}
    `;

    const htmlBody = buildHtmlEmail({
      badgeText: 'Online Exam Scheduled',
      badgeBg: '#4f46e5',
      heading: `Examination: ${payload.title}`,
      detailsHtml,
      ctaText: 'Go to Examination Portal',
      ctaUrl: '/student/exams',
      note: 'Make sure you have a stable internet connection before starting the test. Once started, the timer cannot be paused.'
    });

    const emailList = validRecipients.map(r => r.email);

    // Run non-blocking through Google Apps Script webhook
    postToGoogleSheet({
      action: 'send_email_notification',
      notification_type: 'exam',
      subject: `New Online Exam Scheduled: ${payload.title}`,
      recipients: emailList,
      html_body: htmlBody
    }).catch(err => {
      console.warn('[EmailNotification] Exam email error:', err);
    });

    return { success: true, count: validRecipients.length };
  } catch (err) {
    console.warn('[EmailNotification] Failed to send exam email:', err);
    return { success: false, count: 0 };
  }
}
