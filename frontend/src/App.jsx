import React, { useState, useEffect } from 'react'
import { Home, Receipt, Utensils, Wallet, Users, User, Landmark, Archive, Bell } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import './index.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://vara-bhagabhagi-api.onrender.com";

const ManagerMealBulkForm = ({ users, myGroup, existingMeals, onMealAdded, onShowToast }) => {
  const getDefaultDate = () => new Date().toISOString().split('T')[0];

  const [forms, setForms] = useState(() => {
    const initial = {};
    users.forEach(u => {
      initial[u.user_id] = { date: getDefaultDate(), breakfast: '', lunch: '', dinner: '', guest_meal: '' };
    });
    return initial;
  });

  const handleInputChange = (userId, field, value) => {
    setForms(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value }
    }));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();

    // Gather valid entries
    const toSave = [];
    for (const u of users) {
      const f = forms[u.user_id];
      if (f.breakfast || f.lunch || f.dinner || f.guest_meal) {

        const alreadyExists = existingMeals.some(m => m.user_id === u.user_id && m.date === f.date);
        if (alreadyExists) {
          onShowToast(`Meals for ${u.name} on ${f.date} already logged! Ignoring this row.`, 'error');
          continue;
        }

        toSave.push({
          group_id: myGroup.id,
          user_id: u.user_id,
          date: f.date,
          breakfast: parseFloat(f.breakfast) || 0,
          lunch: parseFloat(f.lunch) || 0,
          dinner: parseFloat(f.dinner) || 0,
          guest_meal_count: parseFloat(f.guest_meal) || 0
        });
      }
    }

    if (toSave.length === 0) {
      onShowToast("No new valid meals to save.", "error");
      return;
    }

    try {
      let successCount = 0;
      for (const meal of toSave) {
        const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meal)
        });
        if (res.ok) successCount++;
      }

      if (successCount > 0) {
        onShowToast(`Successfully saved ${successCount} member meals!`, 'success');
        onMealAdded();

        // Reset only the ones we saved
        setForms(prev => {
          const next = { ...prev };
          toSave.forEach(s => {
            next[s.user_id] = { ...next[s.user_id], breakfast: '', lunch: '', dinner: '', guest_meal: '' };
          });
          return next;
        });
      }

    } catch (err) {
      console.error(err);
      onShowToast("Error saving some meals.", "error");
    }
  };

  return (
    <div className="glass mb-4" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)', textAlign: 'left' }}>
      <h3 style={{ margin: 0, marginBottom: '1.5rem', color: 'var(--text-main)' }}>Add Member Meals</h3>

      <form onSubmit={handleSaveAll}>
        {users.map(u => (
          <div key={u.user_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center', marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ flex: '1 1 120px', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>👤 {u.name}</div>
            <input type="date" className="glass-input" style={{ flex: '1 1 140px', padding: '0.5rem' }} value={forms[u.user_id].date} onChange={e => handleInputChange(u.user_id, 'date', e.target.value)} required />
            <input type="number" placeholder="B.fast" className="glass-input" style={{ flex: '1 1 70px', padding: '0.5rem' }} step="0.5" min="0" value={forms[u.user_id].breakfast} onChange={e => handleInputChange(u.user_id, 'breakfast', e.target.value)} />
            <input type="number" placeholder="Lunch" className="glass-input" style={{ flex: '1 1 70px', padding: '0.5rem' }} step="0.5" min="0" value={forms[u.user_id].lunch} onChange={e => handleInputChange(u.user_id, 'lunch', e.target.value)} />
            <input type="number" placeholder="Dinner" className="glass-input" style={{ flex: '1 1 70px', padding: '0.5rem' }} step="0.5" min="0" value={forms[u.user_id].dinner} onChange={e => handleInputChange(u.user_id, 'dinner', e.target.value)} />
            <input type="number" placeholder="Guest" className="glass-input" style={{ flex: '1 1 70px', padding: '0.5rem' }} step="0.5" min="0" value={forms[u.user_id].guest_meal} onChange={e => handleInputChange(u.user_id, 'guest_meal', e.target.value)} />
          </div>
        ))}
        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '1rem', fontSize: '1rem' }}>Save All Meals</button>
      </form>
    </div>
  );
};

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [authMode, setAuthMode] = useState('login');
  const [authFocus, setAuthFocus] = useState('none');
  const [user, setUser] = useState(null);

  // Group & Dashboard States
  const [userGroups, setUserGroups] = useState([]);
  const [myGroup, setMyGroup] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Toast System
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  // Local Storage Auth Restoration
  useEffect(() => {
    const storedUser = localStorage.getItem('hisab_user');
    const storedGroup = localStorage.getItem('hisab_group');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setCurrentView('dashboard');
    }
    if (storedGroup) {
      setMyGroup(JSON.parse(storedGroup));
    }
  }, []);

  // Forms
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [newGroupName, setNewGroupName] = useState({ unique_name: '', display_name: '', group_type: 'smart_meal' });
  const [joinGroupUsername, setJoinGroupUsername] = useState('');

  // Expenses Form
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'Bazar (Grocery)', date: '', items: '' });

  // Meals Form
  const [mealForm, setMealForm] = useState({ user_id: '', date: new Date().toISOString().split('T')[0], breakfast: '', lunch: '', dinner: '', guest_meal: '' });
  const [editingMealId, setEditingMealId] = useState(null);
  const [editMealForm, setEditMealForm] = useState({ breakfast: '', lunch: '', dinner: '', guest_meal: '' });
  const [mealViewMode, setMealViewMode] = useState('all'); // 'all' or 'mine'

  // Funds Form
  const [fundForm, setFundForm] = useState({ user_id: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [editingFundId, setEditingFundId] = useState(null);
  const [editFundForm, setEditFundForm] = useState({ amount: '', date: '' });

  // Personal Cash States
  const [personalCash, setPersonalCash] = useState([]);
  const [cashForm, setCashForm] = useState({ name: '', ami_pai: '', se_pay: '' });
  const [editingCashId, setEditingCashId] = useState(null);
  const [editCashForm, setEditCashForm] = useState({ ami_pai: '', se_pay: '' });

  // Profile Form
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [profileError, setProfileError] = useState('');

  // Report Form
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Meal Requests
  const [mealRequests, setMealRequests] = useState([]);
  const [mealRequestForm, setMealRequestForm] = useState({ date: new Date().toISOString().split('T')[0], message: '' });

  const fetchPersonalCash = (userId) => {
    fetch(`${API_BASE_URL}/api/users/${userId}/cash`)
      .then(res => res.json())
      .then(data => setPersonalCash(data))
      .catch(err => console.error("Error fetching cash:", err));
  };

  const fetchUserGroups = (userId) => {
    fetch(`${API_BASE_URL}/api/users/${userId}/groups`)
      .then(res => res.json())
      .then(groups => {
        setUserGroups(groups);
        if (groups.length > 0 && !myGroup) {
          setMyGroup(groups[0]);
        }
      })
      .catch(err => console.error("Error fetching groups:", err));
  };

  const fetchDashboard = () => {
    if (!myGroup) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/dashboard`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching dashboard:", err);
        setLoading(false);
      });
  };

  const fetchNotifications = (userId) => {
    fetch(`${API_BASE_URL}/api/users/${userId}/notifications`)
      .then(res => res.json())
      .then(data => setNotifications(data))
      .catch(err => console.error("Error fetching notifications:", err));
  };

  const markNotificationRead = (id) => {
    fetch(`${API_BASE_URL}/api/notifications/${id}/read`, { method: 'PUT' })
      .then(res => {
        if (res.ok) setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      });
  };

  const fetchMealRequests = () => {
    if (myGroup) {
      fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meal_requests`)
        .then(res => res.json())
        .then(data => setMealRequests(data))
        .catch(err => console.error("Error fetching meal requests:", err));
    }
  };

  useEffect(() => {
    if (user && userGroups.length === 0) {
      fetchUserGroups(user.id);
      fetchPersonalCash(user.id);
    }
    if (user) {
      fetchNotifications(user.id);
    }
  }, [user, currentView]);

  useEffect(() => {
    if (myGroup && (currentView === 'dashboard' || currentView === 'expenses')) {
      fetchDashboard();
    }
    if (myGroup && currentView === 'meals') {
      fetchMealRequests();
    }
  }, [currentView, myGroup]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const endpoint = authMode === 'signup' ? '/api/signup' : '/api/login';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.detail || 'Authentication failed');

      setUser(result);
      localStorage.setItem('hisab_user', JSON.stringify(result));
      setCurrentView('dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newGroupName, user_id: user.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Failed to create group');

      setUserGroups([...userGroups, result]);
      setMyGroup(result);
      localStorage.setItem('hisab_group', JSON.stringify(result));
      setNewGroupName({ unique_name: '', display_name: '', group_type: 'smart_meal' });
      setCurrentView('dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleAddMealRequest = async (e) => {
    e.preventDefault();
    if (!myGroup) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meal_requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mealRequestForm, group_id: myGroup.id, user_id: user.id })
      });
      if (res.ok) {
        showToast("Meal request sent!", 'success');
        setMealRequestForm({ date: new Date().toISOString().split('T')[0], message: '' });
        fetchMealRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveMealRequest = async (reqId, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meal_requests/${reqId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchMealRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_unique_name: joinGroupUsername, user_id: user.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Failed to join group');

      setUserGroups([...userGroups, result]);
      setMyGroup(result);
      localStorage.setItem('hisab_group', JSON.stringify(result));
      setJoinGroupUsername('');
      setCurrentView('dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: myGroup.id,
          user_id: user.id,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
          date: expenseForm.date,
          items: expenseForm.items
        })
      });
      if (res.ok) {
        setExpenseForm({ amount: '', category: 'Bazar', date: '', items: '' });
        fetchDashboard(); // Refresh data
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFund = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: myGroup.id,
          user_id: fundForm.user_id || user.id,
          amount: parseFloat(fundForm.amount) || 0.0,
          date: fundForm.date
        })
      });
      if (res.ok) {
        setFundForm({ user_id: fundForm.user_id, amount: '', date: new Date().toISOString().split('T')[0] });
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFund = async (fundId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/funds/${fundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editFundForm.amount) || 0.0,
          date: editFundForm.date
        })
      });
      if (res.ok) {
        setEditingFundId(null);
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMeal = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: myGroup.id,
          user_id: mealForm.user_id || user.id,
          date: mealForm.date,
          breakfast: parseFloat(mealForm.breakfast) || 0.0,
          lunch: parseFloat(mealForm.lunch) || 0.0,
          dinner: parseFloat(mealForm.dinner) || 0.0,
          guest_meal_count: parseFloat(mealForm.guest_meal) || 0.0
        })
      });
      if (res.ok) {
        setMealForm({ user_id: mealForm.user_id, date: new Date().toISOString().split('T')[0], breakfast: '', lunch: '', dinner: '', guest_meal: '' });
        fetchDashboard(); // Refresh data
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMeal = async (mealId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/meals/${mealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakfast: parseFloat(editMealForm.breakfast) || 0.0,
          lunch: parseFloat(editMealForm.lunch) || 0.0,
          dinner: parseFloat(editMealForm.dinner) || 0.0,
          guest_meal_count: parseFloat(editMealForm.guest_meal) || 0.0
        })
      });
      if (res.ok) {
        setEditingMealId(null);
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCash = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cashForm.name,
          ami_pai: parseFloat(cashForm.ami_pai) || 0.0,
          se_pay: parseFloat(cashForm.se_pay) || 0.0
        })
      });
      if (res.ok) {
        setCashForm({ name: '', ami_pai: '', se_pay: '' });
        fetchPersonalCash(user.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCash = async (cashId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}/cash/${cashId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ami_pai: parseFloat(editCashForm.ami_pai) || 0.0,
          se_pay: parseFloat(editCashForm.se_pay) || 0.0
        })
      });
      if (res.ok) {
        setEditingCashId(null);
        fetchPersonalCash(user.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRole = async (memberId, isManager, newTitle) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: memberId,
          is_manager: isManager,
          title: newTitle || (isManager ? 'Manager' : 'Member')
        })
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Failed to update profile');
      setUser(result);
      setIsEditingProfile(false);
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Are you sure you want to kick this member out of the group?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("WARNING: Are you absolutely sure you want to delete this active group completely forever?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMyGroup(null);
        setData(null);
        fetchUserGroups(user.id);
        setCurrentView('dashboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReminder = async (debtorId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${myGroup.id}/remind/${debtorId}`, { method: 'POST' });
      if (res.ok) showToast("Reminder sent successfully!", 'success');
    } catch (err) {
      console.error("Error sending reminder:", err);
    }
  };

  const renderTopBar = () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    return (
      <nav className="topbar glass">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="logo" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
          Mess Management
        </div>
        <div className="nav-right">
          {userGroups.length > 0 && (
            <select className="glass-select group-selector" value={myGroup?.id || ''} onChange={(e) => {
              const selected = userGroups.find(g => g.id === e.target.value);
              setMyGroup(selected);
              if (selected) localStorage.setItem('hisab_group', JSON.stringify(selected));
            }}>
              {userGroups.map(g => <option key={g.id} value={g.id}>{g.display_name}</option>)}
            </select>
          )}

          <div style={{ position: 'relative' }}>
            <button className="nav-btn" onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Bell size={20} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="notifications-dropdown">
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Notifications</h4>
                {notifications.length === 0 ? <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No new notifications.</p> : notifications.map(n => (
                  <div key={n.id} style={{ padding: '0.8rem', background: n.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(139, 92, 246, 0.2)', borderLeft: n.is_read ? 'none' : '3px solid var(--primary)', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <p style={{ margin: 0, color: 'var(--text-main)' }}>{n.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      {!n.is_read && <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }} onClick={() => markNotificationRead(n.id)}>Mark Read</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="nav-btn logout" onClick={() => {
            setUser(null);
            setMyGroup(null);
            setUserGroups([]);
            localStorage.removeItem('hisab_user');
            localStorage.removeItem('hisab_group');
            setCurrentView('login');
          }}>Logout</button>
        </div>
      </nav>
    );
  };

  const renderBottomNav = () => (
    <div className="bottom-nav-container">
      <nav className="bottom-nav">
        <button className={`bottom-nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
          <Home size={20} className="bottom-nav-icon" />
          <span className="nav-text">Home</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'expenses' ? 'active' : ''}`} onClick={() => setCurrentView('expenses')}>
          <Receipt size={20} className="bottom-nav-icon" />
          <span className="nav-text">Expenses</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'funds' ? 'active' : ''}`} onClick={() => setCurrentView('funds')}>
          <Landmark size={20} className="bottom-nav-icon" />
          <span className="nav-text">Funds</span>
        </button>
        {(!myGroup || myGroup.group_type !== 'monthly_avg') && (
          <button className={`bottom-nav-item ${currentView === 'meals' ? 'active' : ''}`} onClick={() => setCurrentView('meals')}>
            <Utensils size={20} className="bottom-nav-icon" />
            <span className="nav-text">Meals</span>
          </button>
        )}
        <button className={`bottom-nav-item ${currentView === 'personal-cash' ? 'active' : ''}`} onClick={() => setCurrentView('personal-cash')}>
          <Wallet size={20} className="bottom-nav-icon" />
          <span className="nav-text">Cash</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'archive' ? 'active' : ''}`} onClick={() => setCurrentView('archive')}>
          <Archive size={20} className="bottom-nav-icon" />
          <span className="nav-text">Archive</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'manage-groups' ? 'active' : ''}`} onClick={() => setCurrentView('manage-groups')}>
          <Users size={20} className="bottom-nav-icon" />
          <span className="nav-text">Groups</span>
        </button>
        <button className={`bottom-nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => setCurrentView('profile')}>
          <User size={20} className="bottom-nav-icon" />
          <span className="nav-text">Profile</span>
        </button>
      </nav>
    </div>
  );

  const renderArchive = () => {
    if (!data) return <p>Loading...</p>;

    const mns = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Filter data for the selected month/year
    const mExpenses = data.raw_expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === parseInt(reportMonth) && d.getFullYear() === parseInt(reportYear);
    });
    const mMeals = data.meals.filter(m => {
      const d = new Date(m.date);
      return d.getMonth() === parseInt(reportMonth) && d.getFullYear() === parseInt(reportYear);
    });
    const mFunds = data.funds.filter(f => {
      const d = new Date(f.date);
      return d.getMonth() === parseInt(reportMonth) && d.getFullYear() === parseInt(reportYear);
    });

    // Calculate aggregations
    const tBazar = mExpenses.reduce((sum, e) => e.category.startsWith('Bazar') ? sum + e.amount : sum, 0);
    const tFixed = mExpenses.reduce((sum, e) => ['Rent', 'Utilities'].includes(e.category) ? sum + e.amount : sum, 0);
    const tMeals = mMeals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count, 0);
    const mealRate = tMeals > 0 ? (tBazar / tMeals) : 0;

    const tFunds = mFunds.reduce((sum, f) => sum + f.amount, 0);
    const tOverallCost = tBazar + tFixed;

    // Build user balances for THIS month ONLY
    let memberBalances = {};
    data.users.forEach(u => memberBalances[u.user_id] = 0);

    // Credits (Expenses paid directly by user this month)
    mExpenses.forEach(e => {
      if (memberBalances[e.user_id] !== undefined) memberBalances[e.user_id] += e.amount;
    });

    // Add direct fund deposits to user (they paid money to manager)
    mFunds.forEach(f => {
      if (memberBalances[f.user_id] !== undefined) memberBalances[f.user_id] += f.amount;
      if (data.manager_id && memberBalances[data.manager_id] !== undefined) memberBalances[data.manager_id] -= f.amount;
    });

    if (data.group_type === 'smart_meal') {
      // Debit for meals consumed
      mMeals.forEach(m => {
        const consumed = m.breakfast + m.lunch + m.dinner + m.guest_meal_count;
        if (memberBalances[m.user_id] !== undefined) {
          memberBalances[m.user_id] -= (consumed * mealRate);
        }
      });

      // Debit for fixed expenses
      if (data.users.length > 0) {
        const ppFixed = tFixed / data.users.length;
        data.users.forEach(u => {
          memberBalances[u.user_id] -= ppFixed;
        });
      }
    } else {
      // Average cost subtraction
      const totalCost = mExpenses.reduce((sum, e) => sum + e.amount, 0);
      if (data.users.length > 0) {
        const ppCost = totalCost / data.users.length;
        data.users.forEach(u => {
          memberBalances[u.user_id] -= ppCost;
        });
      }
    }

    // Settlements specifically for this isolated month
    let debtors = [];
    let creditors = [];
    Object.keys(memberBalances).forEach(uid => {
      const bal = memberBalances[uid];
      if (bal < -0.01) debtors.push({ user: uid, amount: Math.abs(bal) });
      else if (bal > 0.01) creditors.push({ user: uid, amount: bal });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const mSettlements = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settleAmt = Math.min(debtor.amount, creditor.amount);

      const fromName = data.users.find(u => u.user_id === debtor.user)?.name || 'Unknown';
      const toName = data.users.find(u => u.user_id === creditor.user)?.name || 'Unknown';

      mSettlements.push({ from_name: fromName, to_name: toName, amount: settleAmt.toFixed(2) });

      debtor.amount -= settleAmt;
      creditor.amount -= settleAmt;
      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return (
      <div className="page-container glass" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>📅 Monthly Archive Report</h2>
          <button className="btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🖨️ Download PDF
          </button>
        </div>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', textAlign: 'left' }}>পূর্ববর্তী মাসের সম্পূর্ণ হিসাব ডাউনলোড ও দেখার ব্যবস্থা।</p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <select className="glass-input" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
            {mns.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
          </select>
          <select className="glass-input" value={reportYear} onChange={(e) => setReportYear(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <section className="stats-grid mb-4">
          <div className="stat-card glass primary-gradient hover-lift">
            <h3>Meal Rate <br /><span style={{ fontSize: '0.75rem', opacity: 0.8 }}>( {tBazar} ÷ {tMeals} )</span></h3>
            <h2>{mealRate.toFixed(2)} <span className="currency">BDT</span></h2>
          </div>
          <div className="stat-card glass secondary-gradient hover-lift">
            <h3>Total Meals</h3>
            <h2>{tMeals}</h2>
          </div>
          <div className="stat-card glass dark-gradient hover-lift">
            <h3>Total Bazar</h3>
            <h2>{tBazar} <span className="currency">BDT</span></h2>
          </div>
          <div className="stat-card glass dark-gradient hover-lift" style={{ border: '1px solid var(--secondary)' }}>
            <h3>Total Cost</h3>
            <h2>{tOverallCost} <span className="currency">BDT</span></h2>
          </div>
        </section>

        <section className="section glass mb-4" style={{ textAlign: 'left' }}>
          <h2>🏦 Monthly Funds Breakdown</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Total Funds Deposited This Month: <strong>{tFunds} BDT</strong></p>
          <div className="table-responsive">
            <table className="members-table">
              <thead><tr><th>User</th><th>Date</th><th>Amount Deposited</th></tr></thead>
              <tbody>
                {mFunds.map((f, idx) => (
                  <tr key={idx}><td><strong>{f.user}</strong></td><td>{f.date}</td><td style={{ color: 'var(--success)' }}>+{f.amount} BDT</td></tr>
                ))}
                {mFunds.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center' }}>No funds deposited this month.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {data.group_type === 'smart_meal' && (
          <section className="section glass mb-4" style={{ textAlign: 'left' }}>
            <h2>🍽️ Monthly Meal Logs</h2>
            <div className="table-responsive">
              <table className="members-table">
                <thead><tr><th>User</th><th>Date</th><th>Total Daily Meals (B+L+D+G)</th></tr></thead>
                <tbody>
                  {data.users.map(u => {
                    const userMeals = mMeals.filter(m => m.user_id === u.user_id);
                    const userTotal = userMeals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count, 0);
                    if (userTotal === 0) return null;
                    return (
                      <React.Fragment key={u.user_id}>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <td colSpan="2" style={{ color: 'var(--secondary)' }}><strong>{u.name}</strong> - Total Meals this month:</td>
                          <td><strong>{userTotal}</strong></td>
                        </tr>
                        {userMeals.map((m, idx) => {
                          const dailyTotal = m.breakfast + m.lunch + m.dinner + m.guest_meal_count;
                          if (dailyTotal === 0) return null;
                          return (
                            <tr key={`${u.user_id}-${idx}`}>
                              <td style={{ paddingLeft: '2rem' }}>↳</td>
                              <td>{m.date}</td>
                              <td>{dailyTotal} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>(B:{m.breakfast || 0} L:{m.lunch || 0} D:{m.dinner || 0} G:{m.guest_meal_count || 0})</span></td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    );
                  })}
                  {mMeals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count, 0) === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center' }}>No meals logged this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="section glass">
          <h2>💡 Settlement Plan ({mns[reportMonth]} {reportYear})</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>শুধুমাত্র এই মাসের খরচের উপর ভিত্তি করে কে কাকে কত টাকা দিবে:</p>
          <div className="settlement-list">
            {mSettlements.length === 0 ? <p className="all-clear">All clear for this month! 🎉</p> : mSettlements.map((s, idx) => (
              <div key={idx} className="settlement-item glow-on-hover"><span className="from">{s.from_name}</span><span className="arrow">💸 pays ➔</span><span className="to">{s.to_name}</span><span className="settlement-amount">{s.amount} BDT</span></div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  const renderAuth = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at center, #8a2522 0%, #3e0b0a 100%)',
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      zIndex: 9999, fontFamily: 'sans-serif', padding: '1rem'
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', height: '100%', maxHeight: '800px',
        background: '#111111', borderRadius: '35px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden', padding: '3rem 2rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '12px', marginBottom: '1rem' }} />
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.5px' }}>Mess Management</h2>
        </div>

        <h3 style={{ color: 'white', margin: '0 0 1.2rem 0', fontSize: '1.2rem', fontWeight: 600 }}>
          {authMode === 'login' ? 'Sign In' : 'Create Account'}
        </h3>

        {errorMsg && <div style={{ color: '#ff5c35', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500, textAlign: 'center' }}>{errorMsg}</div>}

        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>

          {authMode === 'signup' && (
            <input type="text" placeholder="Username" style={{ width: '100%', padding: '1.1rem 1.2rem', background: '#1c1c1e', border: '1px solid #2c2c2e', color: 'white', fontSize: '0.95rem', outline: 'none', borderRadius: '14px', transition: 'border-color 0.2s' }} value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} required />
          )}

          <input type="email" placeholder="Email" style={{ width: '100%', padding: '1.1rem 1.2rem', background: '#1c1c1e', border: '1px solid #2c2c2e', color: 'white', fontSize: '0.95rem', outline: 'none', borderRadius: '14px', transition: 'border-color 0.2s' }} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />

          <input type="password" placeholder="Password" style={{ width: '100%', padding: '1.1rem 1.2rem', background: '#1c1c1e', border: '1px solid #2c2c2e', color: 'white', fontSize: '0.95rem', outline: 'none', borderRadius: '14px', transition: 'border-color 0.2s' }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />

          {authMode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-0.2rem', marginBottom: '0.5rem' }}>
              <span style={{ color: '#a1a1aa', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>Forgot Password?</span>
            </div>
          )}

          <button type="submit" style={{
            width: '100%', padding: '1.1rem', background: '#ff5c35',
            color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 700,
            cursor: 'pointer', marginTop: authMode === 'signup' ? '1.5rem' : '0.5rem', transition: 'opacity 0.2s'
          }}>
            {authMode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <div style={{ flex: 1 }}></div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 500 }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <span onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setErrorMsg(''); }} style={{ color: '#ff5c35', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', marginLeft: '0.3rem' }}>
              {authMode === 'login' ? 'Sign Up' : 'Sign In'}
            </span>
          </div>

        </form>
      </div>
    </div>
  );

  const renderManageGroups = () => (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      {myGroup && data && (
        <div className="glass group-action-card" style={{ textAlign: 'left', marginBottom: '2rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2>👥 Members of {myGroup.display_name}</h2>
            {data.users.find(u => u.user_id === user.id)?.is_manager && (
              <button className="btn-danger" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={handleDeleteGroup}>🗑️ Delete Group</button>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '0.5rem' }}>Group ID: <strong>{myGroup.unique_name}</strong> - Share this with your friends!</p>
          <div className="table-responsive">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  {data.users.find(u => u.user_id === user.id)?.is_manager && <th>Manage</th>}
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => {
                  const currentUserIsManager = data.users.find(curr => curr.user_id === user.id)?.is_manager;
                  return (
                    <tr key={u.user_id}>
                      <td><strong>{u.name}</strong> {u.user_id === user.id ? ' (You)' : ''}</td>
                      <td>
                        {u.is_manager ? (
                          <span className="role-badge" style={{ color: 'var(--primary)', borderColor: 'var(--primary)', background: 'rgba(139, 92, 246, 0.1)' }}>{u.title || "Manager"}</span>
                        ) : (
                          <span className="role-badge">{u.title || "Member"}</span>
                        )}
                      </td>
                      {currentUserIsManager && (
                        <td>
                          {u.user_id !== data.manager_id && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {!u.is_manager ? (
                                <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleUpdateRole(u.user_id, true, 'Co-Manager')}>Promote</button>
                              ) : (
                                <button className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'transparent' }} onClick={() => handleUpdateRole(u.user_id, false, 'Member')}>Demote</button>
                              )}
                              <input
                                type="text"
                                className="glass-input"
                                style={{ width: '100px', padding: '0.2rem', fontSize: '0.75rem' }}
                                placeholder="Edit Title..."
                                onBlur={(e) => { if (e.target.value) handleUpdateRole(u.user_id, u.is_manager, e.target.value); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) handleUpdateRole(u.user_id, u.is_manager, e.target.value); }}
                              />
                              <button className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--danger)', color: 'white', border: 'none' }} onClick={() => handleRemoveMember(u.user_id)}>Kick</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
        <div className="glass group-action-card" style={{ flex: '1 1 300px' }}>
          <h2>➕ Join a Group</h2>
          <p>Ask your roommate for the Group Unique Username.</p>
          {errorMsg && <div className="error-banner">{errorMsg}</div>}
          <form className="auth-form" onSubmit={handleJoinGroup}>
            <input type="text" placeholder="Group Username ID" className="glass-input" value={joinGroupUsername} onChange={e => setJoinGroupUsername(e.target.value)} required />
            <button type="submit" className="btn-secondary">Join Now</button>
          </form>
        </div>

        <div className="glass group-action-card" style={{ flex: '1 1 300px' }}>
          <h2>🏠 Create New Group</h2>
          <p>Set up a brand new mess group for your flat.</p>
          <form className="auth-form" onSubmit={handleCreateGroup}>
            <input type="text" placeholder="Display Name (e.g. Mirpur Flat)" className="glass-input" value={newGroupName.display_name} onChange={e => setNewGroupName({ ...newGroupName, display_name: e.target.value })} required />
            <input type="text" placeholder="Unique Group Username (e.g. mirpur_mess_5)" className="glass-input" value={newGroupName.unique_name} onChange={e => setNewGroupName({ ...newGroupName, unique_name: e.target.value })} required />
            <select className="glass-input" value={newGroupName.group_type} onChange={e => setNewGroupName({ ...newGroupName, group_type: e.target.value })}>
              <option value="smart_meal">Smart Meal System</option>
              <option value="monthly_avg">Monthly Avg Cost</option>
            </select>
            <button type="submit" className="btn-primary">Create Mess</button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderExpenses = () => {
    if (!data) return <p>Loading...</p>;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonthCost = data.raw_expenses.reduce((sum, e) => {
      const expenseDate = new Date(e.date);
      if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
        return sum + e.amount;
      }
      return sum;
    }, 0);

    const isManager = data.users.find(u => u.user_id === user.id)?.is_manager;

    return (
      <div className="page-container glass" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>💸 Monthly Cost Table - {myGroup?.display_name}</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="glass" style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--primary)', textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Per Person (Avg)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff' }}>{(data.users.length ? thisMonthCost / data.users.length : 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>BDT</span></div>
            </div>
            <div className="glass" style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.2)', border: '1px solid var(--secondary)', textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>This Month's Total</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff' }}>{thisMonthCost} <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>BDT</span></div>
            </div>
          </div>
        </div>

        {isManager ? (
          <form className="expense-form glass mb-4" onSubmit={handleAddExpense}>
            <input type="number" placeholder="Amount (BDT)" className="glass-input" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
            <select className="glass-input" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
              <option value="Bazar (Vegetables)">Bazar (Vegetables)</option>
              <option value="Bazar (Meat/Fish)">Bazar (Meat/Fish)</option>
              <option value="Bazar (Grocery)">Bazar (Grocery)</option>
              <option value="Bazar (Others)">Bazar (Others)</option>
              <option value="Rent">Rent</option>
              <option value="Utilities">Utilities</option>
              <option value="Others">Others</option>
            </select>
            <input type="text" placeholder="Items (e.g., Rice, Fish)" className="glass-input" value={expenseForm.items} onChange={e => setExpenseForm({ ...expenseForm, items: e.target.value })} />
            <input type="date" className="glass-input" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
            <button type="submit" className="btn-primary">Add Expense</button>
          </form>
        ) : (
          <div className="glass group-action-card mb-4" style={{ textAlign: 'left', padding: '1rem', borderLeft: '4px solid var(--secondary)' }}>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem' }}>Only group managers can log shared expenses such as Bazar or Rent. Please contact a manager to record shared costs.</p>
          </div>
        )}

        <div className="table-responsive">
          <table className="members-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Items</th>
                <th>Paid By</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.raw_expenses.map((e, idx) => (
                <tr key={idx}>
                  <td>{e.date}</td>
                  <td><span className="role-badge">{e.category}</span></td>
                  <td>{e.items || '-'}</td>
                  <td><strong>{e.user}</strong> {e.user_id === user.id && '(You)'}</td>
                  <td style={{ fontWeight: 800 }}>{e.amount} BDT</td>
                </tr>
              ))}
              {data.raw_expenses.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No expenses logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    if (!myGroup) return (
      <div className="page-container glass" style={{ marginTop: '2rem' }}>
        <h2>Welcome, {user.username}!</h2>
        <p>You are not in any groups yet. Navigate to 'Manage Groups' to create or join one.</p>
        <button className="btn-primary mt-2" onClick={() => setCurrentView('manage-groups')}>Go to Manage Groups</button>
      </div>
    )

    if (loading) return <div className="loader-container"><div className="loader"></div><p>Loading Dashboard...</p></div>;
    if (!data) return <div className="error">Failed to load data.</div>;

    const isManager = data.users.find(u => u.user_id === user.id)?.is_manager;

    const myBalanceInfo = data.users.find(u => u.user_id === user.id);
    const myBalance = myBalanceInfo ? myBalanceInfo.balance : 0;

    const myFundsTotal = data.funds.reduce((sum, f) => f.user_id === user.id ? sum + f.amount : sum, 0);
    const myExpensesTotal = data.raw_expenses.reduce((sum, e) => e.user_id === user.id ? sum + e.amount : sum, 0);
    const myTotalPaid = myFundsTotal + myExpensesTotal;
    const myTotalCost = myTotalPaid - myBalance;

    const totalGroupFund = data.funds.reduce((sum, f) => sum + f.amount, 0);
    const totalGroupExpense = data.raw_expenses.reduce((sum, e) => sum + e.amount, 0);
    const managerBalance = totalGroupFund - totalGroupExpense;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonthBazar = data.raw_expenses.reduce((sum, e) => {
      const d = new Date(e.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.category.startsWith('Bazar')) return sum + e.amount;
      return sum;
    }, 0);

    const thisMonthMealsCount = data.meals.reduce((sum, m) => {
      const d = new Date(m.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        return sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count;
      }
      return sum;
    }, 0);

    const myThisMonthMealsCount = data.meals.reduce((sum, m) => {
      const d = new Date(m.date);
      if (m.user_id === user.id && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        return sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count;
      }
      return sum;
    }, 0);

    return (
      <div className="dashboard-content">
        <header className="header" style={{ paddingTop: '0' }}>
          <h1>{myGroup.display_name}</h1>
          <p>Group ID: <strong>{myGroup.unique_name}</strong> - Share this with roommates so they can join!</p>
        </header>

        <section className="stats-grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="stat-card glass" style={{ border: managerBalance < 0 ? '2px solid var(--danger)' : '2px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.8rem' }}>গ্রুপ ফান্ড স্ট্যাটাস</h3>
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              {managerBalance >= 0 ? (
                <p style={{ margin: 0, color: '#3b82f6', fontWeight: 'bold', fontSize: '1.05rem' }}>
                  ম্যানেজারের কাছে বর্তমান জমা: <br /><span style={{ fontSize: '1.4rem', color: '#fff' }}>{managerBalance.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span>
                </p>
              ) : (
                <p style={{ margin: 0, color: '#ff6b6b', fontWeight: 'bold', fontSize: '1.05rem' }}>
                  গ্রুপ ফান্ড শেষ! আরও <br /><span style={{ fontSize: '1.4rem', color: '#fff' }}>{Math.abs(managerBalance).toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span> জমা দিতে হবে।
                </p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>সর্বমোট জমা: {totalGroupFund.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span>
              <span>মোট খরচ: {totalGroupExpense.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span>
            </div>
          </div>

          <div className="stat-card glass" style={{ border: (data.group_type === 'smart_meal' || myBalance >= 0) ? '2px solid var(--success)' : '2px solid var(--danger)', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.8rem' }}>আমার ব্যক্তিগত হিসাব</h3>
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              {data.group_type === 'smart_meal' ? (
                <p style={{ margin: 0, color: '#4ade80', fontWeight: 'bold' }}>ফান্ডে আমার মোট জমা: <br /><span style={{ fontSize: '1.4rem', color: '#fff' }}>{myFundsTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span></p>
              ) : myBalance < 0 ? (
                <p style={{ margin: 0, color: '#ff6b6b', fontWeight: 'bold' }}>আপনাকে গ্রুপে আরও <br /><span style={{ fontSize: '1.2rem', color: '#fff' }}>{Math.abs(myBalance).toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span> দিতে হবে।</p>
              ) : myBalance > 0 ? (
                <p style={{ margin: 0, color: '#4ade80', fontWeight: 'bold' }}>আপনি গ্রুপ থেকে <br /><span style={{ fontSize: '1.2rem', color: '#fff' }}>{myBalance.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span> ফেরত পাবেন।</p>
              ) : (
                <p style={{ margin: 0, color: '#facc15', fontWeight: 'bold' }}>আপনার হিসাব সম্পূর্ণ ক্লিয়ার।</p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {data.group_type === 'smart_meal' ? (
                <span style={{ fontStyle: 'italic', width: '100%', textAlign: 'center' }}>মাস শেষে চূড়ান্ত হিসাব দেখানো হবে</span>
              ) : (
                <>
                  <span>আমার মোট জমা: {myTotalPaid.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span>
                  <span>আমার খরচ: {myTotalCost.toLocaleString(undefined, { maximumFractionDigits: 1 })} ৳</span>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="stats-grid mt-4">
          {data.group_type !== 'monthly_avg' ? (
            <>
              {data.group_type === 'smart_meal' && (
                <div className="stat-card glass primary-gradient hover-lift">
                  <h3 style={{ fontSize: '1rem' }}>My Meals <br /><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(This Month)</span></h3>
                  <h2>{myThisMonthMealsCount}</h2>
                </div>
              )}
              <div className="stat-card glass secondary-gradient hover-lift">
                <h3 style={{ fontSize: '1rem' }}>Total Meals <br /><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(This Month)</span></h3>
                <h2>{thisMonthMealsCount}</h2>
              </div>
              <div className="stat-card glass dark-gradient hover-lift">
                <h3 style={{ fontSize: '1rem' }}>Total Bazar <br /><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(This Month)</span></h3>
                <h2>{thisMonthBazar} <span className="currency">BDT</span></h2>
              </div>
              <div className="stat-card glass fixed-gradient hover-lift">
                <h3>Fixed Costs <br /><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(All Time)</span></h3>
                <h2>{data.summary.total_fixed_expenses} <span className="currency">BDT</span></h2>
              </div>
            </>
          ) : (
            <>
              <div className="stat-card glass dark-gradient hover-lift"><h3>Total Group Expenses</h3><h2>{data.summary.total_bazar + data.summary.total_fixed_expenses} <span className="currency">BDT</span></h2></div>
              <div className="stat-card glass secondary-gradient hover-lift"><h3>Member Count</h3><h2>{data.users.length}</h2></div>
            </>
          )}
        </section>

        {/* Expense Breakdown Chart */}
        <section className="section glass mt-4" style={{ textAlign: 'center' }}>
          <h2>📊 Expense Breakdown (All Time)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Total Bazar', value: totalGroupExpense - data.summary.total_fixed_expenses },
                    { name: 'Fixed Costs (Rent/Util)', value: data.summary.total_fixed_expenses }
                  ]}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label
                >
                  <Cell fill="#ec4899" />
                  <Cell fill="#8b5cf6" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="section glass mt-4">
          <h2>👥 Member Balances & Meals</h2>
          <div className="balance-list">
            {data.users.map(u => {
              const userMonthMeals = data.meals.reduce((sum, m) => {
                const d = new Date(m.date);
                if (m.user_id === u.user_id && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                  return sum + m.breakfast + m.lunch + m.dinner + m.guest_meal_count;
                }
                return sum;
              }, 0);

              return (
                <div key={u.user_id} className={`balance-item ${u.balance < 0 ? 'owes' : 'gets-back'} ${u.user_id === user.id ? 'highlight-me' : ''}`}>
                  <div className="user-info">
                    <div className="avatar">{u.name.charAt(0).toUpperCase()}</div>
                    <div className="name-container" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="name">{u.name} {u.user_id === user.id ? '(You)' : ''}</span>
                      {data.group_type !== 'monthly_avg' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Meals this month: <strong>{userMonthMeals}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  {data.group_type === 'smart_meal' ? (
                    <div className="amount-info" style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>হিসাব মাস শেষে দেখানো হবে</span>
                    </div>
                  ) : (
                    <div className="amount-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <div><span className="status-badge">{u.status}</span><span className="amount">{Math.abs(u.balance)} BDT</span></div>
                      {isManager && u.balance < 0 && (
                        <button className="btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px' }} onClick={() => handleSendReminder(u.user_id)}>🔔 Remind</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        {
          isManager && (
            <section className="section glass mt-4" style={{ borderLeft: '4px solid var(--secondary)' }}>
              <h2>💡 Smart Settlement Plan <span className="role-badge" style={{ fontSize: '0.8rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>Manager Only</span></h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>অটোমেটিক সেটেলমেন্ট: সবচেয়ে কম সংখ্যক লেনদেনে সবার টাকা শোধ করার উপায়।</p>
              {data.group_type === 'smart_meal' ? (
                <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <p style={{ color: '#facc15', margin: 0, fontWeight: 'bold' }}>স্মার্ট মিল সিস্টেমে সেটেলমেন্ট প্ল্যান মাস শেষে প্রকাশ করা হবে।</p>
                </div>
              ) : (
                <div className="settlement-list">
                  {data.settlements.length === 0 ? <p className="all-clear">All balances are settled. 🎉</p> : data.settlements.map((s, idx) => (
                    <div key={idx} className="settlement-item glow-on-hover"><span className="from">{s.from_name}</span><span className="arrow">💸 pays ➔</span><span className="to">{s.to_name}</span><span className="settlement-amount">{s.amount} BDT</span></div>
                  ))}
                </div>
              )}
            </section>
          )
        }
      </div >
    );
  };

  const renderProfile = () => (
    <div className="page-container glass" style={{ maxWidth: '600px' }}>
      <h2>👤 Personal Profile</h2>
      <div className="profile-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="profile-avatar">{user?.username?.charAt(0).toUpperCase()}</div>

        {!isEditingProfile ? (
          <>
            <h3 style={{ marginTop: '1rem', marginBottom: '0.2rem' }}>{user?.username}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{user?.email}</p>
            <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => { setIsEditingProfile(true); setProfileForm({ username: user.username, email: user.email }); }}>✏️ Edit Profile</button>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleUpdateProfile} style={{ width: '100%', marginBottom: '1rem', marginTop: '1rem', maxWidth: '300px' }}>
            {profileError && <div className="error-banner">{profileError}</div>}
            <input type="text" placeholder="Username" className="glass-input" value={profileForm.username} onChange={e => setProfileForm({ ...profileForm, username: e.target.value })} required />
            <input type="email" placeholder="Email" className="glass-input" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} required />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn-success" style={{ flex: 1, padding: '0.5rem' }}>Save</button>
              <button type="button" className="btn-danger" style={{ flex: 1, padding: '0.5rem', background: 'transparent' }} onClick={() => { setIsEditingProfile(false); setProfileError(''); }}>Cancel</button>
            </div>
          </form>
        )}

        <div className="mt-4" style={{ textAlign: 'left', width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          <p><strong>Total Groups Joined:</strong> {userGroups.length}</p>
          <ul style={{ listStyle: 'none', marginLeft: 0, marginTop: '0.5rem' }}>
            {userGroups.map(g => <li key={g.id}>✅ {g.display_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({g.unique_name})</span></li>)}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderPersonalCash = () => (
    <div className="page-container glass" style={{ maxWidth: '800px' }}>
      <h2>💵 Personal Hisab (Cash)</h2>
      <p>Tracker for isolated personal debts and lending outside your mess group.</p>

      <div className="glass group-action-card mt-4" style={{ textAlign: 'left', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Add Cash Record</h3>
        <form className="auth-form" onSubmit={handleAddCash} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <input type="text" placeholder="Name (e.g. Karim)" className="glass-input" style={{ gridColumn: 'span 2' }} value={cashForm.name} onChange={e => setCashForm({ ...cashForm, name: e.target.value })} required />
          <input type="number" placeholder="Ami Pai (I get)" className="glass-input" value={cashForm.ami_pai} onChange={e => setCashForm({ ...cashForm, ami_pai: e.target.value })} />
          <input type="number" placeholder="Se Pay (He gets)" className="glass-input" value={cashForm.se_pay} onChange={e => setCashForm({ ...cashForm, se_pay: e.target.value })} />
          <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>Save Cash Record</button>
        </form>
      </div>

      <div className="table-responsive mt-4">
        <table className="members-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Ami Pai (BDT)</th>
              <th>Se Pay (BDT)</th>
              <th>Net Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {personalCash.map(c => {
              const netStr = (c.ami_pai - c.se_pay > 0) ? `+${c.ami_pai - c.se_pay} (I get)` : (c.ami_pai - c.se_pay < 0) ? `${c.ami_pai - c.se_pay} (I owe)` : '0 (Settled)';
              const netColor = (c.ami_pai - c.se_pay > 0) ? 'var(--success)' : (c.ami_pai - c.se_pay < 0) ? 'var(--danger)' : 'var(--text-muted)';

              return (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  {editingCashId === c.id ? (
                    <>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editCashForm.ami_pai} onChange={e => setEditCashForm({ ...editCashForm, ami_pai: e.target.value })} /></td>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editCashForm.se_pay} onChange={e => setEditCashForm({ ...editCashForm, se_pay: e.target.value })} /></td>
                    </>
                  ) : (
                    <>
                      <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{c.ami_pai}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{c.se_pay}</td>
                    </>
                  )}
                  <td><span className="role-badge" style={{ color: netColor }}>{netStr}</span></td>
                  <td>
                    {editingCashId === c.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleUpdateCash(c.id)}>Save</button>
                        <button className="btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingCashId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => { setEditingCashId(c.id); setEditCashForm({ ami_pai: c.ami_pai, se_pay: c.se_pay }); }}>✏️ Edit</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {personalCash.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No personal cash records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSmartMeals = () => {
    if (!data) return <p>Loading...</p>;

    const isManager = data.users.find(u => u.user_id === user.id)?.is_manager;
    const managerName = data.users.find(u => u.user_id === data.manager_id)?.name || 'Manager';
    const displayedMeals = mealViewMode === 'mine' ? data.meals.filter(m => m.user_id === user.id) : data.meals;

    return (
      <div className="page-container glass" style={{ maxWidth: '900px' }}>
        <h2>🍽️ Smart Meal System - {myGroup?.display_name}</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>{isManager ? 'Input daily meals for your mess members.' : 'View meal histories.'}</p>

        {isManager ? (
          <ManagerMealBulkForm users={data.users} myGroup={myGroup} existingMeals={data.meals} onMealAdded={fetchDashboard} onShowToast={showToast} />
        ) : (
          <div className="glass group-action-card mb-4" style={{ textAlign: 'left', padding: '1rem', borderLeft: '4px solid var(--secondary)' }}>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem' }}>Only the group manager can log meals. If you spot an error in your meal history below, please report it to <strong>{managerName}</strong>.</p>
          </div>
        )}

        {/* Meal Requests Section */}
        <div className="glass group-action-card mb-4" style={{ textAlign: 'left', padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>📬 Meal Requests (Start/Stop/Guest)</h3>

          {isManager ? (
            <div>
              {mealRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No pending meal requests.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {mealRequests.filter(r => r.status === 'pending').map(req => (
                    <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px' }}>
                      <div>
                        <strong>{req.user_name}</strong> for {req.date}<br />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.message}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleApproveMealRequest(req.id, 'approved')}>Approve</button>
                        <button className="btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleApproveMealRequest(req.id, 'denied')}>Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleAddMealRequest} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" className="glass-input" style={{ flex: '1 1 200px' }} value={mealRequestForm.date} onChange={e => setMealRequestForm({ ...mealRequestForm, date: e.target.value })} required />
              <input type="text" placeholder="Message (e.g. Stop lunch tomorrow, Add 1 guest)" className="glass-input" style={{ flex: '2 1 300px' }} value={mealRequestForm.message} onChange={e => setMealRequestForm({ ...mealRequestForm, message: e.target.value })} required />
              <button type="submit" className="btn-primary" style={{ padding: '0.8rem 1.5rem' }}>Send Request</button>
            </form>
          )}

          {!isManager && mealRequests.filter(r => r.user_id === user.id).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Your Recent Requests:</h4>
              <ul style={{ listStyle: 'none', fontSize: '0.85rem' }}>
                {mealRequests.filter(r => r.user_id === user.id).map(r => (
                  <li key={r.id} style={{ marginBottom: '0.3rem' }}>
                    {r.date} - {r.message} <span style={{ marginLeft: '0.5rem', fontWeight: 'bold', color: r.status === 'approved' ? 'var(--success)' : r.status === 'denied' ? 'var(--danger)' : 'var(--text-muted)' }}>[{r.status}]</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="auth-tabs mb-4" style={{ justifyContent: 'flex-start' }}>
          <button className={`auth-tab ${mealViewMode === 'all' ? 'active' : ''}`} onClick={() => setMealViewMode('all')}>All User Meals</button>
          <button className={`auth-tab ${mealViewMode === 'mine' ? 'active' : ''}`} onClick={() => setMealViewMode('mine')}>My Meals</button>
        </div>

        <div className="table-responsive">
          <table className="members-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
                <th>Guest</th>
                <th>Total Daily</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedMeals && displayedMeals.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td><strong>{m.user}</strong> {m.user_id === user.id && '(You)'}</td>
                  {editingMealId === m.id ? (
                    <>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editMealForm.breakfast} onChange={e => setEditMealForm({ ...editMealForm, breakfast: e.target.value })} /></td>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editMealForm.lunch} onChange={e => setEditMealForm({ ...editMealForm, lunch: e.target.value })} /></td>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editMealForm.dinner} onChange={e => setEditMealForm({ ...editMealForm, dinner: e.target.value })} /></td>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editMealForm.guest_meal} onChange={e => setEditMealForm({ ...editMealForm, guest_meal: e.target.value })} /></td>
                    </>
                  ) : (
                    <>
                      <td>{m.breakfast || 0}</td>
                      <td>{m.lunch || 0}</td>
                      <td>{m.dinner || 0}</td>
                      <td>{m.guest_meal_count || 0}</td>
                    </>
                  )}
                  <td style={{ fontWeight: 800 }}>{(m.breakfast || 0) + (m.lunch || 0) + (m.dinner || 0) + (m.guest_meal_count || 0)}</td>
                  <td>
                    {editingMealId === m.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleUpdateMeal(m.id)}>Save</button>
                        <button className="btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingMealId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => { setEditingMealId(m.id); setEditMealForm({ breakfast: m.breakfast, lunch: m.lunch, dinner: m.dinner, guest_meal: m.guest_meal_count }); }}>✏️ Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {(!displayedMeals || displayedMeals.length === 0) && (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>No meals logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFunds = () => {
    if (!data || !myGroup) return <p>Loading...</p>;

    const isManager = data.users.find(u => u.user_id === user.id)?.is_manager;
    const managerName = data.users.find(u => u.user_id === data.manager_id)?.name || 'Manager';
    const displayedFunds = data.funds || [];

    const totalGroupFundEver = displayedFunds.reduce((sum, f) => sum + f.amount, 0);

    return (
      <div className="page-container glass" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>🏦 Group Funds - {myGroup.display_name}</h2>
          <div className="glass" style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--success)', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Total Funds Collected (All Time)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff' }}>{totalGroupFundEver} <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}>BDT</span></div>
          </div>
        </div>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>{isManager ? 'Manage monthly deposits from members to the group fund.' : `View the complete group fund history.`}</p>

        {isManager ? (
          <form className="expense-form glass mb-4" onSubmit={handleAddFund} style={{ display: 'flex', flexWrap: 'wrap' }}>
            <select className="glass-input" style={{ flex: '1 1 100%' }} value={fundForm.user_id} onChange={e => setFundForm({ ...fundForm, user_id: e.target.value })} required>
              <option value="">-- Select Member --</option>
              {data.users.map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
            </select>
            <input type="number" placeholder="Deposit Amount (BDT)" className="glass-input" style={{ flex: '1 1 100%' }} min="0" value={fundForm.amount} onChange={e => setFundForm({ ...fundForm, amount: e.target.value })} required />
            <input type="date" className="glass-input" style={{ flex: '1 1 100%' }} value={fundForm.date} onChange={e => setFundForm({ ...fundForm, date: e.target.value })} required />
            <button type="submit" className="btn-success" style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>+ Add Fund</button>
          </form>
        ) : (
          <div className="glass group-action-card mb-4" style={{ textAlign: 'left', padding: '1rem', borderLeft: '4px solid var(--success)' }}>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem' }}>You can view all deposits made to the group manager here. Talk to <strong>{managerName}</strong> if you notice any missing deposits.</p>
          </div>
        )}

        <div className="table-responsive">
          <table className="members-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Amount Deposited</th>
                {isManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedFunds && displayedFunds.map((f) => (
                <tr key={f.id}>
                  {editingFundId === f.id ? (
                    <>
                      <td><input type="date" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editFundForm.date} onChange={e => setEditFundForm({ ...editFundForm, date: e.target.value })} /></td>
                      <td><strong>{f.user}</strong> {f.user_id === user.id && '(You)'}</td>
                      <td><input type="number" className="glass-input" style={{ width: '100%', padding: '0.4rem' }} value={editFundForm.amount} onChange={e => setEditFundForm({ ...editFundForm, amount: e.target.value })} /></td>
                    </>
                  ) : (
                    <>
                      <td>{f.date}</td>
                      <td><strong>{f.user}</strong> {f.user_id === user.id && '(You)'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--success)' }}>+{f.amount} BDT</td>
                    </>
                  )}
                  {isManager && (
                    <td>
                      {editingFundId === f.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleUpdateFund(f.id)}>Save</button>
                          <button className="btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => setEditingFundId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => { setEditingFundId(f.id); setEditFundForm({ amount: f.amount, date: f.date }); }}>✏️ Edit</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {(!displayedFunds || displayedFunds.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: 'center' }}>No funds recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {user && renderTopBar()}
      <main>
        {!user && renderAuth()}
        {user && currentView === 'dashboard' && renderDashboard()}
        {user && currentView === 'expenses' && renderExpenses()}
        {user && currentView === 'funds' && renderFunds()}
        {user && currentView === 'meals' && renderSmartMeals()}
        {user && currentView === 'personal-cash' && renderPersonalCash()}
        {user && currentView === 'manage-groups' && renderManageGroups()}
        {user && currentView === 'archive' && renderArchive()}
        {user && currentView === 'profile' && renderProfile()}
      </main>
      <footer className="footer"><p>Made with ❤️ for Bangladesh Bachelors</p></footer>
      {user && renderBottomNav()}
      {toast.show && (
        <div className="custom-toast-container">
          <div className={`custom-toast ${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
