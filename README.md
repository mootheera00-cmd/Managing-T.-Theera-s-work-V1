# Managing T. Theera's Work

A full-stack web application for managing work requests, processes, and outputs. Built with **FastAPI** (Python) backend and **React 19** (TypeScript) frontend.

## Features

- **3-Column Kanban Dashboard** — Work Request → Process → Outputs
- **Auto-Stage Progression** — Projects automatically advance when a stage is complete
- **13 Work Types** — Evaluation, Investigation, Tech. support, and more
- **File Upload** — Attach files at every step with view/download support
- **Due Date Alerts** — Color-coded urgency indicators (red/orange/yellow/green)
- **Pause/Resume** — Pause projects with a reason and resume later
- **History & Summary** — Filter by date range and view statistics
- **Progress Tracking** — Real-time percentage for each project
- **Edit Anything** — All fields are editable inline at any time
- **Safe Deletion** — Confirmation dialogs guide users toward canceling
- **Conditional Fields** — Claim Record (Investigation types) and Eval Record (Evaluation type)

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (with npm)

## Quick Setup

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend runs on **http://localhost:5000**.

### 2. Frontend Setup (Development)

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:3000** and proxies API calls to port 5000.

### 3. Production Build

```bash
cd frontend
npm install
npm run build
```

After building, the backend will automatically serve the frontend from `frontend/dist/`.  
Just run `python backend/main.py` and open **http://localhost:5000**.

## Windows Quick Start

Double-click `start.bat` — it launches the backend and opens your browser.

## Build .exe

```bash
python build_exe.py
```

This will:
1. Install frontend dependencies
2. Build the React frontend
3. Bundle everything into a single `.exe` using PyInstaller

The output `.exe` will be in the `dist/` folder.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (filters: year, status, stage, search, date_from, date_to) |
| GET | `/api/projects/summary` | Statistics summary |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project detail |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| POST | `/api/projects/{id}/pause` | Pause project |
| POST | `/api/projects/{id}/resume` | Resume project |
| PUT | `/api/projects/{id}/work-request` | Update work request |
| PUT | `/api/projects/{id}/process` | Update process |
| PUT | `/api/projects/{id}/outputs` | Update outputs |
| POST | `/api/files/upload` | Upload file (multipart) |
| GET | `/api/files/{id}/view` | View file inline |
| GET | `/api/files/{id}/download` | Download file |
| DELETE | `/api/files/{id}` | Delete file |
| GET | `/api/files/project/{id}` | List project files |

## Project Structure

```
managing-theera-work/
├── backend/
│   ├── main.py              # FastAPI app + server
│   ├── database.py          # SQLite3 database setup
│   ├── models.py            # Pydantic schemas
│   ├── routes/
│   │   ├── projects.py      # Project CRUD + auto-progression
│   │   └── files.py         # File upload/download/view
│   ├── uploads/             # Uploaded files storage
│   └── requirements.txt
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/index.ts
│       ├── api/client.ts
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── ProjectDetailPage.tsx
│       │   └── HistoryPage.tsx
│       └── components/
│           ├── Layout.tsx
│           ├── ProjectCard.tsx
│           ├── ProjectForm.tsx
│           ├── WorkRequestForm.tsx
│           ├── ProcessForm.tsx
│           ├── OutputForm.tsx
│           ├── FileUpload.tsx
│           ├── ConfirmDialog.tsx
│           └── ProgressBar.tsx
│
├── build_exe.py             # PyInstaller build script
├── start.bat                # Windows quick-start
├── start.sh                 # Linux/Mac quick-start
└── README.md
```

## Database

SQLite3 database (`theera_work.db`) is automatically created in the `backend/` directory on first run.

**Tables:**
- `projects` — Main project record with stage, status, progress
- `work_requests` — Work request details (requester, customer, type, bearing, due date)
- `process_steps` — Process workflow (COMETS, order confirmation, test/report statuses)
- `outputs` — Output tracking (report approval, submissions, records)
- `file_attachments` — Uploaded files metadata

## Links

- **Work Log Management:** http://aptc150-096.asia.ad.nsk.com/signin.php

## License

Internal use only.
