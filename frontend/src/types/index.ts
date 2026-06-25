export interface FileAttachment {
  id: number;
  project_id: number;
  stage: string;
  step_name: string;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface WorkRequest {
  id: number;
  project_id: number;
  requester: string;
  customer_name: string;
  work_type: string;
  bearing_no: string;
  received_date: string;
  due_date: string;
  notes: string;
  is_complete: number;
}

export interface ProcessStep {
  id: number;
  project_id: number;
  comets_no: string;
  comets_url: string;
  email_from: string;
  email_attachment_info: string;
  order_confirmed: number;
  report_number: string;
  folder_path: string;
  work_log_url: string;
  test_status: string;
  report_status: string;
  store_report_status: string;
  check_status: string;
  is_paused: number;
  pause_reason: string;
  is_complete: number;
}

export interface Output {
  id: number;
  project_id: number;
  report_approved: number;
  report_revising: number;
  revision_notes: string;
  work_log_completed: number;
  claim_record_completed: number;
  eval_record_completed: number;
  comets_submitted: number;
  comets_no: string;
  submission_date: string;
  is_complete: number;
}

export interface Project {
  id: number;
  year: number;
  title: string;
  current_stage: 'work_request' | 'process' | 'outputs' | 'completed';
  progress_percent: number;
  status: 'active' | 'paused' | 'completed';
  pause_reason: string;
  created_at: string;
  updated_at: string;
  work_request?: WorkRequest;
  process?: ProcessStep;
  outputs?: Output;
  files?: FileAttachment[];
  report_numbers?: ReportNumber[];
  // Joined fields from list endpoint
  requester?: string;
  customer_name?: string;
  work_type?: string;
  bearing_no?: string;
  due_date?: string;
}

export interface ReportNumber {
  id: number;
  project_id: number;
  report_number: string;
  item_description: string;
  folder_path: string;
  created_at: string;
}

export interface RevisedDetail {
  id: number;
  title: string;
  revision_notes: string;
}

export interface ProjectSummary {
  total: number;
  by_status: Record<string, number>;
  by_stage: Record<string, number>;
  by_type: Record<string, number>;
  revised_count: number;
  revised_details: RevisedDetail[];
}

export const REQUESTERS = [
  'A-NSK', 'A/J', 'AIBU', 'AMT', 'APTC', 'ASEAN-HQ', 'BDT', 'CAD IGT', 'CBT', 'Chuji',
  'ISC-MP', 'JK-NSK', 'L-NSK', 'NABI', 'NBI', 'NBMT', 'NBMT&SNSS', 'NIS', 'NIS-Philip',
  'NISCO', 'NSK REP', 'NSK South Africa', 'NSK-MP', 'NSSA', 'NSSH', 'NW-I',
  'Q-NSK', 'S-NSK', 'SNSS', 'SQC', 'STC', 'T-NSK', 'VN-NSK',
] as const;

export const WORK_TYPES = [
  'Evaluation',
  'Education for internal',
  'Investigation',
  'Investigation for Benchmark',
  'Investigation for Warranty',
  'Maintenance',
  'Improvement',
  'Tech. support',
  'Tech. support for S-pro',
  'Tech. support for Shirozu EX',
  'Meeting with internal',
  'Leave',
  'Admin',
  'HR',
  'Others',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const STAGE_LABELS: Record<string, string> = {
  work_request: 'Work Request',
  process: 'Process',
  outputs: 'Outputs',
  completed: 'Completed',
};

export interface TimeLogEntry {
  id: number;
  project_id: number;
  task_id: string;
  task_name: string;
  entry_date: string;
  hours: number;
  slots_json: string;
  project_title?: string;
  requester?: string;
  customer_name?: string;
  work_type?: string;
  bearing_no?: string;
  report_number?: string;
  created_at?: string;
  updated_at?: string;
}


