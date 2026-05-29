import axios from 'axios';
import type { Project, ProjectSummary } from '../types';

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

// --- Summary ---
export async function getSummary(params?: {
  year?: number;
  date_from?: string;
  date_to?: string;
}): Promise<ProjectSummary> {
  const { data } = await api.get('/projects/summary', { params });
  return data;
}
