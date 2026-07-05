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

export interface ProcessSteps {
  id: number;
  project_id: number;
  step1_label: string;
  step1_data: string;
  step1_complete: number;
  step2_label: string;
  step2_data: string;
  step2_complete: number;
  step3_label: string;
  step3_data: string;
  step3_complete: number;
  step4_data: string;
  step4_complete: number;
  step5_label: string;
  step5_data: string;
  step5_complete: number;
  comets_no: string;
  comets_url: string;
  email_from: string;
  email_attachment_info: string;
  order_confirmed: number;
  report_number: string;
  folder_path: string;
  is_complete: number;
}

export interface GanttTask {
  id: number;
  project_id: number;
  task_order: number;
  name: string;
  category: string;
  planned_start: string;
  planned_end: string;
  actual_start: string;
  actual_end: string;
  progress: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Outputs {
  id: number;
  project_id: number;
  step1_complete: number;
  step2_complete: number;
  step3_complete: number;
  step4_complete: number;
  step5_complete: number;
  step6_complete: number;
  step7_complete: number;
  step7_data: string;
  report_no: string;
  report_approved: number;
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
  work_type: string;
  requester: string;
  customer_name: string;
  bearing_no: string;
  received_date: string;
  due_date: string;
  notes: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
  work_request?: WorkRequest;
  process?: ProcessSteps;
  outputs?: Outputs;
  files?: FileAttachment[];
  report_numbers?: ReportNumber[];
  gantt_tasks?: GanttTask[];
}

export interface ReportNumber {
  id: number;
  project_id: number;
  report_number: string;
  item_description: string;
  folder_path: string;
  created_at: string;
}

export interface ProjectSummary {
  total: number;
  by_status: Record<string, number>;
  by_stage: Record<string, number>;
  by_type: Record<string, number>;
}

export interface TimeLogEntry {
  id: number;
  project_id: number;
  task_id: number;
  task_name: string;
  entry_date: string;
  user_name: string;
  group_name: string;
  sales: string;
  category: string;
  customer: string;
  aptx: string;
  code: string;
  hours: number;
  comment: string;
  mode: string;
  created_at: string;
  updated_at: string;
  project_title?: string;
  work_type?: string;
}

export interface ProcessResponse {
  process: ProcessSteps;
  gantt_tasks: GanttTask[];
  progress: number;
}

export interface OutputsResponse {
  outputs: Outputs;
  progress: number;
  all_required_complete: boolean;
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

export const PROCESS_STEP_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Step 1: Order Receiving', description: 'Receive order details from COMETS' },
  2: { label: 'Step 2: Order Confirmation', description: 'Confirm order details' },
  3: { label: 'Step 3: Report Number', description: 'Assign report number (use "No report" for Others type)' },
  4: { label: 'Step 4: Planning & Execution (Gantt)', description: 'Add tasks, plan schedule, track actual progress' },
  5: { label: 'Step 5: Final Review', description: 'Review files, open server folder, collect all uploaded files' },
};

export const OUTPUT_STEP_LABELS: Record<number, string> = {
  6: 'Step 6: Report approved',
  7: 'Step 7: Work log completed',
  8: 'Step 8: Claim record completed',
  9: 'Step 9: Eval record completed',
  10: 'Step 10: COMETS submitted',
  11: 'Step 11: Final check',
  12: 'Step 12: Report revision (optional)',
};
