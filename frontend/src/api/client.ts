import axios from 'axios';
import type { Project, ProjectSummary, TimeLogEntry } from '../types';


const api = axios.create({
  baseURL: '/api',
});

// --- Projects ---
export async function getProjects(params?: {
  year?: number;
  status?: string;
  stage?: string;
  search?: string;
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

export async function createProject(payload: { year: number; title: string }): Promise<Project> {
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

export async function pauseProject(id: number, reason: string): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/pause`, { reason });
  return data;
}

export async function resumeProject(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/resume`);
  return data;
}

export async function startProcess(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/start`);
  return data;
}

export async function completeProcess(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/complete-process`);
  return data;
}

export async function completeOutputs(id: number): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/complete-outputs`);
  return data;
}

// --- Work Request ---
export async function updateWorkRequest(projectId: number, payload: Record<string, unknown>): Promise<Project> {
  const { data } = await api.put(`/projects/${projectId}/work-request`, payload);
  return data;
}

// --- Process ---
export async function updateProcess(projectId: number, payload: Record<string, unknown>): Promise<Project> {
  const { data } = await api.put(`/projects/${projectId}/process`, payload);
  return data;
}

export async function openFolder(projectId: number, rnId?: number): Promise<{ message: string }> {
  const params = rnId !== undefined ? { rn_id: rnId } : {};
  const { data } = await api.post(`/projects/${projectId}/open-folder`, null, { params });
  return data;
}

// --- Outputs ---
export async function updateOutputs(projectId: number, payload: Record<string, unknown>): Promise<Project> {
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

// --- Report Numbers ---
export async function getReportNumbers(projectId: number): Promise<import('../types').ReportNumber[]> {
  const { data } = await api.get(`/projects/${projectId}/report-numbers`);
  return data;
}

export async function createReportNumber(projectId: number, payload: { report_number: string; item_description: string; folder_path?: string }): Promise<import('../types').ReportNumber> {
  const { data } = await api.post(`/projects/${projectId}/report-numbers`, payload);
  return data;
}

export async function updateReportNumber(projectId: number, rnId: number, payload: { report_number?: string; item_description?: string; folder_path?: string }): Promise<import('../types').ReportNumber> {
  const { data } = await api.put(`/projects/${projectId}/report-numbers/${rnId}`, payload);
  return data;
}

export async function deleteReportNumber(projectId: number, rnId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/report-numbers/${rnId}`);
}

// --- Summary ---
export async function getSummary(params?: {
  year?: number;
  date_from?: string;
  date_to?: string;
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

// --- Gantt Tasks ---
export interface GanttTaskResponse {
  id: string;
  project_id: number;
  step: string;
  report_number: string;
  name: string;
  category: string;
  start: string;
  end: string;
  progress: number;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface GanttTasksResponse {
  initialized: boolean;
  tasks: GanttTaskResponse[];
}

export async function getGanttTasks(
  projectId: number,
  step: string,
  reportNumber: string
): Promise<GanttTasksResponse> {
  const { data } = await api.get(`/projects/${projectId}/gantt-tasks`, {
    params: { step, report_number: reportNumber },
  });
  return data;
}

export async function initializeGanttTasks(
  projectId: number,
  payload: {
    step: string;
    report_number: string;
    tasks: {
      id: string;
      name: string;
      category: string;
      start: string;
      end: string;
      progress: number;
      color: string;
    }[];
  }
): Promise<GanttTasksResponse> {
  const { data } = await api.post(`/projects/${projectId}/gantt-tasks/initialize`, payload);
  return data;
}

export async function createGanttTask(
  projectId: number,
  payload: {
    id: string;
    step: string;
    report_number: string;
    name: string;
    category: string;
    start: string;
    end: string;
    progress: number;
    color: string;
  }
): Promise<GanttTaskResponse> {
  const { data } = await api.post(`/projects/${projectId}/gantt-tasks`, payload);
  return data;
}

export async function updateGanttTask(
  projectId: number,
  taskId: string,
  payload: {
    name?: string;
    category?: string;
    start?: string;
    end?: string;
    progress?: number;
    color?: string;
  }
): Promise<GanttTaskResponse> {
  const { data } = await api.put(`/projects/${projectId}/gantt-tasks/${taskId}`, payload);
  return data;
}

export async function deleteGanttTask(projectId: number, taskId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/gantt-tasks/${taskId}`);
}

// --- Time Logs ---
export interface TimeLogPayload {
  project_id: number;
  task_id: string;
  task_name: string;
  entry_date: string;
  hours: number;
  slots_json: string;
}

export async function getTimeLogs(params?: {
  date_from?: string;
  date_to?: string;
  project_id?: number;
}): Promise<TimeLogEntry[]> {
  const { data } = await api.get('/time-logs', { params });
  return data;
}

export async function saveTimeLog(payload: TimeLogPayload): Promise<TimeLogEntry> {
  const { data } = await api.post('/time-logs', payload);
  return data;
}

export async function deleteTimeLog(id: number): Promise<void> {
  await api.delete(`/time-logs/${id}`);
}


