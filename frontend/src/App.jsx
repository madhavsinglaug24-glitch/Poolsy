import React, { useState, useEffect, useRef, Component } from 'react';
import { apiFetch } from './api';
import './index.css';
import GlassSelect, { CATEGORY_OPTIONS } from './GlassSelect';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Poolsy UI crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px', textAlign: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', borderColor: 'var(--error-border)', background: 'var(--error-bg)' }}>
            <h2 style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '20px' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{this.state.error && this.state.error.toString()}</p>
            <button className="btn outline-btn" onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}



const FormFieldError = ({ message, id }) => {
  if (!message) return null;
  return (
    <div id={id} className="field-error-msg" role="alert" aria-live="polite">
      <span className="field-error-icon">⚠</span>
      <span>{message}</span>
    </div>
  );
};

const ErrorBanner = ({ message, onDismiss }) => {
  const [displayMsg, setDisplayMsg] = useState(message);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (message) {
      setDisplayMsg(message);
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
    }
  }, [message]);

  return (
    <div className={`poolsy-error-banner ${show ? 'show' : ''}`} role="alert">
      <span className="error-banner-icon">⚠</span>
      <span className="error-banner-text">{displayMsg}</span>
      {onDismiss && (
        <button type="button" className="error-banner-dismiss" onClick={onDismiss} aria-label="Dismiss error">✕</button>
      )}
    </div>
  );
};

