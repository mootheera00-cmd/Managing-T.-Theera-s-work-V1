import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db

router = APIRouter()

# ── Simple token-based auth (no JWT dependency) ──
# Store tokens in memory (lost on restart, users re-login)
_active_tokens: dict[str, dict] = {}
TOKEN_EXPIRE_HOURS = 24

def _hash_password(password: str) -> str:
    """Plain text storage (internal system)."""
    return password

def _verify_password(password: str, stored: str) -> bool:
    """Plain text comparison."""
    return password == stored

def _generate_token() -> str:
    return secrets.token_hex(32)

def get_current_user(authorization: str = Header('')):
    """Dependency: extract and validate token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace('Bearer ', '')
    session = _active_tokens.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if datetime.now() > session['expires']:
        del _active_tokens[token]
        raise HTTPException(status_code=401, detail="Token expired")
    return session['user']

def require_admin(user: dict = Depends(get_current_user)):
    """Dependency: ensure the current user is an admin."""
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

# ── Models ──
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str = ''
    role: str = 'user'

class UserUpdate(BaseModel):
    password: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[int] = None

# ── Routes ──
@router.post("/api/auth/login")
def login(req: LoginRequest):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE AND is_active=1", (req.username,)).fetchone()
    db.close()
    if not row or not _verify_password(req.password, row['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = _generate_token()
    user = dict(row)
    user.pop('password_hash', None)
    user.pop('password', None)
    _active_tokens[token] = {
        'user': user,
        'expires': datetime.now() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    }
    return {"token": token, "user": user}

@router.post("/api/auth/logout")
def logout(authorization: str = Header('')):
    token = authorization.replace('Bearer ', '')
    _active_tokens.pop(token, None)
    return {"message": "Logged out"}

@router.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}

# ── Admin: User Management ──
@router.get("/api/auth/users")
def list_users(admin_user: dict = Depends(require_admin)):
    db = get_db()
    rows = db.execute("SELECT id, username, password_hash as password, display_name, role, is_active, created_at FROM users ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]

@router.post("/api/auth/users")
def create_user(req: UserCreate, admin_user: dict = Depends(require_admin)):
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, display_name, role) VALUES (?,?,?,?)",
            (req.username, _hash_password(req.password), req.display_name, req.role)
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    db.close()
    return {"message": "User created"}

@router.put("/api/auth/users/{user_id}")
def update_user(user_id: int, req: UserUpdate, admin_user: dict = Depends(require_admin)):
    db = get_db()
    fields = []
    vals = []
    if req.password:
        fields.append("password_hash=?")
        vals.append(_hash_password(req.password))
    if req.display_name is not None:
        fields.append("display_name=?")
        vals.append(req.display_name)
    if req.role is not None:
        fields.append("role=?")
        vals.append(req.role)
    if req.is_active is not None:
        fields.append("is_active=?")
        vals.append(req.is_active)
    if fields:
        vals.append(user_id)
        db.execute(f"UPDATE users SET {', '.join(fields)}, updated_at=CURRENT_TIMESTAMP WHERE id=?", vals)
        db.commit()
    db.close()
    return {"message": "User updated"}

@router.delete("/api/auth/users/{user_id}")
def delete_user(user_id: int, admin_user: dict = Depends(require_admin)):
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (user_id,))
    db.commit()
    db.close()
    return {"message": "User deleted"}
