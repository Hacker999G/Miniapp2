import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, orderBy, where, increment } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { AppSettings, Task, WithdrawalRequest, UserData } from './types';
import { ADMIN_EMAIL, ADMIN_TG_ID } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Settings as SettingsIcon, 
  Save, 
  Plus, 
  Trash2, 
  ExternalLink,
  Bot,
  Globe,
  DollarSign,
  TrendingUp,
  Tag,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
  LogOut,
  ShieldAlert,
  Key,
  Zap,
  PlayCircle,
  Coins,
  Bell,
  MessageSquare,
  Megaphone,
  Users,
  Wallet,
  Ban,
  Check,
  X,
  ArrowLeft,
  Search,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  UserMinus,
  History,
  LayoutDashboard,
  Send,
  ListTodo
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [isTgAdmin, setIsTgAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'DT EARNING ZONE',
    appLogo: 'https://i.ibb.co/gLQsBHNp/logo.png',
    earningPerAd: 0.0004,
    userSharePercentage: 20,
    monetagZoneId: '10754815',
    monetagSdkId: 'show_10754815',
    botUsername: 'dt_eaening_zone_bot',
    botToken: '8124462129:AAF-aJ_fnvRD9y-QXQPXIY10z-xjtK-Mefs',
    newUserChannel: '-1003812909907',
    withdrawChannel: '-1003810127512',
    newUserMsgTemplate: `━━━━━━━━━━━━━━━━━━━━
🎉 NEW USER ALERT
━━━━━━━━━━━━━━━━━━━━━

👤 Name: {name}
🆔 ID: {userid} 
📱 Username: {username} 
⏰ Time: {join_time} 

━━━━━━━━━━━━━━━━━━━━━
🤖 IN THIS BOT : @dt_eaening_zone_bot
━━━━━━━━━━━━━━━━━━━━━`,
    referReward: 0.05,
    commonAdReward: 0.5,
    uniqueAdReward: 2.0,
    commonAdsTarget: 9,
    popupNotice: 'Welcome to our app! Start earning now.',
    homeNotice: 'Invite your friends and earn more!',
    currencySymbol: '৳',
    exchangeRate: 120,
    isWithdrawEnabled: true,
    minWithdrawAmount: 1.0,
    appShortName: 'app',
    referralCommissionPercentage: 20,
    methods: {
      bkash: true,
      nagad: true,
      rocket: true,
      upay: true,
      binance: true
    },
    tasks: [],
    supportLinks: []
  });
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'settings' | 'withdrawals' | 'users' | 'admins'>('dashboard');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info' | 'success';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const [banUserId, setBanUserId] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'banned'>('all');

  useEffect(() => {
    // Enable zooming for admin panel
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
    return () => {
      // Restore default (no zoom) when leaving admin panel
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    };
  }, []);

  useEffect(() => {
    // Check Telegram Admin
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      const checkAdminStatus = async () => {
        if (tgUser.id.toString() === ADMIN_TG_ID) {
          setIsTgAdmin(true);
          fetchSettings();
          fetchWithdrawals();
          fetchUsers();
        } else {
          // Check if this user is an admin in Firestore
          try {
            const q = query(collection(db, 'users'), where('telegramId', '==', tgUser.id.toString()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && querySnapshot.docs[0].data().isAdmin) {
              setIsTgAdmin(true);
              fetchSettings();
              fetchWithdrawals();
              fetchUsers();
            } else if (!user || user.email !== ADMIN_EMAIL) {
              setLoading(false);
            }
          } catch (err) {
            console.error('Check admin status error:', err);
            if (!user || user.email !== ADMIN_EMAIL) setLoading(false);
          }
        }
      };
      checkAdminStatus();
    }

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (authUser?.email === ADMIN_EMAIL) {
        fetchSettings();
        fetchWithdrawals();
        fetchUsers();
      } else if (!tgUser || tgUser.id.toString() !== ADMIN_TG_ID) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings({
          ...data,
          methods: data.methods || {
            bkash: true,
            nagad: true,
            rocket: true,
            upay: true,
            binance: true
          },
          supportLinks: data.supportLinks || [],
          exchangeRate: data.exchangeRate || 120,
          referralCommissionPercentage: data.referralCommissionPercentage || 20,
          appShortName: data.appShortName || 'app'
        });
      } else {
        // Initialize with default settings if not exists
        console.log('Initializing default settings...');
        await setDoc(docRef, settings);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'settings/config');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data: WithdrawalRequest[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
      });
      setWithdrawals(data);
    } catch (err) {
      console.error('Fetch withdrawals error:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data: UserData[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ ...doc.data() } as UserData);
      });
      setAllUsers(data);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const handleUpdateWithdrawalStatus = async (id: string, status: 'completed' | 'rejected') => {
    try {
      const docRef = doc(db, 'withdrawals', id);
      await updateDoc(docRef, { status });
      setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status } : w));
    } catch (err) {
      console.error('Update withdrawal status error:', err);
    }
  };

  const handleBanUser = async (telegramId: string, isBanned: boolean) => {
    try {
      // Find user document by telegramId
      const q = query(collection(db, 'users'), where('telegramId', '==', telegramId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(userDoc.ref, { isBanned });
        setAllUsers(prev => prev.map(u => u.telegramId === telegramId ? { ...u, isBanned } : u));
      }
    } catch (err) {
      console.error('Ban user error:', err);
    }
  };

  const handleAdjustBalance = async (telegramId: string, amount: number) => {
    try {
      const q = query(collection(db, 'users'), where('telegramId', '==', telegramId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(userDoc.ref, { earnings: increment(amount) });
        setAllUsers(prev => prev.map(u => u.telegramId === telegramId ? { ...u, earnings: u.earnings + amount } : u));
      }
    } catch (err) {
      console.error('Adjust balance error:', err);
    }
  };

  const handleDirectBan = async () => {
    if (!banUserId) return;
    setShowConfirmModal({
      show: true,
      title: 'Ban User',
      message: `Are you sure you want to ban user with ID: ${banUserId}?`,
      type: 'danger',
      onConfirm: () => {
        handleBanUser(banUserId, true);
        setBanUserId('');
        setShowConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1111') {
      setIsPasswordAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      fetchSettings();
      fetchWithdrawals();
      fetchUsers();
      return;
    }
    alert('Incorrect password.');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsPasswordAuthenticated(false);
    sessionStorage.removeItem('admin_auth');
  };

  const isAuthorized = (user && user.email === ADMIN_EMAIL) || isTgAdmin || isPasswordAuthenticated;

  const handleSave = async () => {
    if (!isAuthorized) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/config');
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: 'New Task',
      reward: 0.01,
      link: 'https://t.me/',
      type: 'DEFAULT',
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png' // Default Telegram logo
    };
    setSettings({ ...settings, tasks: [...settings.tasks, newTask] });
  };

  const removeTask = (id: string) => {
    setSettings({ ...settings, tasks: settings.tasks.filter(t => t.id !== id) });
  };

  const updateTask = (id: string, field: keyof Task, value: any) => {
    setSettings({
      ...settings,
      tasks: settings.tasks.map(t => t.id === id ? { ...t, [field]: value } : t)
    });
  };

  const addSupportLink = () => {
    const newLink: any = {
      id: Date.now().toString(),
      platform: 'telegram',
      name: 'New Support',
      link: ''
    };
    setSettings({ ...settings, supportLinks: [...(settings.supportLinks || []), newLink] });
  };

  const updateSupportLink = (id: string, field: string, value: any) => {
    setSettings({
      ...settings,
      supportLinks: settings.supportLinks.map(l => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          if (field === 'platform') {
            updated.name = value.charAt(0).toUpperCase() + value.slice(1);
          }
          return updated;
        }
        return l;
      })
    });
  };

  const removeSupportLink = (id: string) => {
    setSettings({
      ...settings,
      supportLinks: settings.supportLinks.filter(l => l.id !== id)
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-8"
      >
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full blur-xl opacity-20"
          />
          <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl mx-auto flex items-center justify-center bg-slate-900">
            <Lock className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Admin Control
          </h1>
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">
              Authenticating Session
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Admin Login</h1>
            <p className="text-slate-400 font-medium">
              Enter your credentials to access the control panel.
            </p>
          </div>
          {user || isPasswordAuthenticated ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-red-500/20 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Unauthorized Access</p>
                  <p className="text-[10px] text-slate-500">{user?.email || 'Password Auth'}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-4">
                <div className="relative group">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="Admin Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-white text-slate-950 hover:bg-slate-100 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
              >
                <Lock className="w-4 h-4" /> Sign In
              </button>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Enter admin password to continue</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !settings.botToken) {
      alert('Please enter a message and ensure bot token is set.');
      return;
    }

    if (!confirm(`Are you sure you want to send this message to all ${allUsers.length} users?`)) return;

    setIsBroadcasting(true);
    let successCount = 0;
    let failCount = 0;

    for (const u of allUsers) {
      try {
        const response = await fetch('/api/telegram/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: settings.botToken,
            chatId: u.telegramId,
            text: broadcastMessage
          })
        });
        if (response.ok) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }

    setIsBroadcasting(false);
    setBroadcastMessage('');
    alert(`Broadcast complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      <header className="sticky top-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
              title="Back to App"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                {settings.appLogo ? (
                  <img 
                    src={settings.appLogo} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <SettingsIcon className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Admin Control</h1>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  Authorized: {isTgAdmin ? `Telegram ID ${window.Telegram?.WebApp?.initDataUnsafe?.user?.id}` : user?.email}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button 
                onClick={() => setActiveAdminTab('dashboard')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeAdminTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveAdminTab('settings')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeAdminTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Settings
              </button>
              <button 
                onClick={() => setActiveAdminTab('withdrawals')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeAdminTab === 'withdrawals' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Withdrawals
              </button>
              <button 
                onClick={() => setActiveAdminTab('users')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeAdminTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Users
              </button>
              <button 
                onClick={() => setActiveAdminTab('admins')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeAdminTab === 'admins' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Admins
              </button>
            </div>
            <button onClick={handleLogout} className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors">
              <LogOut className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-12">
        {activeAdminTab === 'admins' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight">Admin Management</h2>
                <p className="text-sm text-slate-500 font-medium">Manage users with administrative privileges.</p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold">Current Admins</h3>
                </div>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {allUsers.filter(u => u.isAdmin).length} Admins
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {allUsers.filter(u => u.isAdmin).length === 0 ? (
                  <div className="p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto">
                      <Users className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-500 font-medium">No additional admins found.</p>
                  </div>
                ) : (
                  allUsers.filter(u => u.isAdmin).map((admin) => (
                    <div key={admin.telegramId} className="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={admin.photoUrl} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-800" referrerPolicy="no-referrer" />
                        <div>
                          <p className="font-bold">{admin.firstName}</p>
                          <p className="text-xs text-slate-500 font-medium">@{admin.username} • ID: {admin.telegramId}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (admin.telegramId === ADMIN_TG_ID) {
                            alert('Cannot remove the primary bootstrap admin.');
                            return;
                          }
                          setShowConfirmModal({
                            show: true,
                            title: 'Remove Admin',
                            message: `Are you sure you want to remove admin privileges from ${admin.firstName}?`,
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                const q = query(collection(db, 'users'), where('telegramId', '==', admin.telegramId));
                                const querySnapshot = await getDocs(q);
                                if (!querySnapshot.empty) {
                                  await updateDoc(querySnapshot.docs[0].ref, { isAdmin: false });
                                  setAllUsers(prev => prev.map(u => u.telegramId === admin.telegramId ? { ...u, isAdmin: false } : u));
                                }
                                setShowConfirmModal(p => ({ ...p, show: false }));
                              } catch (err) {
                                console.error('Remove admin error:', err);
                              }
                            }
                          });
                        }}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors"
                        title="Remove Admin"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold">Promote User to Admin</h3>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 transition-all w-48"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                {allUsers
                  .filter(u => !u.isAdmin && ((u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) || (u.telegramId || "").toLowerCase().includes(searchTerm.toLowerCase())))
                  .slice(0, 20)
                  .map((u) => (
                    <div key={u.telegramId} className="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={u.photoUrl} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-800" referrerPolicy="no-referrer" />
                        <div>
                          <p className="font-bold">{u.firstName}</p>
                          <p className="text-xs text-slate-500 font-medium">@{u.username} • ID: {u.telegramId}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setShowConfirmModal({
                            show: true,
                            title: 'Promote to Admin',
                            message: `Are you sure you want to grant admin privileges to ${u.firstName}?`,
                            type: 'success',
                            onConfirm: async () => {
                              try {
                                const q = query(collection(db, 'users'), where('telegramId', '==', u.telegramId));
                                const querySnapshot = await getDocs(q);
                                if (!querySnapshot.empty) {
                                  await updateDoc(querySnapshot.docs[0].ref, { isAdmin: true });
                                  setAllUsers(prev => prev.map(user => user.telegramId === u.telegramId ? { ...user, isAdmin: true } : user));
                                }
                                setShowConfirmModal(p => ({ ...p, show: false }));
                              } catch (err) {
                                console.error('Promote admin error:', err);
                              }
                            }
                          });
                        }}
                        className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors"
                        title="Promote to Admin"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
        {activeAdminTab === 'dashboard' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Users</span>
                </div>
                <p className="text-3xl font-black">{allUsers.length}</p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending Payouts</span>
                </div>
                <p className="text-3xl font-black">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Earnings</span>
                </div>
                <p className="text-3xl font-black">
                  {allUsers.reduce((acc, curr) => acc + curr.earnings, 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <Megaphone className="w-5 h-5 text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ads Watched</span>
                </div>
                <p className="text-3xl font-black">
                  {allUsers.reduce((acc, curr) => acc + (curr.adsWatched || 0), 0)}
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Paid Out</span>
                </div>
                <p className="text-3xl font-black">
                  {withdrawals.filter(w => w.status === 'completed').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Referrals</span>
                </div>
                <p className="text-3xl font-black">
                  {allUsers.reduce((acc, curr) => acc + (curr.referralCount || 0), 0)}
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <ListTodo className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tasks Completed</span>
                </div>
                <p className="text-3xl font-black">
                  {allUsers.reduce((acc, curr) => acc + (curr.tasksCompleted?.length || 0), 0)}
                </p>
              </div>
            </div>

            <section className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <Send className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Broadcast Message</h2>
              </div>
              <p className="text-xs text-slate-400 font-medium">Send a Telegram message to all registered users.</p>
              <textarea 
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Type your message here (HTML supported)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 min-h-[150px] focus:outline-none focus:border-purple-500 transition-all font-medium text-sm"
              />
              <button 
                onClick={handleBroadcast}
                disabled={isBroadcasting}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 rounded-2xl font-bold transition-all shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2"
              >
                {isBroadcasting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isBroadcasting ? 'Sending...' : 'Send to All Users'}
              </button>
            </section>
          </div>
        )}

        {activeAdminTab === 'settings' && (
          <div className="space-y-12">
            <header className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] sticky top-24 z-40 backdrop-blur-xl">
              <div>
                <h2 className="text-2xl font-black tracking-tight">App Settings</h2>
                <p className="text-xs text-slate-400 font-medium">Configure rewards, bot tokens, and app behavior.</p>
              </div>
              <button 
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-xl",
                  success ? "bg-emerald-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                )}
              >
                {saving ? 'Saving...' : success ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </header>

            <div className="grid gap-6">
          {/* General Settings */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">General Configuration</h2>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Globe className="w-3 h-3" /> App Name
                </label>
                <input 
                  type="text" 
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center bg-slate-900">
                  {settings.appLogo ? (
                    <img 
                      src={settings.appLogo} 
                      alt="Logo Preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://telegram.org/img/t_logo.png';
                      }}
                    />
                  ) : (
                    <Send className="w-10 h-10 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> App Logo URL
                  </label>
                  <input 
                    type="text" 
                    value={settings.appLogo}
                    onChange={(e) => setSettings({ ...settings, appLogo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Bot className="w-3 h-3" /> Bot Username
                  </label>
                  <input 
                    type="text" 
                    value={settings.botUsername}
                    onChange={(e) => setSettings({ ...settings, botUsername: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Bot className="w-3 h-3" /> App Short Name
                  </label>
                  <input 
                    type="text" 
                    value={settings.appShortName}
                    onChange={(e) => setSettings({ ...settings, appShortName: e.target.value })}
                    placeholder="e.g. app"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Zone ID
                  </label>
                  <input 
                    type="text" 
                    value={settings.monetagZoneId}
                    onChange={(e) => setSettings({ ...settings, monetagZoneId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3" /> SDK ID
                  </label>
                  <input 
                    type="text" 
                    value={settings.monetagSdkId}
                    onChange={(e) => setSettings({ ...settings, monetagSdkId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> Earning Per Ad (USD)
                  </label>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={settings.earningPerAd}
                    onChange={(e) => setSettings({ ...settings, earningPerAd: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> User Share (%)
                  </label>
                  <input 
                    type="number" 
                    value={settings.userSharePercentage}
                    onChange={(e) => setSettings({ ...settings, userSharePercentage: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> Refer Reward
                  </label>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={settings.referReward}
                    onChange={(e) => setSettings({ ...settings, referReward: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> Common Ad Reward
                  </label>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={settings.commonAdReward}
                    onChange={(e) => setSettings({ ...settings, commonAdReward: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Unique Ad Reward
                  </label>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={settings.uniqueAdReward}
                    onChange={(e) => setSettings({ ...settings, uniqueAdReward: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <PlayCircle className="w-3 h-3" /> Common Ads Target
                  </label>
                  <input 
                    type="number" 
                    value={settings.commonAdsTarget}
                    onChange={(e) => setSettings({ ...settings, commonAdsTarget: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Coins className="w-3 h-3" /> Currency Symbol
                  </label>
                  <input 
                    type="text" 
                    value={settings.currencySymbol}
                    onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" /> Exchange Rate (1 USD = X BDT)
                  </label>
                  <input 
                    type="number" 
                    value={settings.exchangeRate}
                    onChange={(e) => setSettings({ ...settings, exchangeRate: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Users className="w-3 h-3" /> Referral Commission (%)
                  </label>
                  <input 
                    type="number" 
                    value={settings.referralCommissionPercentage}
                    onChange={(e) => setSettings({ ...settings, referralCommissionPercentage: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Notice Settings */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">Notice Settings</h2>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Popup Notice (On App Start)
                  </label>
                  <textarea 
                    value={settings.popupNotice}
                    onChange={(e) => setSettings({ ...settings, popupNotice: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Megaphone className="w-3 h-3" /> Home Notice (Scrolling)
                  </label>
                  <textarea 
                    value={settings.homeNotice}
                    onChange={(e) => setSettings({ ...settings, homeNotice: e.target.value })}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Unique Ad Rules (Popup)
                  </label>
                  <textarea 
                    value={settings.uniqueAdNotice}
                    onChange={(e) => setSettings({ ...settings, uniqueAdNotice: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium resize-none"
                    placeholder="Enter instructions for unique ads..."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Bot Settings */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Telegram Bot Configuration</h2>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Bot className="w-3 h-3" /> Bot Token
                </label>
                <input 
                  type="password" 
                  value={settings.botToken}
                  onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Globe className="w-3 h-3" /> New User Channel ID
                  </label>
                  <input 
                    type="text" 
                    value={settings.newUserChannel}
                    onChange={(e) => setSettings({ ...settings, newUserChannel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> Withdraw Channel ID
                  </label>
                  <input 
                    type="text" 
                    value={settings.withdrawChannel}
                    onChange={(e) => setSettings({ ...settings, withdrawChannel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> New User Message Template
                </label>
                <textarea 
                  value={settings.newUserMsgTemplate}
                  onChange={(e) => setSettings({ ...settings, newUserMsgTemplate: e.target.value })}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium text-xs font-mono"
                />
                <p className="text-[10px] text-slate-500">Placeholders: {'{name}, {userid}, {username}, {join_time}, {bot_username}'}</p>
              </div>
            </div>
          </section>

          {/* Tasks Section */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Tasks Management</h2>
              <button 
                onClick={addTask}
                className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20"
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>
            </div>

            <div className="space-y-4">
              {settings.tasks.map((task) => (
                <div key={task.id} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6 relative group">
                  <div className="flex items-center justify-between">
                    <input 
                      type="text" 
                      value={task.title}
                      onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                      className="bg-transparent border-none focus:outline-none font-black text-xl w-full tracking-tight"
                    />
                    <button onClick={() => removeTask(task.id)} className="text-slate-600 hover:text-red-500 p-2 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Task Type</label>
                      <select 
                        value={task.type}
                        onChange={(e) => updateTask(task.id, 'type', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                      >
                        <option value="DEFAULT">Default Link</option>
                        <option value="TELEGRAM_CHANNEL">Telegram Channel</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reward ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={task.reward}
                        onChange={(e) => updateTask(task.id, 'reward', parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Must Task</label>
                      <button 
                        onClick={() => updateTask(task.id, 'isMustTask', !task.isMustTask)}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-sm font-bold transition-all border",
                          task.isMustTask 
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                            : "bg-slate-900 text-slate-500 border-slate-800"
                        )}
                      >
                        {task.isMustTask ? 'YES (Required for Referral)' : 'NO (Normal Task)'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Link</label>
                      <input 
                        type="text" 
                        value={task.link}
                        onChange={(e) => updateTask(task.id, 'link', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                      />
                    </div>
                    
                    {task.type === 'TELEGRAM_CHANNEL' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Channel ID (e.g. -100...)</label>
                        <input 
                          type="text" 
                          value={task.channelId || ''}
                          onChange={(e) => updateTask(task.id, 'channelId', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logo URL</label>
                      <input 
                        type="text" 
                        value={task.logoUrl || ''}
                        onChange={(e) => updateTask(task.id, 'logoUrl', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {settings.tasks.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto" />
                  <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">No active tasks</p>
                </div>
              )}
            </div>
          </section>

          {/* Support Links Section */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Support Links</h2>
              <button 
                onClick={addSupportLink}
                className="flex items-center gap-2 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-4 py-2 rounded-xl border border-purple-500/20"
              >
                <Plus className="w-4 h-4" /> Add Support
              </button>
            </div>

            <div className="grid gap-4">
              {settings.supportLinks?.map((link) => (
                <div key={link.id} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 relative group">
                  <div className="flex items-center justify-between">
                    <input 
                      type="text" 
                      value={link.name}
                      onChange={(e) => updateSupportLink(link.id, 'name', e.target.value)}
                      className="bg-transparent border-none focus:outline-none font-bold text-lg w-full"
                      placeholder="Support Name (e.g. Join Telegram)"
                    />
                    <button onClick={() => removeSupportLink(link.id)} className="text-slate-600 hover:text-red-500 p-2 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform</label>
                      <select 
                        value={link.platform}
                        onChange={(e) => updateSupportLink(link.id, 'platform', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                      >
                        <option value="telegram">Telegram</option>
                        <option value="facebook">Facebook</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Link URL</label>
                      <input 
                        type="text" 
                        value={link.link}
                        onChange={(e) => updateSupportLink(link.id, 'link', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!settings.supportLinks || settings.supportLinks.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">No support links added</p>
                </div>
              )}
            </div>
          </section>

          {/* Withdrawal Settings Section */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Withdrawal Configuration</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase">System Status:</span>
                <button 
                  onClick={() => setSettings({ ...settings, isWithdrawEnabled: !settings.isWithdrawEnabled })}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                    settings.isWithdrawEnabled 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                  )}
                >
                  {settings.isWithdrawEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <DollarSign className="w-3 h-3" /> Minimum Withdrawal ({settings.currencySymbol})
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.minWithdrawAmount}
                  onChange={(e) => setSettings({ ...settings, minWithdrawAmount: parseFloat(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase">Enabled Methods</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(settings.methods).map(([method, enabled]) => (
                  <button
                    key={method}
                    onClick={() => setSettings({
                      ...settings,
                      methods: { ...settings.methods, [method]: !enabled }
                    })}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      enabled 
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                        : "bg-slate-950 border-slate-800 text-slate-600"
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest">{method}</span>
                    {enabled ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    )}

        {activeAdminTab === 'withdrawals' && (
          <div className="space-y-8">
            <header className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem]">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Withdrawal Requests</h2>
                <p className="text-xs text-slate-400 font-medium">Manage and process user withdrawal requests.</p>
              </div>
              <button 
                onClick={fetchWithdrawals}
                className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Method</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {withdrawals.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">{req.username}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{req.telegramId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-blue-400">{req.amount} {settings.currencySymbol}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest">{req.method}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-300">{req.details}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            req.status === 'pending' ? "bg-amber-500/10 text-amber-500" :
                            req.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                            "bg-red-500/10 text-red-500"
                          )}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  setShowConfirmModal({
                                    show: true,
                                    title: 'Approve Withdrawal',
                                    message: `Are you sure you want to approve the withdrawal of ${req.amount} ${settings.currencySymbol} for ${req.username}?`,
                                    type: 'success',
                                    onConfirm: () => {
                                      handleUpdateWithdrawalStatus(req.id, 'completed');
                                      setShowConfirmModal(prev => ({ ...prev, show: false }));
                                    }
                                  });
                                }}
                                className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setShowConfirmModal({
                                    show: true,
                                    title: 'Reject Withdrawal',
                                    message: `Are you sure you want to reject the withdrawal of ${req.amount} ${settings.currencySymbol} for ${req.username}?`,
                                    type: 'danger',
                                    onConfirm: () => {
                                      handleUpdateWithdrawalStatus(req.id, 'rejected');
                                      setShowConfirmModal(prev => ({ ...prev, show: false }));
                                    }
                                  });
                                }}
                                className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                          No withdrawal requests found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === 'users' && (
          <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] gap-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">User Management</h2>
                <p className="text-xs text-slate-400 font-medium">Search, ban, and manage user accounts.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setUserFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      userFilter === 'all' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    All Users
                  </button>
                  <button 
                    onClick={() => setUserFilter('banned')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      userFilter === 'banned' ? "bg-red-600 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Banned
                  </button>
                </div>
                <div className="relative group min-w-[250px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search by ID or Username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </header>

            {/* Direct Ban Section */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2rem] space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Direct Ban by ID</h3>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="Enter Telegram User ID..."
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-red-500 transition-colors font-medium"
                />
                <button 
                  onClick={handleDirectBan}
                  className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-red-600/20 flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" /> Ban User
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {allUsers
                .filter(u => {
                  const matchesSearch = (u.telegramId || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                                      (u.username || "").toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = userFilter === 'all' || (userFilter === 'banned' && u.isBanned);
                  return matchesSearch && matchesFilter;
                })
                .map((u) => (
                  <div key={u.telegramId} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <img src={u.photoUrl} alt={u.username} className="w-12 h-12 rounded-2xl object-cover border border-slate-800" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{u.firstName}</h3>
                          {u.isBanned && <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-full border border-red-500/20">Banned</span>}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">@{u.username} • ID: {u.telegramId}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Balance</p>
                        <p className="text-lg font-black text-blue-400">{u.earnings.toFixed(2)} {settings.currencySymbol}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const amount = prompt('Enter amount to add (use negative for subtract):');
                            if (amount) {
                              const parsed = parseFloat(amount);
                              if (!isNaN(parsed)) {
                                setShowConfirmModal({
                                  show: true,
                                  title: 'Adjust Balance',
                                  message: `Are you sure you want to ${parsed > 0 ? 'add' : 'subtract'} ${Math.abs(parsed)} ${settings.currencySymbol} to ${u.firstName}'s balance?`,
                                  type: 'info',
                                  onConfirm: () => {
                                    handleAdjustBalance(u.telegramId, parsed);
                                    setShowConfirmModal(prev => ({ ...prev, show: false }));
                                  }
                                });
                              }
                            }
                          }}
                          className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 transition-colors"
                          title="Adjust Balance"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setShowConfirmModal({
                              show: true,
                              title: u.isBanned ? 'Unban User' : 'Ban User',
                              message: `Are you sure you want to ${u.isBanned ? 'unban' : 'ban'} ${u.firstName}?`,
                              type: u.isBanned ? 'success' : 'danger',
                              onConfirm: () => {
                                handleBanUser(u.telegramId, !u.isBanned);
                                setShowConfirmModal(prev => ({ ...prev, show: false }));
                              }
                            });
                          }}
                          className={cn(
                            "p-3 rounded-xl border transition-colors",
                            u.isBanned 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20" 
                              : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                          )}
                          title={u.isBanned ? 'Unban User' : 'Ban User'}
                        >
                          {u.isBanned ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl",
                showConfirmModal.type === 'danger' ? "bg-red-500/10 text-red-500" :
                showConfirmModal.type === 'success' ? "bg-emerald-500/10 text-emerald-500" :
                "bg-blue-500/10 text-blue-500"
              )}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">{showConfirmModal.title}</h2>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              {showConfirmModal.message}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(prev => ({ ...prev, show: false }))}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={showConfirmModal.onConfirm}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-bold transition-all text-white",
                  showConfirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-500 shadow-red-600/20" :
                  showConfirmModal.type === 'success' ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20" :
                  "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