function App() {
    // Unified Field Error States
  const [authFieldErrors, setAuthFieldErrors] = useState({});
  const [createGroupError, setCreateGroupError] = useState('');
  const [createGroupFieldError, setCreateGroupFieldError] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [joinFieldError, setJoinFieldError] = useState('');
  const [addMemberFieldError, setAddMemberFieldError] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [contributeFieldError, setContributeFieldError] = useState('');
  const [expFieldErrors, setExpFieldErrors] = useState({});
  const [payPoolFieldErrors, setPayPoolFieldErrors] = useState({});
  const [settleFieldError, setSettleFieldError] = useState('');
  const [settingsFieldErrors, setSettingsFieldErrors] = useState({});
  const [renameFieldError, setRenameFieldError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  
  // Auth forms
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setSettingsName(user.name || '');
      setSettingsEmail(user.email || '');
      setSettingsUpiId(user.upi_id || '');
    } else {
      setSettingsName('');
      setSettingsEmail('');
      setSettingsUpiId('');
    }
  }, [user]);

  // App Data
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Handle outside clicks for dropdowns view)
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeGroupData, setActiveGroupData] = useState(null);
  const [loadingActiveGroup, setLoadingActiveGroup] = useState(false);
  const [groupCache, setGroupCache] = useState({}); // { [groupId]: { groupData, summaryData } }
  const groupCacheRef = useRef({});
  // Keep ref in sync with state so async callbacks always read the latest cache
  groupCacheRef.current = groupCache;
  
  // Group Inner Nav
  const [groupTab, setGroupTab] = useState('overview'); // overview, transactions, summary
  
  // Summary Data
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Forms
  const [newGroupName, setNewGroupName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccessMsg, setJoinSuccessMsg] = useState('');
  
  // Add Money Form
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contribAmount, setContribAmount] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [contribError, setContribError] = useState('');

  // Add Expense Form
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expParticipants, setExpParticipants] = useState([]);
  const [expPaidBy, setExpPaidBy] = useState('');
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [expError, setExpError] = useState('');

  // Pool Payment State
  const [showPayPoolModal, setShowPayPoolModal] = useState(false);
  const [poolPaymentMethod, setPoolPaymentMethod] = useState('QR'); // 'QR' or 'UPI_ID'
  const [poolPaymentData, setPoolPaymentData] = useState({
    recipient_name: '',
    recipient_upi_id: '',
    amount: '',
    category: ''
  });
  const [processingPoolPayment, setProcessingPoolPayment] = useState(false);
  const [poolPaymentError, setPoolPaymentError] = useState('');
  const [poolPaymentReceipt, setPoolPaymentReceipt] = useState(null);
  const [poolParticipants, setPoolParticipants] = useState([]);

  // Transaction Modal State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');

  // Global error
  const [globalError, setGlobalError] = useState('');
  
  // Settlement State
  const [showIndividualSettleModal, setShowIndividualSettleModal] = useState(null); // {action: 'pay'|'withdraw', maxAmount: 0}
  const [settleAmount, setSettleAmount] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState('');
  
  // Clear all errors on navigation
  useEffect(() => {
    setGlobalError('');
    setAddMemberError('');
    setContribError('');
    setExpError('');
    setSettleError('');
  }, [activeTab, activeGroupId]);

  // Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsUpiId, setSettingsUpiId] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [initialSettings, setInitialSettings] = useState({ name: '', email: '', upiId: '' });

  // Rename Group State
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Prevent background scrolling when modals are open
  useEffect(() => {
    const isModalOpen = 
      showSettingsModal || 
      showContributeModal || 
      showExpenseModal || 
      showPayPoolModal || 
      showScannerModal || 
      showIndividualSettleModal !== null || 
      confirmModal.isOpen || 
      showRenameGroupModal ||
      poolPaymentReceipt !== null;
      
    if (isModalOpen) {
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    };
  }, [showSettingsModal, showContributeModal, showExpenseModal, showPayPoolModal, showScannerModal, showIndividualSettleModal, confirmModal.isOpen, showRenameGroupModal, poolPaymentReceipt]);
  

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Transaction Receipt Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopyId = (txId) => {
    const displayId = `PYS-${txId.toString().padStart(8, '0')}`;
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (user) {
      setSettingsName(user.name || '');
      setSettingsEmail(user.email || '');
      setSettingsUpiId(user.upi_id || '');
    } else {
      setSettingsName('');
      setSettingsEmail('');
      setSettingsUpiId('');
    }
  }, [user]);

  // ---------------- AUTHENTICATION ----------------
  const handleAuth = async (e) => {
    e.preventDefault();
    let hasError = false;
    const errors = {};
    if (!isLogin && !authName.trim()) { errors.name = 'Please enter your name.'; hasError = true; }
    if (!authEmail.trim()) { errors.email = 'Please enter your email.'; hasError = true; }
    if (!authPassword.trim()) { errors.password = 'Please enter a password.'; hasError = true; }
    
    if (hasError) {
      setAuthFieldErrors(errors);
      return;
    }
    
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isLogin) {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: authEmail, password: authPassword })
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Reset all open modals & active group state for fresh login session
        setShowSettingsModal(false);
        setShowContributeModal(false);
        setShowExpenseModal(false);
        setShowPayPoolModal(false);
        setShowScannerModal(false);
        setShowIndividualSettleModal(null);
        setSelectedTx(null);
        setPoolPaymentReceipt(null);
        setActiveGroupId(null);
        setActiveGroupData(null);
        setSummaryData(null);
        setGroupCache({});
        groupCacheRef.current = {};
        setAuthPassword('');

        setToken(data.token);
        setUser(data.user);
      } else {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
        });
        setIsLogin(true);
        setAuthError('Registration successful. Please log in.');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const isAuthError = (err) => {
    if (!err || !err.message) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('token') || msg.includes('expired') || msg.includes('session');
  };

  useEffect(() => {
    const handleExpired = () => handleLogout();
    window.addEventListener('auth-session-expired', handleExpired);
    return () => window.removeEventListener('auth-session-expired', handleExpired);
  }, []);

  // Navigation & History Sync
  useEffect(() => {
    if (token && !window.history.state?.appState) {
      window.history.replaceState({ appState: 'dashboard' }, '');
    }
  }, [token]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.appState === 'group') {
        setActiveGroupId(e.state.activeGroupId);
        setActiveTab('dashboard');
      } else if (e.state?.appState === 'dashboard') {
        setActiveGroupId(null);
        setActiveTab('dashboard');
      } else if (e.state?.appState === 'settings') {
        setActiveGroupId(null);
        setActiveTab('settings');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Close all open modals
    setShowSettingsModal(false);
    setShowContributeModal(false);
    setShowExpenseModal(false);
    setShowPayPoolModal(false);
    setShowScannerModal(false);
    setShowIndividualSettleModal(null);
    setSelectedTx(null);
    setPoolPaymentReceipt(null);
    
    // Reset app & group states
    setGroups([]);
    setActiveGroupId(null);
    setActiveGroupData(null);
    setSummaryData(null);
    setGroupCache({});
    groupCacheRef.current = {};
    
    // Reset forms & auth
    setToken(null);
    setUser(null);
    setSettingsError('');
    setSettingsSuccess('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthError('');
    window.history.replaceState(null, '');
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await apiFetch('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: settingsName || undefined,
          email: settingsEmail || undefined,
          password: settingsPassword || undefined,
          upi_id: settingsUpiId || undefined
        })
      });
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
      setSettingsSuccess('Settings updated successfully!');
      setSettingsPassword('');
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setSettingsError(err.message);
    }
  };

  // ---------------- DATA FETCHING ----------------
  const fetchGroups = async () => {
    if (!token) return;
    setLoadingGroups(true);
    try {
      const data = await apiFetch('/api/groups');
      setGroups(data);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setGlobalError(err.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupDetails = async (id) => {
    // Cache-first: only show loading state if no cached data exists
    const cached = groupCacheRef.current[id];
    if (!cached?.groupData) {
      setLoadingActiveGroup(true);
    }
    
    // Pre-fetch summary data in background so the Summary tab opens smoothly
    fetchGroupSummary(id);

    try {
      const gData = await apiFetch(`/api/groups/${id}`);
      // Write to cache
      setGroupCache(prev => ({
        ...prev,
        [id]: { ...prev[id], groupData: gData }
      }));
      groupCacheRef.current = { ...groupCacheRef.current, [id]: { ...groupCacheRef.current[id], groupData: gData } };
      // Only update active display if this group is still selected (race guard)
      setActiveGroupId(currentId => {
        if (currentId === id) {
          setActiveGroupData(gData);
        }
        return currentId;
      });
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setGlobalError(err.message);
    } finally {
      setLoadingActiveGroup(false);
    }
  };

  const fetchGroupSummary = async (id) => {
    // Cache-first: only show loading state if no cached summary exists
    const cached = groupCacheRef.current[id];
    if (!cached?.summaryData) {
      setLoadingSummary(true);
    }
    try {
      const data = await apiFetch(`/api/groups/${id}/summary`);
      // Write to cache
      setGroupCache(prev => ({
        ...prev,
        [id]: { ...prev[id], summaryData: data }
      }));
      groupCacheRef.current = { ...groupCacheRef.current, [id]: { ...groupCacheRef.current[id], summaryData: data } };
      // Only update active display if this group is still selected (race guard)
      setActiveGroupId(currentId => {
        if (currentId === id) {
          setSummaryData(data);
        }
        return currentId;
      });
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setGlobalError(err.message);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (token) fetchGroups();
  }, [token]);

  useEffect(() => {
    if (activeGroupId) {
       setGroupTab('overview');
       // Restore cached data immediately if available
       const cached = groupCacheRef.current[activeGroupId];
       if (cached?.groupData) {
         setActiveGroupData(cached.groupData);
       }
       if (cached?.summaryData) {
         setSummaryData(cached.summaryData);
       } else {
         setSummaryData(null);
       }
       // Always fetch in background to keep data fresh
       fetchGroupDetails(activeGroupId);
    }
  }, [activeGroupId]);

  useEffect(() => {
    if (activeGroupId && groupTab === 'summary') {
      // Restore cached summary immediately if available
      const cached = groupCacheRef.current[activeGroupId];
      if (cached?.summaryData) {
        setSummaryData(cached.summaryData);
      }
      // Fetch if not cached (or refresh in background if cached)
      if (!cached?.summaryData) {
        fetchGroupSummary(activeGroupId);
      }
    }
  }, [groupTab, activeGroupId]);

  // ---------------- GROUP ACTIONS ----------------
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setCreateGroupFieldError('Please enter a group name.');
      return;
    }
    if (isCreatingGroup) return;
    setIsCreatingGroup(true);
    setCreateGroupError('');
    try {
      const data = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName }),
      });
      setGroups(prev => [...prev, { ...data, member_count: data.member_count || 1, pool_balance: data.pool_balance || 0 }]);
      setNewGroupName('');
      window.history.pushState({ appState: 'group', activeGroupId: data.id }, '');
      setActiveGroupId(data.id);
      setActiveTab('dashboard');
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setCreateGroupError(err.message || 'Unable to create the group.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      setJoinFieldError('Please enter an invite code.');
      return;
    }
    
    setIsJoining(true);
    setJoinError('');
    setJoinSuccessMsg('');
    
    try {
      const data = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: code })
      });
      
      setJoinCode('');
      setJoinSuccessMsg(`Group joined successfully`);
      
      setTimeout(() => setJoinSuccessMsg(''), 3000);
      
      setGroups(prev => {
        if (prev.some(g => g.id === data.id)) return prev;
        return [...prev, { ...data, pool_balance: data.pool_balance || 0, member_count: data.member_count || 1 }];
      });
      
      window.history.pushState({ appState: 'group', activeGroupId: data.id }, '');
      setActiveGroupId(data.id);
      setActiveTab('dashboard');
      setJoinSuccessMsg('Successfully joined the group!');
    } catch (err) {
      if (isAuthError(err)) {
        handleLogout();
      } else {
        setJoinError(err.message || 'Unable to join the group. Please try again.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleRenameGroup = async (e) => {
    e.preventDefault();
    setRenameError('');
    setRenameFieldError('');

    if (!renameGroupName.trim()) {
      setRenameFieldError('Please enter a group name.');
      return;
    }

    setRenamingGroup(true);
    try {
      const data = await apiFetch(`/api/groups/${activeGroupId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: renameGroupName.trim() })
      });
      setActiveGroupData(prev => prev ? { ...prev, name: data.group.name } : null);
      setGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, name: data.group.name } : g));
      setShowRenameGroupModal(false);
      setRenameGroupName('');
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setRenameError(err.message || 'Failed to rename group.');
    } finally {
      setRenamingGroup(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail || !activeGroupId) return;
    setAddMemberError('');
    try {
      await apiFetch(`/api/groups/${activeGroupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: newMemberEmail })
      });
      setNewMemberEmail('');
      setShowAddMemberModal(false);
      fetchGroupDetails(activeGroupId);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setAddMemberError(err.message);
    }
  };

  const handleRemoveMember = (userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the group?',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/groups/${activeGroupId}/members/${userId}`, {
            method: 'DELETE'
          });
          if (userId === user.id) {
            window.history.pushState({ appState: 'dashboard' }, '');
            setActiveGroupId(null);
            setActiveTab('dashboard');
            fetchGroups();
          } else {
            fetchGroupDetails(activeGroupId);
            if (groupTab === 'summary') fetchGroupSummary(activeGroupId);
          }
        } catch (err) {
          if (isAuthError(err)) handleLogout();
          else setGlobalError(err.message || 'Failed to remove member.');
        }
      }
    });
  };

  // ---------------- SHARED POOL TRANSACTIONS ----------------
  const handleAddMoney = async (e) => {
    e.preventDefault();
    const amt = parseFloat(contribAmount);
    if (!contribAmount || isNaN(amt) || amt <= 0) {
      setContributeFieldError('Enter a valid positive amount.');
      return;
    }
    setAddingMoney(true);
    setContribError('');
    try {
      await apiFetch(`/api/groups/${activeGroupId}/contribute`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(contribAmount) })
      });
      setShowContributeModal(false);
      setContribAmount('');
      fetchGroupDetails(activeGroupId);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setContribError(err.message);
    } finally {
      setAddingMoney(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    let hasError = false;
    const errors = {};
    const amt = parseFloat(expAmount);
    if (!expAmount || isNaN(amt) || amt <= 0) { errors.amount = 'Enter a valid positive amount.'; hasError = true; }
    if (!expCategory) { errors.category = 'Select a category.'; hasError = true; }
    if (expParticipants.length === 0) { errors.participants = 'Select at least one participant.'; hasError = true; }
    if (!expPaidBy) { errors.paidBy = 'Select who paid.'; hasError = true; }

    if (hasError) {
      setExpFieldErrors(errors);
      return;
    }
    
    setCreatingExpense(true);
    setExpError('');
    try {
      await apiFetch(`/api/groups/${activeGroupId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(expAmount),
          category: expCategory,
          description: expDesc,
          participants: expParticipants,
          paid_by: expPaidBy ? parseInt(expPaidBy) : user.id
        })
      });
      setShowExpenseModal(false);
      setExpAmount('');
      setExpCategory('');
      setExpDesc('');
      setExpParticipants([]);
      setExpPaidBy('');
      fetchGroupDetails(activeGroupId);
      if (groupTab === 'summary') fetchGroupSummary(activeGroupId);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setExpError(err.message);
    } finally {
      setCreatingExpense(false);
    }
  };

  const handleIndividualSettle = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!settleAmount || isNaN(amt) || amt <= 0) {
      setSettleFieldError('Enter a valid positive amount.');
      return;
    }
    setSettling(true);
    setSettleError('');
    try {
      await apiFetch(`/api/groups/${activeGroupId}/settle/individual`, { 
        method: 'POST',
        body: JSON.stringify({
          action: showIndividualSettleModal.action,
          amount: parseFloat(settleAmount)
        })
      });
      setShowIndividualSettleModal(null);
      setSettleAmount('');
      fetchGroupDetails(activeGroupId);
      fetchGroupSummary(activeGroupId);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setSettleError(err.message);
    } finally {
      setSettling(false);
    }
  };

  const handleSettleGroup = async () => {
    setSettling(true);
    setSettleError('');
    try {
      await apiFetch(`/api/groups/${activeGroupId}/settle`, {
        method: 'POST'
      });
      fetchGroupDetails(activeGroupId);
      fetchGroupSummary(activeGroupId);
    } catch (err) {
      if (isAuthError(err)) handleLogout();
      else setSettleError(err.message);
    } finally {
      setSettling(false);
    }
  };

  // ---------------- RECEIPT SCANNER ----------------
  const handleScanReceipt = async (e) => {
    e.preventDefault();
    if (!receiptFile || !activeGroupId) return;
    
    setScanning(true);
    setScanError('');
    
    const formData = new FormData();
    formData.append('receipt', receiptFile);
    
    try {
      const data = await apiFetch('/api/receipts/scan', {
        method: 'POST',
        body: formData
      });
      setScanResult(data);
    } catch (err) {
      if (err.message.includes('Token') || err.message.includes('token')) handleLogout();
      else setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const submitScannedExpense = async () => {
    if (!scanResult) return;
    setScanning(true);
    try {
      await apiFetch(`/api/groups/${activeGroupId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(scanResult.total_amount),
          description: `${scanResult.merchant} - ${scanResult.category}`,
          category: scanResult.category,
          participants: activeGroupData.members.map(m => m.id)
        })
      });
      setShowScannerModal(false);
      setScanResult(null);
      setReceiptFile(null);
      fetchGroupDetails(activeGroupId);
      if (groupTab === 'summary') fetchGroupSummary(activeGroupId);
    } catch (err) {
      if (err.message.includes('Token') || err.message.includes('token')) handleLogout();
      else setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handlePoolPayment = async (e) => {
    e?.preventDefault();
    if (processingPoolPayment) return;
    
    let hasError = false;
    const errors = {};
    const amt = parseFloat(poolPaymentData.amount);
    if (!poolPaymentData.amount || isNaN(amt) || amt <= 0) { errors.amount = 'Enter a valid positive amount.'; hasError = true; }
    if (!poolPaymentData.recipient_name?.trim()) { errors.recipient_name = 'Enter recipient name.'; hasError = true; }
    if (!poolPaymentData.recipient_upi_id?.trim()) { errors.recipient_upi_id = 'Enter UPI ID.'; hasError = true; }
    
    if (hasError) {
      setPayPoolFieldErrors(errors);
      return;
    }

    setProcessingPoolPayment(true);
    setPoolPaymentError('');
    
    try {
      const res = await apiFetch(`/api/groups/${activeGroupId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(poolPaymentData.amount),
          recipient_name: poolPaymentData.recipient_name,
          recipient_upi_id: poolPaymentData.recipient_upi_id,
          payment_method: poolPaymentMethod === 'CONFIRM_DEMO' ? 'QR' : poolPaymentMethod,
          category: poolPaymentData.category || 'Other',
          participants: poolParticipants.length > 0 ? poolParticipants : (activeGroupData?.members.map(m => m.id) || [])
        })
      });
      
      setPoolPaymentReceipt({
        ...poolPaymentData,
        receipt_id: res.receipt_id,
        created_at: new Date().toISOString()
      });
      
      // Clear form
      setPoolPaymentData({ recipient_name: '', recipient_upi_id: '', amount: '', category: '' });
      fetchGroupDetails(activeGroupId);
      if (groupTab === 'summary') fetchGroupSummary(activeGroupId);
    } catch (err) {
      if (err.message.includes('Token') || err.message.includes('token')) handleLogout();
      else setPoolPaymentError(err.message);
    } finally {
      setProcessingPoolPayment(false);
    }
  };

  // ---------------- RENDER AUTH ----------------
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="text-center">
            <h1 className="poolsy-brand auth-logo">Poolsy</h1>
            <p className="auth-tagline">Shared expenses. One common pool.</p>
          </div>
          
          {authError && (
            <div className="mb-6 p-4" style={{ background: 'rgba(201, 107, 114, 0.05)', borderRadius: '12px', border: '1px solid rgba(201, 107, 114, 0.2)' }}>
              <p className="text-danger" style={{ margin: 0, fontSize: '15px', textAlign: 'center' }}>{authError}</p>
            </div>
          )}
          
          <form onSubmit={handleAuth} noValidate className="flex flex-col gap-6">
            {!isLogin && (
              <div>
                <label>Name</label>
                <input 
                  className={`premium-input ${authFieldErrors.name ? 'input-error' : ''}`} 
                  type="text" 
                  placeholder="Your name" 
                  value={authName} 
                  onChange={(e) => {
                    setAuthName(e.target.value);
                    if (authFieldErrors.name) setAuthFieldErrors(prev => ({ ...prev, name: '' }));
                  }}
                  aria-invalid={!!authFieldErrors.name}
                  aria-describedby={authFieldErrors.name ? 'auth-name-error' : undefined}
                />
                <FormFieldError message={authFieldErrors.name} id="auth-name-error" />
              </div>
            )}
            <div>
              <label>Email</label>
              <input 
                className={`premium-input ${authFieldErrors.email ? 'input-error' : ''}`} 
                type="email" 
                placeholder="name@example.com" 
                value={authEmail} 
                onChange={(e) => {
                  setAuthEmail(e.target.value);
                  if (authFieldErrors.email) setAuthFieldErrors(prev => ({ ...prev, email: '' }));
                }}
                aria-invalid={!!authFieldErrors.email}
                aria-describedby={authFieldErrors.email ? 'auth-email-error' : undefined}
              />
              <FormFieldError message={authFieldErrors.email} id="auth-email-error" />
            </div>
            <div>
              <label>Password</label>
              <input 
                className={`premium-input ${authFieldErrors.password ? 'input-error' : ''}`} 
                type="password" 
                placeholder="••••••••" 
                value={authPassword} 
                onChange={(e) => {
                  setAuthPassword(e.target.value);
                  if (authFieldErrors.password) setAuthFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                aria-invalid={!!authFieldErrors.password}
                aria-describedby={authFieldErrors.password ? 'auth-password-error' : undefined}
              />
              <FormFieldError message={authFieldErrors.password} id="auth-password-error" />
            </div>
            
            <button type="submit" className="btn primary-btn mt-2" disabled={authLoading}>
              {authLoading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>
          
          <div className="text-center mt-6">
            <p className="text-muted" style={{ fontSize: '15px' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <strong style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '600' }} onClick={() => {setIsLogin(!isLogin); setAuthError('');}}>
                {isLogin ? 'Register' : 'Login'}
              </strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- RENDER APP ----------------
  return (
    <div className="app-wrapper">
      <header className="app-header">
        {/* LEFT: Logo */}
        <div className="header-left">
          <h2 className="poolsy-brand" style={{ cursor: 'pointer' }} onClick={() => { 
            if (activeGroupId || activeTab !== 'dashboard') window.history.pushState({ appState: 'dashboard' }, '');
            setActiveTab('dashboard'); 
            setActiveGroupId(null); 
            fetchGroups(); 
          }}>
            Poolsy
          </h2>
        </div>

        {/* CENTER: Navigation — mathematically centered */}
        <div className="header-center">
          <nav className="app-nav">
            <div className="nav-links">
              <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => {
                if (activeGroupId || activeTab !== 'dashboard') window.history.pushState({ appState: 'dashboard' }, '');
                setActiveTab('dashboard'); 
                setActiveGroupId(null); 
                fetchGroups();
              }}>Dashboard</button>
              <button className={`nav-link ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>Groups</button>
            </div>
          </nav>
        </div>

        {/* RIGHT: Avatar */}
        <div className="header-right">
          <div 
            onClick={() => {
              const uName = user?.name || '';
              const uEmail = user?.email || '';
              const uUpi = user?.upi_id || '';
              setSettingsName(uName);
              setSettingsEmail(uEmail);
              setSettingsUpiId(uUpi);
              setSettingsPassword('');
              setInitialSettings({ name: uName, email: uEmail, upiId: uUpi });
              setSettingsError('');
              setSettingsSuccess('');
              setSettingsFieldErrors({});
              setShowSettingsModal(true);
            }} 
            className="profile-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #5d78e8, #425abf)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(93, 120, 232, 0.35)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              flexShrink: 0,
            }}
            title="Settings"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(93, 120, 232, 0.45)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(93, 120, 232, 0.35)'; }}
          >
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      <div className="main-container">
        <ErrorBanner message={globalError} onDismiss={() => setGlobalError('')} />

        <main>
          {/* DASHBOARD TAB (Home Overview) */}
          {activeTab === 'dashboard' && !activeGroupId && (
            <div className="view-page-enter">
              <div className="mb-8">
                <h2 className="page-title">{getGreeting()}, {user?.name?.split(' ')[0] || 'User'}</h2>
                <p className="page-subtitle">Your shared group wallets overview.</p>
              </div>
              
              <div>
                <h3>Your Groups</h3>
                {loadingGroups && groups.length === 0 ? (
                  <div className="groups-grid">
                    <div className="glass-card skeleton-box" style={{ height: '100px' }}></div>
                    <div className="glass-card skeleton-box" style={{ height: '100px' }}></div>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="empty-state mt-4">
                    <h3>No groups yet</h3>
                    <p className="text-muted">Create your first group or join an existing one to start tracking shared pools.</p>
                    <div className="flex justify-center gap-4 mt-6">
                      <button className="btn primary-btn" onClick={() => setActiveTab('groups')}>Create / Join Group</button>
                    </div>
                  </div>
                ) : (
                  <div className="groups-grid">
                    {groups.map(g => (
                      <div key={g.id} className="glass-card cursor-pointer group-card" onClick={() => { 
                        window.history.pushState({ appState: 'group', activeGroupId: g.id }, '');
                        setGroupTab('overview'); 
                        // Use cached group data if available, otherwise use a minimal skeleton
                        const cached = groupCacheRef.current[g.id];
                        if (cached?.groupData) {
                          setActiveGroupData(cached.groupData);
                          if (cached.summaryData) {
                            setSummaryData(cached.summaryData);
                          }
                        } else {
                          setActiveGroupData(prev => (prev?.id === g.id ? prev : {
                            id: g.id,
                            name: g.name,
                            pool_balance: g.pool_balance,
                            invite_code: g.invite_code || '',
                            members: [],
                            transactions: []
                          }));
                        }
                        setActiveGroupId(g.id); 
                        setActiveTab('dashboard'); 
                      }}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 style={{ margin: 0, fontSize: '18px' }}>{g.name}</h4>
                          <span className="text-muted" style={{ fontSize: '14px' }}>{g.member_count} members</span>
                        </div>
                        <div className="pool-summary">
                          <span className="text-muted">Pool Balance</span>
                          <span className="pool-amount">₹{g.pool_balance.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACTIVE GROUP VIEW (Shared Pool Dashboard) */}
          {activeTab === 'dashboard' && activeGroupId && (
            <div className="view-page-enter">
               <div style={{ marginBottom: '20px' }}>
                 <button onClick={() => {
                   window.history.pushState({ appState: 'dashboard' }, '');
                   setActiveGroupId(null); 
                   fetchGroups();
                 }} className="btn back-btn">← Back</button>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                   <h1 className="page-title" style={{ margin: 0, fontSize: 'clamp(28px, 3.5vw, 40px)' }}>{activeGroupData ? activeGroupData.name : 'Loading Group...'}</h1>
                   {activeGroupData && (
                     <button 
                       onClick={() => {
                         setRenameGroupName(activeGroupData.name);
                         setRenameError('');
                         setShowRenameGroupModal(true);
                       }}
                       className="header-icon-btn"
                       title="Rename Group"
                       aria-label="Rename Group"
                     >
                       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                       </svg>
                     </button>
                   )}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                   <span className="page-subtitle" style={{ fontSize: '14px' }}>{activeGroupData ? activeGroupData.members.length + ' members' : ''}</span>
                   {activeGroupData?.invite_code && (
                     <>
                       <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>·</span>
                       <span className="text-muted" style={{ fontSize: '14px' }}>Invite Code:</span>
                       <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: '14px', fontWeight: 600 }}>{activeGroupData.invite_code}</span>
                       <button 
                         className="header-icon-btn"
                         title="Copy invite code"
                         aria-label="Copy invite code"
                         onClick={() => {
                           navigator.clipboard.writeText(activeGroupData.invite_code);
                           setCopiedInvite(true);
                           setTimeout(() => setCopiedInvite(false), 2000);
                         }}
                       >
                         {copiedInvite ? (
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                             <polyline points="20 6 9 17 4 12" />
                           </svg>
                         ) : (
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                           </svg>
                         )}
                       </button>
                     </>
                   )}
                 </div>
               </div>
               {activeGroupData && (
                 <div className="action-grid" style={{ gridTemplateColumns: '1fr' }}>
                   
                   <div className="flex gap-4" style={{ marginBottom: '4px' }}>
                     <button className={`btn tab-btn ${groupTab === 'overview' ? 'active' : ''}`} onClick={() => setGroupTab('overview')}>Overview</button>
                     <button className={`btn tab-btn ${groupTab === 'transactions' ? 'active' : ''}`} onClick={() => setGroupTab('transactions')}>Transactions</button>
                     <button className={`btn tab-btn ${groupTab === 'summary' ? 'active' : ''}`} onClick={() => {
                       // Synchronously restore cached summary before switching tab to prevent blank flash
                       const cached = groupCacheRef.current[activeGroupId];
                       if (cached?.summaryData) {
                         setSummaryData(cached.summaryData);
                       }
                       setGroupTab('summary');
                     }}>Summary</button>
                   </div>
                   
                   {/* Central Pool Dashboard - Always visible on overview */}
                   <div style={{ display: groupTab === 'overview' ? undefined : 'none' }}>
                     <div className="pool-dashboard-card text-center" style={{ marginTop: '16px', marginBottom: '16px' }}>
                       <p className="text-muted" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', fontWeight: '600' }}>Shared Pool Balance</p>
                       {activeGroupData.pool_balance < 0 ? (
                         <div style={{ margin: '12px 0' }}>
                           <div className="pool-balance-large" style={{ color: '#ff3b30' }}>
                             ₹{activeGroupData.pool_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                           </div>
                           <div style={{ background: 'rgba(255, 59, 48, 0.12)', border: '1px solid rgba(255, 59, 48, 0.3)', borderRadius: '12px', padding: '8px 16px', display: 'inline-block', color: '#ff3b30', fontSize: '13px', fontWeight: 600 }}>
                             ⚠️ Accounting Inconsistency Detected
                           </div>
                           {console.error("Accounting Inconsistency Detected: Pool balance is negative", activeGroupData.pool_balance)}
                         </div>
                       ) : (
                         <h2 className="pool-balance-large">₹{activeGroupData.pool_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</h2>
                       )}
                       
                       <div className="flex justify-center gap-4" style={{ marginTop: '20px' }}>
                         <button className="btn secondary-btn" onClick={() => setShowContributeModal(true)}>Add Money</button>
                          <button className="btn primary-btn" onClick={() => {
                            setPoolPaymentData({
                              recipient_name: '',
                              recipient_upi_id: '',
                              amount: '',
                              category: ''
                            });
                            setPoolPaymentMethod('QR');
                            setShowPayPoolModal(true);
                          }}>Pay from Pool</button>
                         <button className="btn secondary-btn" onClick={() => {
                           setExpParticipants(activeGroupData.members.map(m => m.id));
                           setExpCategory('');
                           setExpPaidBy(user?.id || '');
                           setShowExpenseModal(true);
                         }}>Add Expense</button>
                       </div>
                     </div>
                   </div>

                   {/* Overview Tab Content */}
                   <div style={{ display: groupTab === 'overview' ? undefined : 'none' }}>
                      <div className="overview-grid" key="overview">
                     {/* Unified Transaction Ledger */}
                     <div className="glass-card" style={{ height: '100%' }}>
                       <h3 className="mb-4">Recent Activity</h3>
                       
                       {loadingActiveGroup && activeGroupData.transactions.length === 0 ? (
                         <div className="empty-state" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                           <div className="loading-spinner"></div>
                           <p className="text-muted" style={{ margin: 0 }}>Loading transactions...</p>
                         </div>
                       ) : activeGroupData.transactions.length === 0 ? (
                         <div className="empty-state" style={{ padding: '32px 16px' }}>
                           <p className="text-muted" style={{ margin: 0 }}>No transactions yet in this pool.</p>
                         </div>
                       ) : (
                         <div className="flex flex-col gap-3">
                           {activeGroupData.transactions
                             .filter(tx => tx.user?.id === user.id || (tx.participants && tx.participants.some(p => p.id === user.id)))
                             .map((tx) => {
                              if (tx.type === 'contribution' || tx.type === 'settlement_deposit') {
                                return (
                                  <div key={tx.id} className="transaction-card contribution-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↑ {tx.type === 'contribution' ? 'Added to Shared Pool' : 'Settlement Deposit'}</div>
                                      <div className="tx-date">Added by {tx.user?.name || 'Unknown'}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>+₹{tx.amount.toLocaleString('en-IN')}</strong>
                                  </div>
                                )
                              } else {
                                const title = tx.description || tx.category || 'Transaction';
                                const payerText = tx.type === 'pool_payment' ? 'Paid from Pool' : `Paid by ${tx.user?.name || 'Unknown'}`;
                                return (
                                  <div key={tx.id} className="transaction-card expense-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↓ {title}</div>
                                      <div className="tx-date">{payerText}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>−₹{tx.amount.toLocaleString('en-IN')}</strong>
                                  </div>
                                )
                              }
                            })}
                         </div>
                       )}
                     </div>

                     {/* Members Panel */}
                     <div className="glass-card h-fit">
                       <h3 className="mb-4">Group Members</h3>
                       
                       <div className="flex flex-col gap-3 mb-2">
                         {loadingActiveGroup && activeGroupData.members.length === 0 ? (
                           <div className="empty-state" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                             <div className="loading-spinner"></div>
                             <p className="text-muted" style={{ margin: 0 }}>Loading members...</p>
                           </div>
                         ) : (
                           [...activeGroupData.members].sort((a, b) => {
                             if (a.id === user.id) return -1;
                             if (b.id === user.id) return 1;
                             return a.name.localeCompare(b.name);
                           }).map(m => {
                           const summaryMember = summaryData?.members?.find(sm => sm.user_id === m.id);
                           const netContribution = summaryMember ? (typeof summaryMember.settled_net === 'number' ? summaryMember.settled_net : (summaryMember.net_contribution || 0)) : null;
                           const canRemove = netContribution !== null ? Math.abs(netContribution) < 0.01 : true;
                           
                           return (
                           <div key={m.id} className="member-row flex justify-between items-center" style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                             <div className="flex items-center gap-3">
                               <div className="member-avatar">{m.name.charAt(0).toUpperCase()}</div>
                               <div className="flex flex-col">
                                 <span className="member-name">{m.name} {m.id === user.id && <span className="text-muted">(You)</span>}</span>
                                 {!canRemove && <span className="text-muted" style={{fontSize: '11px'}}>Balance must be settled to {m.id === user.id ? 'leave' : 'remove'}</span>}
                               </div>
                             </div>
                             <button 
                               className="btn outline-btn" 
                               style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--danger)', color: 'var(--danger)', opacity: canRemove ? 1 : 0.5, cursor: canRemove ? 'pointer' : 'not-allowed' }}
                               onClick={() => canRemove && handleRemoveMember(m.id)}
                               disabled={!canRemove}
                             >
                               {m.id === user.id ? 'Leave' : 'Remove'}
                             </button>
                           </div>
                           );
                         })
                         )}
                       </div>
                     </div>
                   </div>
                   </div>

                   {/* Transactions Tab Content */}
                   <div style={{ display: groupTab === 'transactions' ? undefined : 'none' }}>
                      <div className="glass-card mt-6" key="transactions">
                       <h3 className="mb-4">All Transactions</h3>
                       {activeGroupData.transactions.length === 0 ? (
                         <div className="empty-state" style={{ padding: '32px 16px' }}>
                           <p className="text-muted" style={{ margin: 0 }}>No transactions yet in this pool.</p>
                         </div>
                       ) : (
                         <div className="flex flex-col gap-3">
                           {activeGroupData.transactions.map((tx) => {
                              if (tx.type === 'contribution') {
                                return (
                                  <div key={tx.id} className="transaction-card contribution-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↑ Added to Shared Pool</div>
                                      <div className="tx-date">{tx.user.name}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>+₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                )
                              } else if (tx.type === 'pool_payment') {
                                return (
                                  <div key={tx.id} className="transaction-card expense-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↓ Pool Payment to {tx.recipient_name}</div>
                                      <div className="tx-date">Paid by {tx.user?.name || 'Member'} · {tx.category || 'Other'} · Shared Pool → {tx.recipient_name}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>−₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                )
                              } else if (tx.type === 'settlement_deposit') {
                                return (
                                  <div key={tx.id} className="transaction-card contribution-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↑ Settlement Deposit</div>
                                      <div className="tx-date">{tx.user.name}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>+₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                )
                              } else if (tx.type === 'settlement_payout') {
                                return (
                                  <div key={tx.id} className="transaction-card expense-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↓ Settlement Payout</div>
                                      <div className="tx-date">{tx.user.name}</div>
                                      <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>−₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                )
                              } else {
                                return (
                                  <div key={tx.id} className="transaction-card expense-tx" onClick={() => setSelectedTx(tx)}>
                                    <div className="tx-details">
                                      <div style={{fontWeight: 500, color: 'var(--text-primary)'}}>↓ {tx.description || tx.category}</div>
                                      <div className="tx-date">Paid by {tx.user?.name || 'Pool'}</div>
                                                                            <div className="tx-date">{new Date(tx.created_at).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})}</div>
                                    </div>
                                    <strong style={{fontWeight: 500, color: 'var(--text-primary)'}}>−₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                )
                              }
                            })}
                         </div>
                       )}
                     </div>
                   </div>

                   {/* Summary Tab Content */}
                   <div style={{ display: groupTab === 'summary' ? undefined : 'none' }}>
                      <div className="mt-6" key="summary">
                        {loadingSummary || !summaryData ? (
                          <div className="glass-card flex justify-center items-center" style={{ minHeight: '400px' }}>
                            <div className="text-muted">Loading summary...</div>
                          </div>
                        ) : (
                          <>
                            <div className="summary-stats-grid mb-8">
                              <div className="glass-card stat-card">
                                <span className="stat-label">Total Deposited</span>
                                <span className="stat-value">₹{summaryData.total_deposited.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                              </div>
                              <div className="glass-card stat-card">
                                <span className="stat-label">Total Spent</span>
                                <span className="stat-value">₹{summaryData.total_spent.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                              </div>
                              <div className="glass-card stat-card">
                                <span className="stat-label">Pool Balance</span>
                                <span className="stat-value text-primary">₹{summaryData.pool_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                              </div>
                            </div>
                            
                            {summaryData.settlement_status === 'PENDING' && (
                              <div className="glass-card mb-8" style={{ background: 'rgba(255, 69, 58, 0.05)', borderColor: 'rgba(255, 69, 58, 0.2)' }}>
                                {settleError && <ErrorBanner message={settleError} onDismiss={() => setSettleError('')} />}
                                <div className="mb-4">
                                  <div>
                                    <h3 style={{ color: 'var(--danger)', margin: 0 }}>Settlement Pending</h3>
                                    <p className="text-muted text-sm mt-1 mb-0">The shared pool has unresolved balances.</p>
                                  </div>
                                </div>
                                {(() => {
                                  const me = summaryData.members.find(m => m.user_id === user.id);
                                  if (!me) return null;
                                  const settledNet = typeof me.settled_net === 'number' ? me.settled_net : (typeof me.net_contribution === 'number' ? me.net_contribution : 0);
                                  const status = me.settlement_status || (settledNet < -0.01 ? 'PAY' : settledNet > 0.01 ? 'RECEIVE' : 'SETTLED');
                                  const pendingAmt = typeof me.pending_settlement === 'number' ? me.pending_settlement : Math.abs(settledNet);
                                  if (status === 'SETTLED' || pendingAmt < 0.01) return null;
                                  return (
                                    <div className="flex justify-between items-center" style={{ padding: '12px', background: 'transparent', borderRadius: '8px', border: status === 'PAY' ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid rgba(48, 209, 88, 0.3)' }}>
                                      <p style={{ margin: 0, fontWeight: 500, fontSize: '15px' }}>
                                        {status === 'PAY'
                                          ? <>You owe <strong className="text-danger">₹{pendingAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong> to the pool</>
                                          : <>You are owed <strong className="text-success">₹{pendingAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</strong> from the pool</>
                                        }
                                      </p>
                                      {status === 'PAY' ? (
                                        <button className="btn primary-btn" onClick={() => {setShowIndividualSettleModal({action: 'pay', maxAmount: pendingAmt}); setSettleAmount(pendingAmt.toString());}}>Pay to Pool</button>
                                      ) : (
                                        <button className="btn primary-btn" style={{background: 'var(--success)'}} onClick={() => {setShowIndividualSettleModal({action: 'withdraw', maxAmount: pendingAmt}); setSettleAmount(pendingAmt.toString());}}>Withdraw</button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            
                            <h3 className="mb-4">Member Summary</h3>
                            <div className="flex flex-col gap-4 mb-8">
                              {[...summaryData.members].sort((a, b) => {
                                if (a.user_id === user.id) return -1;
                                if (b.user_id === user.id) return 1;
                                return a.name.localeCompare(b.name);
                              }).map((m) => {
                                const isNetPositive = m.net_contribution > 0;
                                const isNetNegative = m.net_contribution < 0;
                                const netColor = isNetPositive ? 'var(--success)' : isNetNegative ? 'var(--danger)' : 'var(--text-primary)';
                                
                                const settledNet = typeof m.settled_net === 'number' ? m.settled_net : (typeof m.net_contribution === 'number' ? m.net_contribution : 0);
                                const status = m.settlement_status || (settledNet < -0.01 ? 'PAY' : settledNet > 0.01 ? 'RECEIVE' : 'SETTLED');
                                const pendingAmt = typeof m.pending_settlement === 'number' ? m.pending_settlement : Math.abs(settledNet);
                                const isPay = status === 'PAY';
                                const isReceive = status === 'RECEIVE';
                                
                                return (
                                  <div key={m.user_id} className="glass-card member-summary-card" style={{ padding: '20px 24px' }}>
                                    <div className="mb-3">
                                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {m.name} {m.user_id === user.id && <span className="text-muted" style={{ fontSize: '14px', fontWeight: 400 }}>(You)</span>}
                                      </h4>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2">
                                      <div className="flex justify-between items-center text-sm" style={{ gap: '12px' }}>
                                        <span className="text-muted">Deposited to Pool</span>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                          ₹{(m.deposited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-sm" style={{ gap: '12px' }}>
                                        <span className="text-muted">Paid Externally</span>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                          ₹{(m.externally_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-sm" style={{ gap: '12px' }}>
                                        <span className="text-muted">Share of Expenses</span>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                          ₹{(m.spent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div style={{ borderTop: '1px solid rgba(40,55,85,0.08)', margin: '14px 0 12px 0' }}></div>
                                    
                                    <div className="flex justify-between items-center" style={{ gap: '12px' }}>
                                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Net Contribution</span>
                                      <span style={{ fontSize: '17px', fontWeight: 700, color: netColor }}>
                                        {isNetPositive ? '+' : ''}₹{(m.net_contribution || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px dashed rgba(40,55,85,0.12)', gap: '12px' }}>
                                      <span className="text-muted text-sm" style={{ fontWeight: 500 }}>Pending Settlement</span>
                                      <span className="font-semibold text-sm" style={{ color: isReceive ? 'var(--success)' : isPay ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        {isPay && `₹${pendingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to pay`}
                                        {isReceive && `₹${pendingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to receive`}
                                        {!isPay && !isReceive && `₹0.00`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {Object.values(summaryData.category_spending).some(v => v > 0) && (
                              <>
                                <h3 className="mb-4">Spending Breakdown</h3>
                                <div className="glass-card">
                                  {(() => {
                                    const catColors = {
                                      'Dinner': '#5D78E8',
                                      'Lunch': '#3AB599',
                                      'Groceries': '#F59E0B',
                                      'Breakfast': '#EC4899',
                                      'Transport': '#8B5CF6',
                                      'Other': '#94A1B7'
                                    };
                                    const entries = Object.entries(summaryData.category_spending).filter(([, val]) => val > 0).sort((a, b) => b[1] - a[1]);
                                    const totalSpentAll = entries.reduce((acc, [, val]) => acc + val, 0);

                                    let accumulatedAngle = 0;
                                    const radius = 45;
                                    const circumference = 2 * Math.PI * radius;

                                    return (
                                      <div className="flex flex-col md:flex-row items-center gap-8">
                                        {/* Circular Donut Graph */}
                                        <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ position: 'relative', width: '160px', height: '160px' }}>
                                          <svg width="160" height="160" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="14" />
                                            {totalSpentAll > 0 ? (
                                              entries.map(([cat, amt]) => {
                                                if (amt <= 0) return null;
                                                const pct = amt / totalSpentAll;
                                                const strokeDasharray = `${pct * circumference} ${circumference}`;
                                                const strokeDashoffset = -accumulatedAngle * circumference;
                                                accumulatedAngle += pct;
                                                return (
                                                  <circle
                                                    key={cat}
                                                    cx="60"
                                                    cy="60"
                                                    r={radius}
                                                    fill="none"
                                                    stroke={catColors[cat] || '#5D78E8'}
                                                    strokeWidth="14"
                                                    strokeDasharray={strokeDasharray}
                                                    strokeDashoffset={strokeDashoffset}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'all 0.5s ease' }}
                                                  />
                                                );
                                              })
                                            ) : (
                                              <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--text-muted)" strokeWidth="14" opacity="0.3" />
                                            )}
                                          </svg>
                                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                                            <span className="text-muted text-xs" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                                              ₹{totalSpentAll > 0 ? (totalSpentAll >= 100000 ? (totalSpentAll/100000).toFixed(2) + 'L' : totalSpentAll.toLocaleString('en-IN')) : '0'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Category List with Color Badges & Segmented Progress Bars */}
                                        <div className="flex-1 w-full flex flex-col gap-3">
                                          {entries.map(([cat, amt]) => {
                                            const pct = totalSpentAll > 0 ? ((amt / totalSpentAll) * 100).toFixed(1) : '0.0';
                                            const color = catColors[cat] || '#5D78E8';
                                            return (
                                              <div key={cat} className="flex flex-col gap-1.5" style={{ padding: '4px 0' }}>
                                                <div className="flex justify-between items-center text-sm">
                                                  <div className="flex items-center gap-2">
                                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat}</span>
                                                    {totalSpentAll > 0 && amt > 0 && (
                                                      <span className="text-muted" style={{ fontSize: '12px' }}>({pct}%)</span>
                                                    )}
                                                  </div>
                                                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                  </span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '99px', overflow: 'hidden' }}>
                                                  <div style={{ width: `${amt > 0 ? (totalSpentAll > 0 ? pct : 0) : 0}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.4s ease' }}></div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
                          </>
                        )}
                     </div>
                   </div>

                 </div>
               )}
            </div>
          )}
          
          {/* GROUPS TAB (Management) */}
          {activeTab === 'groups' && (
            <div>
              <div style={{textAlign: 'center', marginBottom: '40px'}}>
                <h2 className="page-title" style={{marginBottom: '8px'}}>Group Management</h2>
                <p className="page-subtitle">Create and manage your shared pools.</p>
              </div>
              
              <div className="grid-2-col mb-8">
                <div className="glass-card" style={{display: 'flex', flexDirection: 'column'}}>
                  <h3 style={{marginBottom: '6px', fontSize: '20px'}}>Create a Group</h3>
                  <p className="text-muted" style={{marginBottom: '24px', fontSize: '14px'}}>Start a new shared pool with friends.</p>
                  {createGroupError && <ErrorBanner message={createGroupError} onDismiss={() => setCreateGroupError('')} />}
                  <form onSubmit={handleCreateGroup} noValidate style={{display: 'flex', flexDirection: 'column', gap: '16px', flex: 1}}>
                    <div>
                      <label>Group name</label>
                      <input 
                        className={`premium-input ${createGroupFieldError ? 'input-error' : ''}`} 
                        type="text" 
                        placeholder="Enter group name" 
                        value={newGroupName} 
                        onChange={(e) => {
                          setNewGroupName(e.target.value);
                          if (createGroupFieldError) setCreateGroupFieldError('');
                        }} 
                        aria-invalid={!!createGroupFieldError}
                        aria-describedby={createGroupFieldError ? 'create-group-name-error' : undefined}
                      />
                      <FormFieldError message={createGroupFieldError} id="create-group-name-error" />
                    </div>
                    <div style={{marginTop: 'auto'}}>
                      <button type="submit" className="btn primary-btn" style={{width: '100%'}} disabled={isCreatingGroup}>
                        {isCreatingGroup ? 'Creating...' : 'Create Group'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="glass-card" style={{display: 'flex', flexDirection: 'column'}}>
                  <h3 style={{marginBottom: '6px', fontSize: '20px'}}>Join a Group</h3>
                  <p className="text-muted" style={{marginBottom: '24px', fontSize: '14px'}}>Join an existing shared pool.</p>
                  {joinError && <ErrorBanner message={joinError} onDismiss={() => setJoinError('')} />}
                  {joinSuccessMsg && <div style={{color: 'var(--success)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'}}>✓ {joinSuccessMsg}</div>}
                  <form onSubmit={handleJoinGroup} noValidate style={{display: 'flex', flexDirection: 'column', gap: '16px', flex: 1}}>
                    <div>
                      <label>Invite Code</label>
                      <input 
                        className={`premium-input ${joinFieldError ? 'input-error' : ''}`} 
                        type="text" 
                        placeholder="Enter invite code" 
                        value={joinCode} 
                        onChange={(e) => {
                          setJoinCode(e.target.value);
                          if (joinFieldError) setJoinFieldError('');
                        }} 
                        aria-invalid={!!joinFieldError}
                        aria-describedby={joinFieldError ? 'join-code-error' : undefined}
                      />
                      <FormFieldError message={joinFieldError} id="join-code-error" />
                    </div>
                    <div style={{marginTop: 'auto'}}>
                      <button type="submit" className="btn primary-btn" style={{width: '100%'}} disabled={isJoining}>
                        {isJoining ? 'Joining...' : 'Join Group'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ADD MONEY MODAL */}
      {showContributeModal && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowContributeModal(false); setContribError(''); } }}>
          <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="mb-2">Add Money</h3>
              <p className="text-muted mb-6">Contribute funds to the shared group pool.</p>
            </div>
            
            {contribError && <ErrorBanner message={contribError} onDismiss={() => setContribError('')} />}
            
            <form onSubmit={handleAddMoney} noValidate className="modal-form">
              <div className="form-group">
                <label>Amount (₹)</label>
                <input 
                  className={`premium-input amount-input ${contributeFieldError ? 'input-error' : ''}`} 
                  type="text" 
                  inputMode="decimal"
                  placeholder="0.00" 
                  value={contribAmount} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setContribAmount(val);
                      if (contributeFieldError) setContributeFieldError('');
                    }
                  }}
                  aria-invalid={!!contributeFieldError}
                  aria-describedby={contributeFieldError ? 'contribute-amount-error' : undefined}
                />
                <FormFieldError message={contributeFieldError} id="contribute-amount-error" />
              </div>
              
              <div className="modal-actions mt-4">
                <button type="button" className="btn secondary-btn" onClick={() => {setShowContributeModal(false); setContribError('');}}>Cancel</button>
                <button type="submit" className="btn primary-btn" disabled={addingMoney}>{addingMoney ? 'Adding...' : 'Add to Pool'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY FROM POOL MODAL */}
      {showPayPoolModal && !poolPaymentReceipt && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowPayPoolModal(false); setPoolPaymentError(''); } }}>
          <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowPayPoolModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
            <div className="modal-header text-center">
              <h3 className="mb-2">Pay from Shared Pool</h3>
              <p className="text-muted mb-6">Available Pool: ₹{activeGroupData?.pool_balance?.toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
              
              <div className="segmented-control">
                <button 
                  className={poolPaymentMethod === 'QR' ? 'active' : ''}
                  onClick={() => setPoolPaymentMethod('QR')}
                >
                  Scan QR
                </button>
                <button 
                  className={poolPaymentMethod === 'UPI_ID' ? 'active' : ''}
                  onClick={() => setPoolPaymentMethod('UPI_ID')}
                >
                  Enter UPI ID
                </button>
              </div>
            </div>
            
            {poolPaymentError && <ErrorBanner message={poolPaymentError} onDismiss={() => setPoolPaymentError('')} />}
            
            {poolPaymentMethod === 'QR' && (
              <div className="flex flex-col items-center">
                <div className="glass-card flex flex-col items-center justify-center p-8 mb-6" style={{ width: '100%', minHeight: '200px', border: '1px dashed var(--primary)' }}>
                  <div style={{ marginBottom: '16px', color: 'var(--text-muted)', opacity: 0.8 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <p className="text-muted text-center mb-4">Scan merchant QR</p>
                </div>
                
                <button 
                  className="btn secondary-btn w-full mb-4" 
                  onClick={() => {
                    setPoolPaymentData({
                      recipient_name: 'Demo Merchant',
                      recipient_upi_id: 'merchant@upi',
                      amount: '300',
                      category: poolPaymentData.category || 'Dinner'
                    });
                    setPoolPaymentMethod('CONFIRM_DEMO');
                  }}
                >
                  Use Demo QR
                </button>
              </div>
            )}
            
            {poolPaymentMethod === 'UPI_ID' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                setPayPoolFieldErrors({});
                const errors = {};
                if (!poolPaymentData.recipient_upi_id.trim()) {
                  errors.recipient_upi_id = 'Please enter a UPI ID.';
                } else if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(poolPaymentData.recipient_upi_id.trim())) {
                  errors.recipient_upi_id = 'Please enter a valid UPI ID (e.g. name@upi).';
                }
                if (!poolPaymentData.recipient_name.trim()) {
                  errors.recipient_name = 'Please enter recipient name.';
                }
                if (!poolPaymentData.category) {
                  errors.category = 'Please select a category.';
                }
                const amt = parseFloat(poolPaymentData.amount);
                const availablePool = activeGroupData?.pool_balance || 0;
                if (!poolPaymentData.amount || isNaN(amt)) {
                  errors.amount = 'Please enter an amount.';
                } else if (amt <= 0) {
                  errors.amount = 'Amount must be greater than ₹0.';
                } else if (amt > availablePool) {
                  errors.amount = `Insufficient pool balance. Available: ₹${availablePool.toLocaleString('en-IN', {minimumFractionDigits: 2})}.`;
                }
                const activeParticipants = poolParticipants.length > 0 ? poolParticipants : (activeGroupData?.members.map(m => m.id) || []);
                if (activeParticipants.length === 0) {
                  errors.participants = 'Please select at least one person for this payment.';
                }
                if (Object.keys(errors).length > 0) {
                  setPayPoolFieldErrors(errors);
                  return;
                }
                setPoolPaymentMethod('CONFIRM_DEMO');
              }} noValidate className="modal-form">
                <div className="form-group mb-4">
                  <label>UPI ID</label>
                  <input 
                    type="text" 
                    className={`premium-input ${payPoolFieldErrors.recipient_upi_id ? 'input-error' : ''}`} 
                    placeholder="merchant@upi"
                    value={poolPaymentData.recipient_upi_id}
                    onChange={(e) => {
                      setPoolPaymentData({...poolPaymentData, recipient_upi_id: e.target.value});
                      if (payPoolFieldErrors.recipient_upi_id) setPayPoolFieldErrors(prev => ({...prev, recipient_upi_id: ''}));
                    }}
                    aria-invalid={!!payPoolFieldErrors.recipient_upi_id}
                    aria-describedby={payPoolFieldErrors.recipient_upi_id ? 'paypool-upi-error' : undefined}
                  />
                  <FormFieldError message={payPoolFieldErrors.recipient_upi_id} id="paypool-upi-error" />
                </div>
                
                <div className="form-group mb-4">
                  <label>Recipient Name</label>
                  <input 
                    type="text" 
                    className={`premium-input ${payPoolFieldErrors.recipient_name ? 'input-error' : ''}`} 
                    placeholder="e.g. Demo Merchant"
                    value={poolPaymentData.recipient_name}
                    onChange={(e) => {
                      setPoolPaymentData({...poolPaymentData, recipient_name: e.target.value});
                      if (payPoolFieldErrors.recipient_name) setPayPoolFieldErrors(prev => ({...prev, recipient_name: ''}));
                    }}
                    aria-invalid={!!payPoolFieldErrors.recipient_name}
                    aria-describedby={payPoolFieldErrors.recipient_name ? 'paypool-name-error' : undefined}
                  />
                  <FormFieldError message={payPoolFieldErrors.recipient_name} id="paypool-name-error" />
                </div>
                
                <div className="form-group mb-4">
                  <label>Category</label>
                  <GlassSelect 
                    id="paypool-category"
                    value={poolPaymentData.category}
                    onChange={(val) => {
                      setPoolPaymentData({...poolPaymentData, category: val});
                      if (payPoolFieldErrors.category) setPayPoolFieldErrors(prev => ({...prev, category: ''}));
                    }}
                    options={CATEGORY_OPTIONS}
                    placeholder="Select category..."
                    error={!!payPoolFieldErrors.category}
                    aria-invalid={!!payPoolFieldErrors.category}
                    aria-describedby={payPoolFieldErrors.category ? 'paypool-category-error' : undefined}
                  />
                  <FormFieldError message={payPoolFieldErrors.category} id="paypool-category-error" />
                </div>
                
                <div className="form-group mb-6">
                  <label>Amount (₹)</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    className={`premium-input ${payPoolFieldErrors.amount ? 'input-error' : ''}`} 
                    placeholder="0.00"
                    value={poolPaymentData.amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setPoolPaymentData({...poolPaymentData, amount: val});
                        if (payPoolFieldErrors.amount) setPayPoolFieldErrors(prev => ({...prev, amount: ''}));
                      }
                    }}
                    aria-invalid={!!payPoolFieldErrors.amount}
                    aria-describedby={payPoolFieldErrors.amount ? 'paypool-amount-error' : undefined}
                  />
                  <FormFieldError message={payPoolFieldErrors.amount} id="paypool-amount-error" />
                </div>
                
                <div className="form-group" style={{marginBottom: '16px'}}>
                  <label style={{marginBottom: '6px'}}>Who was this payment for? <span className="text-danger">*</span></label>
                  <div className="participant-selection" style={{marginBottom: '0'}}>
                    {activeGroupData.members.map(m => {
                      const selectedIds = poolParticipants.length > 0 ? poolParticipants : activeGroupData.members.map(mem => mem.id);
                      const isSelected = selectedIds.includes(m.id);
                      return (
                        <label 
                          key={m.id} 
                          className={`participant-row ${isSelected ? 'selected' : ''}`}
                        >
                          <input 
                            type="checkbox" 
                            className="visually-hidden"
                            checked={isSelected}
                            onChange={() => {
                              const currentSelected = poolParticipants.length > 0 ? poolParticipants : activeGroupData.members.map(mem => mem.id);
                              if (isSelected) {
                                setPoolParticipants(currentSelected.filter(id => id !== m.id));
                              } else {
                                setPoolParticipants([...currentSelected, m.id]);
                              }
                              if (payPoolFieldErrors.participants) setPayPoolFieldErrors(prev => ({ ...prev, participants: '' }));
                            }}
                          />
                          <div className={`participant-dot ${isSelected ? 'checked' : ''}`}></div>
                          <div className="participant-name">
                            <span>{m.name}</span>
                            {m.id === user.id && <span className="you-badge">You</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', marginBottom: '8px'}}>
                    <button type="button" className="receipt-copy" onClick={() => {
                      const currentSelected = poolParticipants.length > 0 ? poolParticipants : activeGroupData.members.map(mem => mem.id);
                      if (currentSelected.length === activeGroupData.members.length) {
                        setPoolParticipants([]);
                      } else {
                        setPoolParticipants(activeGroupData.members.map(m => m.id));
                      }
                      if (payPoolFieldErrors.participants) setPayPoolFieldErrors(prev => ({ ...prev, participants: '' }));
                    }}>
                      {(poolParticipants.length > 0 ? poolParticipants : activeGroupData.members.map(mem => mem.id)).length === activeGroupData.members.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <FormFieldError message={payPoolFieldErrors.participants} id="paypool-participants-error" />
                </div>
                
                <button type="submit" className="btn primary-btn w-full">Continue</button>
              </form>
            )}
            
            {poolPaymentMethod === 'CONFIRM_DEMO' && (
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium text-danger mb-4">SIMULATED DEMO PAYMENT</p>
                
                <div className="text-center mb-6">
                  <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>₹{parseFloat(poolPaymentData.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</h2>
                  <p className="font-medium" style={{ fontSize: '18px' }}>{poolPaymentData.recipient_name}</p>
                  <p className="text-muted text-sm">{poolPaymentData.recipient_upi_id}</p>
                </div>
                
                <div className="w-full bg-surface-input p-4 rounded-xl mb-6 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted mb-1">Paying from</p>
                    <p className="font-medium">Shared Pool Balance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted mb-1">Pool balance after</p>
                    <p className="font-medium">₹{(activeGroupData?.pool_balance - parseFloat(poolPaymentData.amount)).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
                  </div>
                </div>
                
                <div className="flex gap-4 w-full">
                  <button className="btn secondary-btn flex-1" onClick={() => setPoolPaymentMethod('QR')} disabled={processingPoolPayment}>Back</button>
                  <button className="btn primary-btn flex-1" onClick={handlePoolPayment} disabled={processingPoolPayment}>
                    {processingPoolPayment ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT RECEIPT MODAL */}
      {poolPaymentReceipt && (
        <div className="premium-modal-overlay" onClick={() => { setPoolPaymentReceipt(null); setShowPayPoolModal(false); }}>
          <div className="receipt-container" onClick={(e) => e.stopPropagation()}>
            <button 
              className="transaction-close"
              onClick={() => {
                setPoolPaymentReceipt(null);
                setShowPayPoolModal(false);
              }}
              aria-label="Close"
            >✕</button>
            
            <div className="receipt-content">
              {/* ZONE A: SUCCESS HEADER */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', background: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: 'bold', boxShadow: '0 4px 16px rgba(48, 209, 88, 0.25)', marginBottom: '16px' }}>✓</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)' }}>Payment Successful</h3>
                <h2 style={{ margin: 0, fontSize: '48px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>₹{parseFloat(poolPaymentReceipt.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</h2>
              </div>
              
              <div className="receipt-divider" style={{ margin: '24px 0' }}></div>
              
              {/* ZONE B: PAYMENT DETAILS */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', textAlign: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>PAID TO</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{poolPaymentReceipt.recipient_name}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{poolPaymentReceipt.recipient_upi_id}</p>
                </div>
                
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>PAID FROM</p>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>Shared Pool</p>
                </div>
              </div>
              
              <div className="receipt-divider" style={{ margin: '24px 0' }}></div>
              
              {/* ZONE C: TRANSACTION DETAILS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Transaction ID</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{poolPaymentReceipt.receipt_id}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Payment Type</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{poolPaymentReceipt.category || 'Dinner'}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date & Time</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {new Date(poolPaymentReceipt.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
              
              <div className="receipt-divider" style={{ margin: '24px 0 16px 0' }}></div>
              
              {/* FOOTER */}
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent)' }}>SIMULATED DEMO PAYMENT</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowExpenseModal(false); setExpError(''); } }}>
          <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => {setShowExpenseModal(false); setExpError('');}}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 1 }}
            >✕</button>
            <div className="modal-header" style={{marginBottom: '16px'}}>
              <h3 style={{marginBottom: '4px'}}>Add Expense</h3>
              <p className="text-muted" style={{fontSize: '13px'}}>Record a purchase made from the shared pool.</p>
            </div>
            
            {expError && <ErrorBanner message={expError} onDismiss={() => setExpError('')} />}
            
            <form onSubmit={handleAddExpense} noValidate className="modal-form">
              <div className="form-group">
                <label>Amount (₹)</label>
                <input 
                  className={`premium-input amount-input ${expFieldErrors.amount ? 'input-error' : ''}`} 
                  type="text" 
                  inputMode="decimal"
                  placeholder="0.00" 
                  value={expAmount} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setExpAmount(val);
                      if (expFieldErrors.amount) setExpFieldErrors(prev => ({ ...prev, amount: '' }));
                    }
                  }} 
                  aria-invalid={!!expFieldErrors.amount}
                  aria-describedby={expFieldErrors.amount ? 'exp-amount-error' : undefined}
                />
                <FormFieldError message={expFieldErrors.amount} id="exp-amount-error" />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <GlassSelect 
                  id="exp-category"
                  value={expCategory}
                  onChange={(val) => {
                    setExpCategory(val);
                    if (expFieldErrors.category) setExpFieldErrors(prev => ({ ...prev, category: '' }));
                  }}
                  options={CATEGORY_OPTIONS}
                  placeholder="Select category..."
                  error={!!expFieldErrors.category}
                  aria-invalid={!!expFieldErrors.category}
                  aria-describedby={expFieldErrors.category ? 'exp-category-error' : undefined}
                />
                <FormFieldError message={expFieldErrors.category} id="exp-category-error" />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <input type="text" className="premium-input" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Dinner at Domino's" />
              </div>
              
              <div className="form-group" style={{marginBottom: '8px'}}>
                <label style={{marginBottom: '6px'}}>Who was this expense for?</label>
                <div className="participant-selection" style={{marginBottom: '0'}}>
                  {activeGroupData.members.map(m => {
                    const isSelected = expParticipants.includes(m.id);
                    return (
                      <label 
                        key={m.id} 
                        className={`participant-row ${isSelected ? 'selected' : ''}`}
                      >
                        <input 
                          type="checkbox" 
                          className="visually-hidden"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) setExpParticipants(expParticipants.filter(id => id !== m.id));
                            else setExpParticipants([...expParticipants, m.id]);
                          }}
                        />
                        <div className={`participant-dot ${isSelected ? 'checked' : ''}`}></div>
                        <div className="participant-name">
                          <span>{m.name}</span>
                          {m.id === user.id && <span className="you-badge">You</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', marginBottom: '14px'}}>
                  <button type="button" className="receipt-copy" onClick={() => {
                    if (expParticipants.length === activeGroupData.members.length) {
                      setExpParticipants([]);
                    } else {
                      setExpParticipants(activeGroupData.members.map(m => m.id));
                    }
                  }}>{expParticipants.length === activeGroupData.members.length ? 'Deselect all' : 'Select all'}</button>
                </div>
              </div>

              <div className="form-group" style={{marginBottom: '8px'}}>
                <label>Paid By (Externally)</label>
                <GlassSelect 
                  id="exp-paidby"
                  value={expPaidBy || user.id}
                  onChange={(val) => {
                    setExpPaidBy(val);
                    if (expFieldErrors.paidBy) setExpFieldErrors(prev => ({ ...prev, paidBy: '' }));
                  }}
                  options={activeGroupData.members.map(m => ({
                    value: m.id,
                    label: `${m.name} ${m.id === user.id ? '(You)' : ''}`
                  }))}
                  error={!!expFieldErrors.paidBy}
                  aria-invalid={!!expFieldErrors.paidBy}
                  aria-describedby={expFieldErrors.paidBy ? 'exp-paidby-error' : undefined}
                />
              </div>
              <div className="modal-actions" style={{paddingTop: '12px'}}>
                <button type="button" className="btn secondary-btn" onClick={() => {setShowExpenseModal(false); setExpError('');}}>Cancel</button>
                <button type="submit" className="btn primary-btn" disabled={creatingExpense}>{creatingExpense ? 'Saving...' : 'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT SCANNER MODAL */}
      {showScannerModal && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowScannerModal(false); setScanError(''); setReceiptFile(null); setScanResult(null); } }}>
          <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="mb-2">Scan Receipt</h3>
              <p className="text-muted mb-6">Let AI extract the expense details.</p>
            </div>
            
            {scanError && <p className="text-danger mb-4">{scanError}</p>}
            
            {!scanResult ? (
              <form onSubmit={handleScanReceipt} className="modal-form">
                <div className="upload-zone">
                  <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} />
                </div>
                <div className="modal-actions mt-6">
                  <button type="button" className="btn secondary-btn" onClick={() => {setShowScannerModal(false); setScanError(''); setReceiptFile(null);}}>Cancel</button>
                  <button type="submit" className="btn primary-btn" disabled={scanning || !receiptFile}>
                    {scanning ? 'Analyzing...' : 'Scan Receipt'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-form">
                <div className="success-banner mb-4">
                  <h4 className="text-success mb-1">Extraction Successful</h4>
                  <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>Review the extracted data.</p>
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <input className="premium-input" type="text" value={scanResult.merchant} onChange={(e) => setScanResult({...scanResult, merchant: e.target.value})} />
                </div>
                
                <div className="form-group">
                  <label>Total Amount (₹)</label>
                  <input className="premium-input amount-input" type="number" step="0.01" value={scanResult.total_amount} onChange={(e) => setScanResult({...scanResult, total_amount: e.target.value})} />
                </div>
                
                <div className="mt-4 mb-2">
                  <label>Paid from:</label>
                  <div className="pool-selector">
                    <div className="pool-selector-active">● Shared Pool</div>
                  </div>
                </div>
                
                <div className="modal-actions mt-6">
                  <button type="button" className="btn secondary-btn" onClick={() => setScanResult(null)}>Rescan</button>
                  <button type="button" className="btn primary-btn" onClick={submitScannedExpense} disabled={scanning}>
                    {scanning ? 'Saving...' : 'Confirm & Add Expense'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRANSACTION RECEIPT MODAL */}
      {selectedTx && (
        <div className="premium-modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="receipt-container" onClick={(e) => e.stopPropagation()}>
            <button className="transaction-close" onClick={() => setSelectedTx(null)} aria-label="Close">×</button>
            <div className="receipt-content">
              {/* Top Section */}
              <div className="receipt-header">
                <div className="poolsy-brand" style={{ fontSize: '32px' }}>Poolsy</div>
              </div>
              
              <div className="receipt-main">
                <div className="receipt-desc">
                  {selectedTx.type === 'contribution' ? 'Added to Shared Pool' : 
                   selectedTx.type === 'pool_payment' ? `Shared Pool → ${selectedTx.recipient_name}` :
                   selectedTx.description}
                </div>
                
                <div className="receipt-amount">
                  {selectedTx.type === 'contribution' ? '+' : 
                   selectedTx.type === 'pool_payment' ? '' :
                   '-'}₹{selectedTx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </div>
                
                <div className="receipt-status">
                  <span className="status-dot">✓</span> Completed
                </div>
                
                <div className="receipt-date">
                  {new Date(selectedTx.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', 
                    hour: 'numeric', minute: '2-digit', hour12: true 
                  })}
                </div>
              </div>
              
              <div className="receipt-divider"></div>
              
              <div className="receipt-section">
                <div className="receipt-row">
                  <span className="receipt-label">Amount</span>
                  <span className="receipt-value" style={{fontWeight: 600}}>₹{selectedTx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                {selectedTx.type === 'pool_payment' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className="receipt-label">Initiated by</span>
                      <span className="receipt-value" style={{ fontWeight: 600 }}>{selectedTx.user?.name || 'Member'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className="receipt-label">Paid to</span>
                      <span className="receipt-value" style={{ fontWeight: 600 }}>{selectedTx.recipient_name}</span>
                    </div>
                    {selectedTx.recipient_upi_id && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                        <span className="receipt-label">UPI ID</span>
                        <span className="receipt-value font-mono text-xs text-muted">{selectedTx.recipient_upi_id}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className="receipt-label">Paid from</span>
                      <span className="receipt-value">Shared Pool</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className="receipt-label">Payment Type</span>
                      <span className="receipt-value" style={{ fontWeight: 600 }}>{selectedTx.category || 'Other'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <span className="receipt-label">Payment Method</span>
                      <span className="receipt-value">{selectedTx.payment_method === 'QR' ? 'Scan QR' : 'UPI ID'}</span>
                    </div>
                  </>
                )}
                
                {selectedTx.type === 'expense' && (
                  <>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Paid by</span>
                      <span className="receipt-value">{selectedTx.user?.name || 'Member'}</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Paid from</span>
                      <span className="receipt-value">External (Out of pocket)</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Description</span>
                      <span className="receipt-value">{selectedTx.description}</span>
                    </div>
                  </>
                )}
                
                {(selectedTx.type === 'contribution' || selectedTx.type === 'settlement_deposit') && (
                  <>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Added by</span>
                      <span className="receipt-value">{selectedTx.user?.name || 'Member'}</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Added to</span>
                      <span className="receipt-value">Shared Pool</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Description</span>
                      <span className="receipt-value">{selectedTx.type === 'contribution' ? 'Added money' : 'Settlement Deposit'}</span>
                    </div>
                  </>
                )}

                {selectedTx.type === 'settlement_payout' && (
                  <>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Withdrawn by</span>
                      <span className="receipt-value">{selectedTx.user?.name || 'Member'}</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Withdrawn from</span>
                      <span className="receipt-value">Shared Pool</span>
                    </div>
                    <div className="receipt-row mt-4">
                      <span className="receipt-label">Description</span>
                      <span className="receipt-value">Settlement Payout</span>
                    </div>
                  </>
                )}
              </div>
              
              {(selectedTx.type === 'expense' || selectedTx.type === 'pool_payment') && selectedTx.participants && selectedTx.participants.length > 0 && (
                <>
                  <div className="receipt-divider"></div>
                  <div className="receipt-section">
                    <div className="receipt-heading mb-2" style={{color: 'var(--text-secondary)'}}>
                      {activeGroupData && activeGroupData.members && selectedTx.participants.length === activeGroupData.members.length 
                        ? 'Paid for all (Attributed shares)' 
                        : 'Attributed shares'}
                    </div>
                    {selectedTx.participants.map(p => (
                      <div key={p.id} className="receipt-row mt-2">
                        <span className="receipt-label" style={{color: 'var(--text-primary)'}}>
                          {p.name} {p.id === user.id && <span className="text-muted font-normal">(You)</span>}
                        </span>
                        <span className="receipt-value">₹{(p.share !== undefined ? p.share : (selectedTx.amount / selectedTx.participants.length)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="receipt-divider"></div>

              <div className="receipt-section">
                <h4 className="receipt-heading" style={{ marginBottom: '16px' }}>Transaction details</h4>
                
                <div className="receipt-details-grid">
                  <div className="receipt-grid-row">
                    <div>
                      <div className="receipt-label">Poolsy Transaction ID</div>
                      <div className="receipt-value receipt-id" style={{ marginTop: '4px', textAlign: 'left' }}>
                        {selectedTx.raw_id ? `PYS-${selectedTx.raw_id.toString().padStart(8, '0')}` : 'PYS-PENDING'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button className="receipt-copy" onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(selectedTx.raw_id ? `PYS-${selectedTx.raw_id.toString().padStart(8, '0')}` : 'PYS-PENDING');
                      }}>Copy</button>
                    </div>
                  </div>

                  <div className="receipt-grid-row">
                    <div className="receipt-label">Transaction type</div>
                    <div className="receipt-value">{
                      selectedTx.type === 'contribution' ? 'Pool Contribution' : 
                      selectedTx.type === 'pool_payment' ? 'Pool Payment' :
                      'Pool Expense'
                    }</div>
                  </div>
                  
                  <div className="receipt-grid-row">
                    <div className="receipt-label">Status</div>
                    <div className="receipt-value" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Completed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL SETTLEMENT MODAL */}
      {showIndividualSettleModal && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowIndividualSettleModal(null); setSettleError(''); } }}>
          <div className="premium-modal" style={{maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="mb-2">{showIndividualSettleModal.action === 'pay' ? 'Pay to Pool' : 'Withdraw from Pool'}</h3>
              <p className="text-muted mb-6">
                {showIndividualSettleModal.action === 'pay' 
                  ? `Settle your debt. You can pay up to ₹${showIndividualSettleModal.maxAmount.toLocaleString('en-IN', {minimumFractionDigits:2})}` 
                  : `Withdraw your funds. You can withdraw up to ₹${showIndividualSettleModal.maxAmount.toLocaleString('en-IN', {minimumFractionDigits:2})}`}
              </p>
            </div>
            
            {settleError && <ErrorBanner message={settleError} onDismiss={() => setSettleError('')} />}
            
            <form onSubmit={handleIndividualSettle} noValidate>
              <div className="form-group mb-6">
                <label>Amount (₹)</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  className={`premium-input ${settleFieldError ? 'input-error' : ''}`} 
                  placeholder="0.00"
                  value={settleAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setSettleAmount(val);
                      if (settleFieldError) setSettleFieldError('');
                    }
                  }}
                  aria-invalid={!!settleFieldError}
                  aria-describedby={settleFieldError ? 'settle-amount-error' : undefined}
                />
                <FormFieldError message={settleFieldError} id="settle-amount-error" />
              </div>
              
              {showIndividualSettleModal.action === 'pay' && activeGroupData?.creator_upi_id && settleAmount > 0 && (
                <div className="flex flex-col items-center justify-center mb-6 p-4 glass-card">
                  <p className="text-sm font-medium mb-3">Scan to Pay Group Admin</p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${activeGroupData.creator_upi_id}&pn=GroupAdmin&am=${settleAmount}&cu=INR`)}`} 
                    alt="UPI QR Code" 
                    style={{ borderRadius: '8px' }}
                  />
                  <p className="text-xs text-muted mt-2">{activeGroupData.creator_upi_id}</p>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <button type="button" className="btn secondary-btn" onClick={() => setShowIndividualSettleModal(null)} disabled={settling}>Cancel</button>
                <button type="submit" className="btn primary-btn" disabled={settling}>
                  {settling ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="premium-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}>
          <div 
            className="premium-modal" 
            style={{ 
              maxWidth: '440px', 
              width: 'min(440px, calc(100vw - 32px))', 
              maxHeight: '94vh', 
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 28px',
              overflow: 'hidden'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowSettingsModal(false)}
              style={{
                position: 'absolute', top: '22px', right: '22px', background: 'transparent', border: 'none', 
                fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 10
              }}
              aria-label="Close"
            >
              ✕
            </button>
            
            <div className="modal-header" style={{ marginBottom: '14px', flexShrink: 0 }}>
              <h3 className="mb-1" style={{ fontSize: '22px' }}>Settings</h3>
              <p className="text-muted" style={{ fontSize: '14px', margin: 0 }}>Update your account details.</p>
            </div>
            
            {settingsError && <ErrorBanner message={settingsError} onDismiss={() => setSettingsError('')} />}
            {settingsSuccess && <p className="text-success mb-2 text-sm font-medium">✓ {settingsSuccess}</p>}
            
            <form onSubmit={handleUpdateSettings} noValidate style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ marginBottom: '12px' }}>
                <div className="form-group mb-3">
                  <label style={{ fontSize: '13.5px', marginBottom: '4px' }}>Name</label>
                  <input 
                    type="text" 
                    className={`premium-input ${settingsFieldErrors.name ? 'input-error' : ''}`} 
                    value={settingsName}
                    onChange={(e) => {
                      setSettingsName(e.target.value);
                      if (settingsFieldErrors.name) setSettingsFieldErrors(prev => ({ ...prev, name: '' }));
                    }}
                    placeholder="Your Name"
                    aria-invalid={!!settingsFieldErrors.name}
                    aria-describedby={settingsFieldErrors.name ? 'settings-name-error' : undefined}
                  />
                  <FormFieldError message={settingsFieldErrors.name} id="settings-name-error" />
                </div>
                
                <div className="form-group mb-3">
                  <label style={{ fontSize: '13.5px', marginBottom: '4px' }}>Email</label>
                  <input 
                    type="email" 
                    className={`premium-input ${settingsFieldErrors.email ? 'input-error' : ''}`} 
                    value={settingsEmail}
                    onChange={(e) => {
                      setSettingsEmail(e.target.value);
                      if (settingsFieldErrors.email) setSettingsFieldErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="you@example.com"
                    aria-invalid={!!settingsFieldErrors.email}
                    aria-describedby={settingsFieldErrors.email ? 'settings-email-error' : undefined}
                  />
                  <FormFieldError message={settingsFieldErrors.email} id="settings-email-error" />
                </div>
                
                <div className="form-group mb-3">
                  <label style={{ fontSize: '13.5px', marginBottom: '4px' }}>UPI ID (For receiving payments)</label>
                  <input 
                    type="text" 
                    className={`premium-input ${settingsFieldErrors.upi ? 'input-error' : ''}`} 
                    value={settingsUpiId}
                    onChange={(e) => {
                      setSettingsUpiId(e.target.value);
                      if (settingsFieldErrors.upi) setSettingsFieldErrors(prev => ({ ...prev, upi: '' }));
                    }}
                    placeholder="e.g. yourname@upi"
                    aria-invalid={!!settingsFieldErrors.upi}
                    aria-describedby={settingsFieldErrors.upi ? 'settings-upi-error' : undefined}
                  />
                  <FormFieldError message={settingsFieldErrors.upi} id="settings-upi-error" />
                </div>
                
                <div className="form-group mb-2">
                  <label style={{ fontSize: '13.5px', marginBottom: '4px' }}>New Password</label>
                  <input 
                    type="password" 
                    className={`premium-input ${settingsFieldErrors.password ? 'input-error' : ''}`} 
                    value={settingsPassword}
                    onChange={(e) => {
                      setSettingsPassword(e.target.value);
                      if (settingsFieldErrors.password) setSettingsFieldErrors(prev => ({ ...prev, password: '' }));
                    }}
                    placeholder="Leave blank to keep unchanged"
                    aria-invalid={!!settingsFieldErrors.password}
                    aria-describedby={settingsFieldErrors.password ? 'settings-password-error' : undefined}
                  />
                  <FormFieldError message={settingsFieldErrors.password} id="settings-password-error" />
                </div>
              </div>
              
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                <button type="submit" className="btn primary-btn w-full">Save Changes</button>
                <button type="button" className="btn outline-btn w-full" style={{color: 'var(--danger)', borderColor: 'var(--danger)'}} onClick={handleLogout}>Log Out</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {showRenameGroupModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRenameGroupModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ margin: 0 }}>Rename Group</h3>
              <button 
                onClick={() => setShowRenameGroupModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >✕</button>
            </div>
            {renameError && <ErrorBanner message={renameError} onDismiss={() => setRenameError('')} />}
            <form onSubmit={handleRenameGroup} noValidate>
              <div className="form-group mb-4">
                <label>Group Name</label>
                <input 
                  type="text" 
                  className={`premium-input ${renameFieldError ? 'input-error' : ''}`} 
                  value={renameGroupName}
                  onChange={(e) => {
                    setRenameGroupName(e.target.value);
                    if (renameFieldError) setRenameFieldError('');
                  }}
                  placeholder="Enter new group name"
                  autoFocus
                  aria-invalid={!!renameFieldError}
                  aria-describedby={renameFieldError ? 'rename-group-name-error' : undefined}
                />
                <FormFieldError message={renameFieldError} id="rename-group-name-error" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn outline-btn" onClick={() => setShowRenameGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn primary-btn" disabled={renamingGroup}>
                  {renamingGroup ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Poolsy Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ margin: 0 }}>{confirmModal.title || 'Confirm Action'}</h3>
              <button 
                onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px' }}>{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn outline-btn" onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}>
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button type="button" className="btn primary-btn" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => {
                if (confirmModal.onConfirm) confirmModal.onConfirm();
                setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
              }}>
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
