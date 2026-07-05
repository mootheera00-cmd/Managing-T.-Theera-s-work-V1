import axios from 'axios';
import type { Project, ProjectSummary, TimeLogEntry, ProcessResponse, OutputsResponse, GanttTask, ReportNumber, ProcessSteps, Outputs } from '../types';

const api = axios.create({
  baseURL: '/api',
});

// --- Projects ---
export async function getProjects(params?: {
  year?: number;
  status?: string;
  stage?: string;
  search?: string;
  work_type?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Project[]> {
  const { data } = await api.get('/projects', { params });
  return data;
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await api.get(`/projects/${id}`);
  return data;
}

export async function createProject(payload: {
  year: number;
  title: string;
  requester?: string;
  customer_name?: string;
  work_type?: string;
  bearing_no?: string;
  received_date?: string;
  due_date?: string;
  notes?: string;
}): Promise<Project> {
  const { data } = await api.post('/projects', payload);
  return data;
}

export async function updateProject(id: number, payload: Record<string, unknown>): Promise<Project> {
  const { data } = await api.put(`/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function startProcess(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/start`);
  return data;
}

export async function advanceToOutputs(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/advance-to-outputs`);
  return data;
}

export async function completeOutputs(id: number): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post(`/projects/${id}/complete-outputs`);
  return data;
}

export async function revertStage(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/revert-stage`);
  return data;
}

export async function pauseProject(id: number, reason: string): Promise<void> {
  await api.post(`/projects/${id}/pause`, { reason });
}

export async function resumeProject(id: number): Promise<void> {
  await api.post(`/projects/${id}/resume`);
}

// --- Work Request ---
export async function updateWorkRequest(projectId: number, payload: Record<string, unknown>): Promise<Project> {
  const { data } = await api.put(`/projects/${projectId}/work-request`, payload);
  return data;
}

// --- Process ---
export async function getProcess(projectId: number): Promise<ProcessResponse> {
  const { data } = await api.get(`/projects/${projectId}/process`);
  return data;
}

export async function updateProcessStep(projectId: number, stepNum: number, payload: {
  label?: string;
  data?: string;
  complete?: boolean;
}): Promise<{ success: boolean; progress: number; all_steps_complete: boolean }> {
  const { data } = await api.put(`/projects/${projectId}/process/step/${stepNum}`, {
    step_num: stepNum,
    ...payload
  });
  return data;
}

export async function updateProcess(projectId: number, payload: Record<string, unknown>): Promise<{ success: boolean; progress: number }> {
  const { data } = await api.put(`/projects/${projectId}/process`, payload);
  return data;
}

// --- Gantt Tasks ---
export async function getGanttTasks(projectId: number): Promise<GanttTask[]> {
  const { data } = await api.get(`/projects/${projectId}/gantt-tasks`);
  return data;
}

export async function createGanttTask(projectId: number, payload: {
  name: string;
  category?: string;
  planned_start?: string;
  planned_end?: string;
  color?: string;
}): Promise<GanttTask> {
  const { data } = await api.post(`/projects/${projectId}/gantt-tasks`, payload);
  return data;
}

export async function updateGanttTask(projectId: number, taskId: number, payload: Record<string, unknown>): Promise<GanttTask> {
  const { data } = await api.put(`/projects/${projectId}/gantt-tasks/${taskId}`, payload);
  return data;
}

export async function deleteGanttTask(projectId: number, taskId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/gantt-tasks/${taskId}`);
}

export async function reorderGanttTasks(projectId: number, order: number[]): Promise<void> {
  await api.post(`/projects/${projectId}/gantt-tasks/reorder`, { order });
}

// --- Outputs ---
export async function getOutputs(projectId: number): Promise<OutputsResponse> {
  const { data } = await api.get(`/projects/${projectId}/outputs`);
  return data;
}

export async function updateOutputs(projectId: number, payload: Record<string, unknown>): Promise<{ success: boolean; progress: number }> {
  const { data } = await api.put(`/projects/${projectId}/outputs`, payload);
  return data;
}

// --- Files ---
export async function uploadFile(
  projectId: number,
  file: File,
  stage: string,
  stepName: string = ''
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', String(projectId));
  formData.append('stage', stage);
  formData.append('step_name', stepName);
  const { data } = await api.post('/files/upload', formData);
  return data;
}

export async function deleteFile(fileId: number): Promise<void> {
  await api.delete(`/files/${fileId}`);
}

export async function getProjectFiles(projectId: number, stage?: string) {
  const params = stage ? { stage } : {};
  const { data } = await api.get(`/files/project/${projectId}`, { params });
  return data;
}

// --- Folder Operations (Step 5 Final Review) ---
export async function openFolder(folderPath: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post('/files/open-folder', { folder_path: folderPath });
  return data;
}

export async function listFolder(folderPath: string): Promise<{
  success: boolean;
  folder_path: string;
  parent_path: string;
  items: Array<{ name: string; path: string; is_dir: boolean; size: number; modified: number }>;
}> {
  const { data } = await api.post('/files/list-folder', { folder_path: folderPath });
  return data;
}

export async function copyFileToFolder(source: string, targetFolder: string): Promise<{ success: boolean; message: string; dest_path: string }> {
  const { data } = await api.post('/files/copy-to-folder', { folder_path: source, target_folder: targetFolder });
  return data;
}

// --- Report Numbers ---
export async function getReportNumbers(projectId: number): Promise<ReportNumber[]> {
  const { data } = await api.get(`/projects/${projectId}/report-numbers`);
  return data;
}

export async function createReportNumber(projectId: number, payload: { report_number: string; item_description: string; folder_path?: string }): Promise<ReportNumber> {
  const { data } = await api.post(`/projects/${projectId}/report-numbers`, payload);
  return data;
}

export async function updateReportNumber(projectId: number, rnId: number, payload: { report_number?: string; item_description?: string; folder_path?: string }): Promise<ReportNumber> {
  const { data } = await api.put(`/projects/${projectId}/report-numbers/${rnId}`, payload);
  return data;
}

export async function deleteReportNumber(projectId: number, rnId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/report-numbers/${rnId}`);
}

