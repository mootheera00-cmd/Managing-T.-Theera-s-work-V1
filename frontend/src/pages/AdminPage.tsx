import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Trash2, Save, X, AlertCircle, ArrowLeft, Edit3, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUsers, createUser, updateUser, deleteUser, type User } from '../api/auth';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', display_name: '', role: 'user' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{ username: string; password: string; display_name: string; role: string; is_active: number }>({ username: '', password: '', display_name: '', role: 'user', is_active: 1 });

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') { navigate('/'); return; }
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password) return;
    setError('');
    try {
      await createUser(formData);
      setShowForm(false);
      setFormData({ username: '', password: '', display_name: '', role: 'user' });
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdate = async (id: number, field: string, value: string | number) => {
    try {
      await updateUser(id, { [field]: value });
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };


  if (!user) return null;

  return (
    <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-secondary p-1 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">User Management</h1>
            <p className="text-xs text-gray-500">Admin panel — manage user accounts</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ username: '', password: '', display_name: '', role: 'user' }); }}
          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* New User Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Add New User</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input className="input-base" placeholder="Username *" value={formData.username}
              onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} required />
            <input className="input-base" type="password" placeholder="Password *" value={formData.password}
              onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} required />
            <input className="input-base" placeholder="Display Name" value={formData.display_name}
              onChange={e => setFormData(p => ({ ...p, display_name: e.target.value }))} />
            <select className="input-base" value={formData.role}
              onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="btn-secondary p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Username</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Password</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Display Name</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.id}</td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input className="input-base text-xs py-1 px-2 w-full" value={editData.username}
                      onChange={e => setEditData(p => ({ ...p, username: e.target.value }))} />
                  ) : (
                    <span className="font-medium text-gray-800">{u.username}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <input className="input-base text-xs py-1 px-2 w-full" value={editData.password}
                      onChange={e => setEditData(p => ({ ...p, password: e.target.value }))} placeholder="Leave empty to keep" />
                  ) : (
                    <span className="text-gray-400 font-mono text-xs">{u.password || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {editingId === u.id ? (
                    <input className="input-base text-xs py-1 px-2 w-full" value={editData.display_name}
                      onChange={e => setEditData(p => ({ ...p, display_name: e.target.value }))} />
                  ) : (
                    <span className="text-gray-700">{u.display_name || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select className="input-base text-xs py-1 px-2" value={editData.role}
                      onChange={e => setEditData(p => ({ ...p, role: e.target.value }))}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white" value={u.role}
                      onChange={e => handleUpdate(u.id, 'role', e.target.value)} disabled={editingId !== null}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select className="input-base text-xs py-1 px-2" value={editData.is_active}
                      onChange={e => setEditData(p => ({ ...p, is_active: parseInt(e.target.value) }))}>
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editingId === u.id ? (
                      <>
                        <button onClick={async () => {
                          const updates: any = {};
                          if (editData.username !== u.username) updates.username = editData.username;
                          if (editData.password) updates.password = editData.password;
                          if (editData.display_name !== (u.display_name || '')) updates.display_name = editData.display_name;
                          if (editData.role !== u.role) updates.role = editData.role;
                          if (editData.is_active !== u.is_active) updates.is_active = editData.is_active;
                          try {
                            if (Object.keys(updates).length > 0) await updateUser(u.id, updates);
                            setEditingId(null);
                            await fetchUsers();
                          } catch (err: any) {
                            setError(err.response?.data?.detail || 'Failed to update');
                          }
                        }}
                          className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(u.id); setEditData({ username: u.username, password: '', display_name: u.display_name || '', role: u.role, is_active: u.is_active }); }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edit" disabled={editingId !== null}>
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== 1 && (
                          <button onClick={() => handleDelete(u.id)}
                            className="p-1 text-gray-400 hover:text-red-600" disabled={editingId !== null}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
