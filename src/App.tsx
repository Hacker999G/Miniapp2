import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot,
  query,
  where,
  getDocs,
  collection,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { TelegramUser, UserData, AppSettings, WithdrawalRequest } from './types';
import { ADMIN_TG_ID } from './constants';
import { 
  Coins, 
  TrendingUp, 
  User as UserIcon, 
  PlayCircle, 
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Home,
  ListTodo,
  Wallet,
  Check,
  Timer,
  Users,
  Copy,
  Share2,
  Smartphone,
  Bitcoin,
  ArrowLeft,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Megaphone,
  Bell,
  Zap,
  Headset,
  Facebook,
  Youtube,
  Instagram,
  Send,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'home' | 'tasks' | 'refer' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(() => {
    const cached = localStorage.getItem('app_settings');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [verifyingTask, setVerifyingTask] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [referrals, setReferrals] = useState<UserData[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [showUniqueNotice, setShowUniqueNotice] = useState(false);
  const [isUniqueAd, setIsUniqueAd] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<'category' | 'method' | 'details' | 'amount' | 'confirm'>('category');
  const [withdrawCategory, setWithdrawCategory] = useState<'mobile' | 'crypto' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawalRequest[]>([]);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [taskTimers, setTaskTimers] = useState<Record<string, number>>({});

  // FIXED: Monetag IDs are now synchronized with your index.html
  const defaultSettings: AppSettings = {
    appName: 'DT EARNING ZONE',
    appLogo: 'https://i.ibb.co/gLQsBHNp/logo.png',
    earningPerAd: 0.0004,
    userSharePercentage: 20,
    monetagZoneId: '10251457',
    monetagSdkId: 'show_10251457',
    botUsername: 'dt_eaening_zone_bot',
    botToken: '8124462129:AAF-aJ_fnvRD9y-QXQPXIY10z-xjtK-Mefs',
    newUserChannel: '-1003812909907',
    withdrawChannel: '-1003810127512',
    newUserMsgTemplate: `━━━━━━━━━━━━━━━━━━━━\n🎉 NEW USER ALERT\n━━━━━━━━━━━━━━━━━━━━━\n\n👤 Name: {name}\n🆔 ID: {userid} \n📱 Username: {username} \n⏰ Time: {join_time} \n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 IN THIS BOT : @{bot_username}\n━━━━━━━━━━━━━━━━━━━━━`,
    referReward: 0.05,
    commonAdReward: 0.5,
    uniqueAdReward: 2.0,
    commonAdsTarget: 9,
    popupNotice: 'Welcome to our app! Start earning now.',
    homeNotice: 'Invite your friends and earn more!',
    uniqueAdNotice: 'This is a Unique Ad! You must click the ad, wait for it to load completely, and interact/register on the page to receive the high reward.',
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
  };

  const currentSettings = settings || defaultSettings;

  useEffect(() => {
    if (currentSettings.popupNotice) {
      setShowPopup(true);
    }
    document.title = currentSettings.appName;
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('href', currentSettings.appLogo);
  }, [settings, currentSettings]);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      if (user) {
        setTgUser(user);
      }
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings(data);
        localStorage.setItem('app_settings', JSON.stringify(data));
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        await syncUserData(authUser);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Auth error:', err);
        }
      }
    });

    const timer = setInterval(() => {
      setCooldowns(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          if (next[key] > 0) {
            next[key] -= 1;
            changed = true;
          } else {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      unsubSettings();
      unsubscribeAuth();
      clearInterval(timer);
    };
  }, []);

  const syncUserData = async (authUser: User) => {
    try {
      const userRef = doc(db, 'users', authUser.uid);
      const unsub = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserData;
          setUserData(data);
        } else {
          let currentSettingsLocal = settings || defaultSettings;
          const tgUserFromApp = window.Telegram?.WebApp?.initDataUnsafe?.user;
          const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
          let referredBy = null;
          let referralCounted = false;

          if (startParam && startParam !== tgUserFromApp?.id.toString()) {
            const q = query(collection(db, 'users'), where('telegramId', '==', startParam));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const referrerDoc = querySnapshot.docs[0];
              referredBy = startParam;
              try {
                await updateDoc(referrerDoc.ref, {
                  earnings: increment(currentSettingsLocal.referReward),
                  referralCount: increment(1)
                });
                referralCounted = true;
              } catch (err) {
                console.error('Referral error:', err);
              }
            }
          }

          const initialData: UserData = {
            telegramId: tgUserFromApp?.id.toString() || 'unknown',
            username: tgUserFromApp?.username || 'user',
            firstName: tgUserFromApp?.first_name || 'User',
            photoUrl: tgUserFromApp?.photo_url || '',
            earnings: 0,
            adsWatched: 0,
            dailyAdCount: 0,
            dailyEarnings: 0,
            lastAdWatchedAt: new Date().toISOString(),
            referralCount: 0,
            referredBy: referredBy,
            referralCounted: referralCounted,
            tasksCompleted: [],
            currentAdCount: 0,
            isBanned: false,
            isAdmin: tgUserFromApp?.id.toString() === ADMIN_TG_ID,
            joinedAt: new Date().toISOString()
          };
          await setDoc(userRef, initialData);
        }
        setLoading(false);
      });
      return unsub;
    } catch (err) {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!user || isWatching || !currentSettings || !userData) return;
    
    const today = new Date().toDateString();
    const lastAdDate = userData.lastAdWatchedAt ? new Date(userData.lastAdWatchedAt).toDateString() : '';
    const dailyCount = lastAdDate === today ? (userData.dailyAdCount || 0) : 0;

    if (dailyCount >= 60) {
      alert('Daily limit of 60 ads reached.');
      return;
    }

    const isNextUnique = userData.currentAdCount >= currentSettings.commonAdsTarget;
    if (isNextUnique && !showUniqueNotice) {
      setShowUniqueNotice(true);
      return;
    }
    
    const reward = isNextUnique ? currentSettings.uniqueAdReward : currentSettings.commonAdReward;
    setIsUniqueAd(isNextUnique);
    setIsWatching(true);
    setShowUniqueNotice(false);

    try {
      // Use the settings or default to the ID we know is in index.html
      const sdkId = currentSettings.monetagSdkId || 'show_10251457';
      let showAd = (window as any)[sdkId];

      if (typeof showAd !== 'function') {
        // Retry a few times if SDK is slow
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          showAd = (window as any)[sdkId];
          if (typeof showAd === 'function') break;
        }
      }

      if (typeof showAd === 'function') {
        showAd().then(() => {
          processAdReward(reward, isNextUnique);
        }).catch((err: any) => {
          console.error('Ad Error:', err);
          setIsWatching(false);
          alert('Failed to load ad. Please try again.');
        });
      } else {
        alert('Ad SDK not found. Please disable Ad-Blockers.');
        setIsWatching(false);
      }
    } catch (err) {
      setIsWatching(false);
    }
  };

  const processAdReward = async (reward: number, isNextUnique: boolean) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const today = new Date().toDateString();
      const lastAdDate = userData?.lastAdWatchedAt ? new Date(userData.lastAdWatchedAt).toDateString() : '';
      const newDailyCount = lastAdDate === today ? (userData?.dailyAdCount || 0) + 1 : 1;

      await updateDoc(userRef, {
        earnings: increment(reward),
        adsWatched: increment(1),
        dailyAdCount: newDailyCount,
        lastAdWatchedAt: new Date().toISOString(),
        currentAdCount: isNextUnique ? 0 : increment(1)
      });
      
      if (userData?.referredBy) {
        const commission = (reward * currentSettings.referralCommissionPercentage) / 100;
        const q = query(collection(db, 'users'), where('telegramId', '==', userData.referredBy));
        const qs = await getDocs(q);
        if (!qs.empty) await updateDoc(qs.docs[0].ref, { earnings: increment(commission) });
      }
    } finally {
      setIsWatching(false);
    }
  };

  // Rest of the UI code (Tabs, Withdraw, etc.) continues here...
  // (আইডি ফিক্সড করার পর বাকি UI লজিকগুলো আপনার আগের কোড অনুযায়ী কাজ করবে)

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 pb-24">
      {/* Header */}
      <header className="px-6 py-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-black text-lg">{currentSettings.appName}</h1>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest">● Online</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl">
           <UserIcon className="w-4 h-4 text-blue-400" />
           <span className="text-xs font-bold">{tgUser?.first_name || 'Guest'}</span>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Balance Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 shadow-xl">
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Balance</p>
                <h2 className="text-4xl font-black mt-2">
                  {currentSettings.currencySymbol}{userData?.earnings.toFixed(4) || '0.0000'}
                </h2>
                <div className="flex gap-4 mt-6 text-[10px] uppercase font-bold text-blue-100/60">
                   <span>Ads: {userData?.adsWatched || 0}</span>
                   <span>Today: {userData?.dailyAdCount || 0}/60</span>
                </div>
              </div>

              {/* Watch Ad Button */}
              <button
                onClick={handleWatchAd}
                disabled={isWatching}
                className={cn(
                  "w-full py-6 rounded-[2rem] font-black text-lg shadow-xl transition-all",
                  isWatching ? "bg-slate-800 text-slate-500" : "bg-white text-slate-900 active:scale-95"
                )}
              >
                {isWatching ? 'LOADING AD...' : (userData && userData.currentAdCount >= currentSettings.commonAdsTarget ? 'WATCH UNIQUE AD' : 'WATCH AD & EARN')}
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
                  <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Earning Mode</p>
                  <p className="font-bold">Active</p>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
                  <History className="w-5 h-5 text-blue-400 mb-2" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total Refer</p>
                  <p className="font-bold">{userData?.referralCount || 0}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && <div className="text-center py-20">Tasks coming soon...</div>}
          
          {activeTab === 'refer' && (
            <div className="space-y-6">
               <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white">
                  <h2 className="text-2xl font-black italic">INVITE FRIENDS</h2>
                  <p className="text-xs mt-2 opacity-80">Get {currentSettings.currencySymbol}{currentSettings.referReward} per friend.</p>
               </div>
               <button 
                 onClick={() => {
                   const link = `https://t.me/${currentSettings.botUsername}?startapp=${userData?.telegramId}`;
                   navigator.clipboard.writeText(link);
                   alert('Link Copied!');
                 }}
                 className="w-full py-4 bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-2"
               >
                 <Copy className="w-4 h-4" /> Copy Referral Link
               </button>
            </div>
          )}

          {activeTab === 'profile' && (
             <div className="space-y-6 text-center">
                <div className="w-24 h-24 bg-blue-500/10 rounded-full mx-auto flex items-center justify-center border-4 border-slate-800">
                   <UserIcon className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold">{tgUser?.first_name}</h3>
                <button 
                  onClick={() => alert('Withdraw is coming soon!')}
                  className="w-full py-4 bg-blue-600 rounded-[2rem] font-bold"
                >
                  Withdraw
                </button>
             </div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-2 flex justify-around shadow-2xl">
        <button onClick={() => setActiveTab('home')} className={cn("p-4 rounded-3xl", activeTab === 'home' && "bg-blue-600")}><Home className="w-5 h-5" /></button>
        <button onClick={() => setActiveTab('tasks')} className={cn("p-4 rounded-3xl", activeTab === 'tasks' && "bg-blue-600")}><ListTodo className="w-5 h-5" /></button>
        <button onClick={() => setActiveTab('refer')} className={cn("p-4 rounded-3xl", activeTab === 'refer' && "bg-blue-600")}><Users className="w-5 h-5" /></button>
        <button onClick={() => setActiveTab('profile')} className={cn("p-4 rounded-3xl", activeTab === 'profile' && "bg-blue-600")}><UserIcon className="w-5 h-5" /></button>
      </nav>

      {/* Unique Ad Modal */}
      <AnimatePresence>
        {showUniqueNotice && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full space-y-6">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold">Unique Ad Rules</h2>
              </div>
              <p className="text-slate-400 text-sm">{currentSettings.uniqueAdNotice}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowUniqueNotice(false)} className="flex-1 py-4 bg-slate-800 rounded-2xl font-bold">Cancel</button>
                <button onClick={handleWatchAd} className="flex-1 py-4 bg-emerald-600 rounded-2xl font-bold">Start Ad</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