// --- Summary ---
export async function getSummary(params?: {
  year?: number;
}): Promise<ProjectSummary> {
  const { data } = await api.get('/projects/summary', { params });
  return data;
}

// --- Evaluation Process Entries ---
export interface EvalProcessEntry {
  id: number;
  project_id: number;
  entry_date: string;
  tasks_today: string;
  tasks_tomorrow: string;
  created_at: string;
  updated_at: string;
}

export async function getEvalProcessEntries(projectId: number): Promise<EvalProcessEntry[]> {
  const { data } = await api.get(`/projects/${projectId}/eval-process`);
  return data;
}

export async function createEvalProcessEntry(
  projectId: number,
  payload: { entry_date: string; tasks_today?: string; tasks_tomorrow?: string }
): Promise<EvalProcessEntry> {
  const { data } = await api.post(`/projects/${projectId}/eval-process`, payload);
  return data;
}

export async function updateEvalProcessEntry(
  projectId: number,
  entryId: number,
  payload: { tasks_today?: string; tasks_tomorrow?: string }
): Promise<EvalProcessEntry> {
  const { data } = await api.put(`/projects/${projectId}/eval-process/${entryId}`, payload);
  return data;
}

export async function deleteEvalProcessEntry(projectId: number, entryId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/eval-process/${entryId}`);
}

// --- Time Logs ---
export async function getTimeLogs(params?: {
  date?: string;
  date_from?: string;
  date_to?: string;
  project_id?: number;
}): Promise<TimeLogEntry[]> {
  const { data } = await api.get('/time-logs', { params });
  return data;
}

export async function createTimeLog(payload: {
  project_id: number;
  task_id?: number;
  task_name?: string;
  entry_date: string;
  user_name?: string;
  group_name?: string;
  sales?: string;
  category?: string;
  customer?: string;
  aptx?: string;
  code?: string;
  hours: number;
  comment?: string;
  mode?: string;
}): Promise<{ id: number; day_logs: TimeLogEntry[]; date_total: number; exceeds_normal: boolean; overtime_hours: number }> {
  const { data } = await api.post('/time-logs', payload);
  return data;
}

export async function updateTimeLog(id: number, payload: Record<string, unknown>): Promise<{ log: TimeLogEntry; date_total: number }> {
  const { data } = await api.put(`/time-logs/${id}`, payload);
  return data;
}

// --- Dashboard ---
export interface DashboardData {
  today: string;
  today_tasks: Array<{
    id: number;
    project_id: number;
    project_title: string;
    work_type: string;
    customer_name: string;
    name: string;
    category: string;
    planned_start: string;
    planned_end: string;
    actual_start: string;
    actual_end: string;
    progress: number;
    status: string;
    color: string;
  }>;
  active_projects: Array<{
    id: number;
    title: string;
    work_type: string;
    customer_name: string;
    bearing_no: string;
    due_date: string;
    days_remaining: number | null;
    progress_percent: number;
    total_tasks: number;
    completed_tasks: number;
    current_stage: string;
    process?: ProcessSteps | null;
    outputs?: Outputs | null;
  }>;
  stats: {
    total_active: number;
    overdue_count: number;
    due_soon_count: number;
    today_task_count: number;
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/dashboard');
  return data;
}

export async function deleteTimeLog(id: number): Promise<{ success: boolean; day_logs: TimeLogEntry[]; date_total: number }> {
  const { data } = await api.delete(`/time-logs/${id}`);
  return data;
}

export async function checkDailyHours(date: string): Promise<{
  date: string;
  total_hours: number;
  normal_limit: number;
  ot_limit: number;
  is_full: boolean;
  can_add_overtime: boolean;
  remaining_normal: number;
  remaining_with_ot: number;
}> {
  const { data } = await api.get(`/time-logs/check-hours/${date}`);
  return data;
}

export async function getActiveProjectsForTimesheet(): Promise<Project[]> {
  const { data } = await api.get('/time-logs/active-projects');
  return data;
}
