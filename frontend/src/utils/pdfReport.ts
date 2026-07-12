import { formatDMY } from '../utils/dateUtils';
import type { Project, ProcessSteps, GanttTask } from '../types';

export function generatePDFReport(
  project: Project | null,
  process: ProcessSteps | null,
  ganttTasks: GanttTask[],
  taskHours: Record<number, number>,
  totalProjectHours: number,
  step1TicketNo: string
) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const p = project;
  const proc = process;
  const tasksHtml = ganttTasks.length > 0
    ? ganttTasks.map((t, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(t.name)}</td>
        <td>${t.planned_start ? formatDMY(t.planned_start) + ' – ' + formatDMY(t.planned_end) : '-'}</td>
        <td class="hours">${taskHours[t.id] ? taskHours[t.id].toFixed(1) : '0.0'}h</td>
      </tr>`).join('') +
      `<tr class="total-row">
        <td colspan="3" style="text-align:right;font-weight:700">Total</td>
        <td class="hours" style="font-weight:700">${totalProjectHours.toFixed(1)}h</td>
      </tr>`
    : '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">No tasks</td></tr>';

  const revised = p?.outputs?.step7_data
    ? `Yes — ${esc(p.outputs.step7_data)}`
    : 'No';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Project Summary - ${esc(p?.title || '')}</title>
<style>
  @page { margin: 20mm 22mm 25mm 22mm; size: A4 portrait; }
  @page { @bottom-left { content: none; } }
  @page { @bottom-center { content: none; } }
  @page { @bottom-right { content: none; } }
  @page { @top-left { content: none; } }
  @page { @top-center { content: none; } }
  @page { @top-right { content: none; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #1a1a1a;
    padding: 0;
  }

  /* Report Header */
  .report-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 3px solid #1a1a1a;
  }
  .report-header h1 {
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: 1px;
    color: #000;
    margin-bottom: 4px;
  }
  .report-header .sub {
    font-size: 9pt;
    color: #888;
    letter-spacing: 0.5px;
  }
  .report-header .date {
    font-size: 9pt;
    color: #888;
    margin-top: 2px;
  }

  /* Section */
  .section {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #000;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #444;
    margin-bottom: 12px;
    letter-spacing: 0.3px;
  }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px 20px;
  }
  .info-grid .item { break-inside: avoid; }
  .info-grid .label {
    font-size: 7.5pt;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .info-grid .value {
    font-size: 10pt;
    font-weight: 600;
    color: #1a1a1a;
    margin-top: 1px;
  }
  .info-grid .value .status {
    display: inline-block;
    padding: 1px 10px;
    border-radius: 10px;
    font-size: 8pt;
    font-weight: 700;
  }
  .info-grid .value .status.active { background: #fef3c7; color: #92400e; }
  .info-grid .value .status.completed { background: #d1fae5; color: #065f46; }
  .info-grid .full { grid-column: 1 / -1; }
  .info-grid .half { grid-column: span 1; }

  /* Notes */
  .notes {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 10pt;
    color: #555;
  }
  .notes .label {
    font-size: 7.5pt;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Two-column */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
  }

  /* Table */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }
  th {
    text-align: left;
    padding: 6px 8px;
    font-size: 7.5pt;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1.5px solid #ddd;
  }
  td {
    padding: 6px 8px;
    border-bottom: 1px solid #eee;
    color: #333;
  }
  td.num { width: 30px; text-align: center; color: #999; font-weight: 700; }
  td.hours { text-align: right; font-weight: 600; color: #059669; width: 70px; }
  tr.total-row td {
    border-top: 2px solid #333;
    border-bottom: none;
    padding-top: 8px;
    font-weight: 700;
    color: #000;
  }
  tr.total-row td.hours { color: #059669; }

  /* Folder path */
  .folder-path {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9pt;
    color: #2563eb;
    word-break: break-all;
  }

  /* Revised badge */
  .revised-badge {
    display: inline-block;
    background: #fef3c7;
    color: #92400e;
    padding: 1px 10px;
    border-radius: 10px;
    font-size: 8pt;
    font-weight: 700;
  }

  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin-top: 30px;
    padding: 10px 0 5px 0;
    border-top: 1px solid #ccc;
    font-size: 8pt;
    text-align: left;
  }
  .footer .confidential {
    color: #2563eb;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .footer .generated {
    float: right;
    color: #aaa;
  }
</style>
</head>
<body>

<div class="report-header">
  <h1>PROJECT SUMMARY</h1>
  <div class="sub">${esc(p?.title || '')}</div>
  <div class="date">Generated: ${today}</div>
</div>

<!-- 1. Project Details -->
<div class="section">
  <h2>1. Project Details</h2>
  <div class="info-grid">
    <div class="item"><div class="label">Title</div><div class="value">${esc(p?.title || '-')}</div></div>
    <div class="item"><div class="label">Work Type</div><div class="value">${esc(p?.work_type || '-')}</div></div>
    <div class="item"><div class="label">Requester</div><div class="value">${esc(p?.requester || '-')}</div></div>
    <div class="item"><div class="label">Customer</div><div class="value">${esc(p?.customer_name || '-')}</div></div>
    <div class="item"><div class="label">Bearing No.</div><div class="value">${esc(p?.bearing_no || '-')}</div></div>
    <div class="item"><div class="label">Received Date</div><div class="value">${formatDMY(p?.received_date) || '-'}</div></div>
    <div class="item"><div class="label">Due Date</div><div class="value">${formatDMY(p?.due_date) || '-'}</div></div>
    <div class="item"><div class="label">Status</div><div class="value"><span class="status ${p?.current_stage === 'completed' ? 'completed' : 'active'}">${esc(p?.current_stage === 'completed' ? 'Completed' : 'In Progress')}</span></div></div>
    <div class="item"><div class="label">Completed At</div><div class="value">${formatDMY(p?.completed_at) || '-'}</div></div>
  </div>
  ${p?.notes ? `<div class="notes"><div class="label">Notes</div><div style="margin-top:4px">${esc(p.notes)}</div></div>` : ''}
</div>

<!-- 2. Ticket & Report -->
<div class="section">
  <h2>2. Ticket &amp; Report No.</h2>
  <div class="two-col">
    <div><div class="info-grid"><div class="item"><div class="label">Ticket No.</div><div class="value">${esc(step1TicketNo || '-')}</div></div></div></div>
    <div><div class="info-grid"><div class="item"><div class="label">Report No.</div><div class="value">${esc(proc?.report_number || p?.outputs?.report_no || '-')}</div></div></div></div>
  </div>
</div>

<!-- 3. Tasks & Working Hours -->
<div class="section">
  <h2>3. Tasks &amp; Working Hours</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Task</th><th>Planned Dates</th><th style="text-align:right">Hours</th></tr>
    </thead>
    <tbody>
      ${tasksHtml}
    </tbody>
  </table>
</div>

<!-- 4. Server Folder & Final Review -->
<div class="section">
  <h2>4. Server Folder &amp; Final Review</h2>
  <div class="two-col">
    <div>
      <div class="info-grid">
        <div class="item"><div class="label">Server Folder</div><div class="value">${proc?.folder_path ? `<div class="folder-path">${esc(proc.folder_path)}</div>` : '-'}</div></div>
      </div>
    </div>
    <div>
      <div class="info-grid">
        <div class="item"><div class="label">Final Review Notes</div><div class="value">${esc(proc?.step5_data || '-')}</div></div>
      </div>
    </div>
  </div>
</div>

<!-- 5. Outputs Summary -->
<div class="section">
  <h2>5. Outputs Summary</h2>
  <div class="two-col">
    <div>
      <div class="info-grid">
        <div class="item"><div class="label">Report Approved</div><div class="value">${p?.outputs?.report_approved ? (formatDMY(p?.outputs?.submission_date) || 'Yes') : '-'}</div></div>
      </div>
    </div>
    <div>
      <div class="info-grid">
        <div class="item"><div class="label">COMETS Submitted</div><div class="value">${p?.outputs?.comets_submitted ? (formatDMY(p?.outputs?.submission_date) || 'Yes') : '-'}</div></div>
      </div>
    </div>
  </div>
  <div style="margin-top:12px">
    <div class="info-grid">
      <div class="item"><div class="label">Revised — Report was revised</div><div class="value"><span class="revised-badge">${revised}</span></div></div>
    </div>
  </div>
</div>

<div class="footer">
  <span class="confidential">CONFIDENTIAL</span>
  <span class="generated">Generated from Our group's work System &bull; ${today}</span>
</div>

</body>
</html>`;

  function esc(s: string): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Use an invisible iframe to avoid opening multiple windows
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    // Print after content loads, then remove iframe
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove after print dialog closes (user clicks Print/Cancel)
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  } else {
    // Fallback: open in new window
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  }
}
