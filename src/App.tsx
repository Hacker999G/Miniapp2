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

  const defaultSettings: AppSettings = {
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
🤖 IN THIS BOT : @{bot_username}
━━━━━━━━━━━━━━━━━━━━━`,
    referReward: 0.05,
    commonAdReward: 0.5,
    uniqueAdReward: 2.0,
    commonAdsTarget: 9,
    popupNotice: 'Welcome to our app! Start earning now.',
    homeNotice: 'Invite your friends and earn more!',
    uniqueAdNotice: 'This is a Unique Ad! You must click the ad, wait for it to load completely, and interact/register on the page to receive the high reward. Failure to do so may result in no reward.',
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
    // Update document title and favicon
    document.title = currentSettings.appName;
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('href', currentSettings.appLogo);
  }, [settings]);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const user = window.Telegram.WebApp.initDataUnsafe.user;
      if (user) {
        setTgUser(user);
      }
    }

    // Fetch Global Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings(data);
        localStorage.setItem('app_settings', JSON.stringify(data));
      } else {
        // We don't initialize settings from the client anymore to avoid permission errors.
        // The admin panel should handle this.
        console.warn('Settings not found. Please initialize them in the Admin Panel.');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/config');
    });

    // Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        await syncUserData(authUser);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Auth error:', err);
          setError('Failed to authenticate. Please try again.');
        }
      }
    });

    // Cooldown Timer
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

  const sendNewUserAlert = async (tgUser: TelegramUser, currentSettings: AppSettings) => {
    if (!currentSettings.botToken || !currentSettings.newUserChannel) return;

    const message = currentSettings.newUserMsgTemplate
      .replace('{name}', tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''))
      .replace('{userid}', tgUser.id.toString())
      .replace('{username}', tgUser.username ? `@${tgUser.username}` : 'N/A')
      .replace('{join_time}', new Date().toLocaleString())
      .replace('{bot_username}', currentSettings.botUsername);

    try {
      await fetch('/api/telegram/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: currentSettings.botToken,
          chatId: currentSettings.newUserChannel,
          text: message,
          replyMarkup: {
            inline_keyboard: [[
              { text: 'Earn Now', url: `https://t.me/${currentSettings.botUsername}` }
            ]]
          }
        })
      });
    } catch (err) {
      console.error('Failed to send alert:', err);
    }
  };

  const syncUserData = async (authUser: User) => {
    try {
      const userRef = doc(db, 'users', authUser.uid);
      
      const unsub = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
        } else {
          // Fetch settings if not available
          let currentSettingsLocal = settings || defaultSettings;
          if (!settings) {
            const settingsSnap = await getDoc(doc(db, 'settings', 'config'));
            if (settingsSnap.exists()) {
              currentSettingsLocal = settingsSnap.data() as AppSettings;
            }
          }

          const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
          let referredBy = null;
          let referralCounted = false;

          if (startParam && startParam !== tgUser?.id.toString()) {
            // Find referrer
            const q = query(collection(db, 'users'), where('telegramId', '==', startParam));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const referrerDoc = querySnapshot.docs[0];
              referredBy = startParam;
              referralCounted = true;
              
              // Credit referrer
              if (currentSettingsLocal) {
                await updateDoc(referrerDoc.ref, {
                  earnings: increment(currentSettingsLocal.referReward),
                  referralCount: increment(1)
                });
              }
            }
          }

          const tgUserFromApp = window.Telegram?.WebApp?.initDataUnsafe?.user;
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
          setDoc(userRef, initialData).then(() => {
            if (tgUserFromApp && currentSettingsLocal) {
              sendNewUserAlert(tgUserFromApp, currentSettingsLocal);
            }
          }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${authUser.uid}`));
        }
        // Only set loading to false if settings are also loaded
        if (settings) {
          setLoading(false);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
      });

      return unsub;
    } catch (err) {
      console.error('Sync error:', err);
      setError('Failed to sync data.');
      setLoading(false);
    }
  };

  // Separate effect to handle loading state based on both userData and settings
  useEffect(() => {
    if (userData && settings && loading) {
      setLoading(false);
    }
  }, [userData, settings, loading]);

  useEffect(() => {
    if (activeTab === 'refer' && userData?.telegramId) {
      const q = query(collection(db, 'users'), where('referredBy', '==', userData.telegramId));
      const unsub = onSnapshot(q, (querySnapshot) => {
        const refs: UserData[] = [];
        querySnapshot.forEach((doc) => {
          refs.push(doc.data() as UserData);
        });
        setReferrals(refs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users (referrals)');
      });
      return () => unsub();
    }
  }, [activeTab, userData?.telegramId]);

  useEffect(() => {
    if (activeTab === 'profile' && user) {
      const q = query(
        collection(db, 'withdrawals'),
        where('userId', '==', user.uid)
      );
      const unsub = onSnapshot(q, (snap) => {
        const reqs: WithdrawalRequest[] = [];
        snap.forEach(doc => reqs.push({ id: doc.id, ...doc.data() } as WithdrawalRequest));
        // Sort manually to avoid index requirement for now
        reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setWithdrawRequests(reqs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'withdrawals');
      });
      return () => unsub();
    }
  }, [activeTab, user]);

  const handleCopyReferLink = () => {
    if (!userData || !currentSettings) return;
    const link = `https://t.me/${currentSettings.botUsername}?startapp=${userData.telegramId}`;
    
    // Fallback for clipboard copy
    const copyToClipboard = (text: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return Promise.resolve();
        } catch (err) {
          document.body.removeChild(textArea);
          return Promise.reject(err);
        }
      }
    };

    copyToClipboard(link).then(() => {
      alert('Referral link copied!');
    }).catch(err => {
      console.error('Copy failed:', err);
      setError('Failed to copy link. Please try manually.');
    });
  };

  const handleShareReferLink = () => {
    if (!userData || !currentSettings) return;
    const link = `https://t.me/${currentSettings.botUsername}?startapp=${userData.telegramId}`;
    const text = `Join this bot and earn money! ${link}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const creditReferrer = async (amount: number) => {
    if (!userData?.referredBy || !currentSettings) return;
    try {
      const commission = (amount * currentSettings.referralCommissionPercentage) / 100;
      if (commission <= 0) return;

      const q = query(collection(db, 'users'), where('telegramId', '==', userData.referredBy));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const referrerDoc = querySnapshot.docs[0];
        await updateDoc(referrerDoc.ref, {
          earnings: increment(commission)
        });
      }
    } catch (err) {
      console.error('Referral commission error:', err);
    }
  };

  const handleWatchAd = async () => {
    if (!user || isWatching || !currentSettings || !userData) return;
    
    // Check daily limit (60 ads)
    const lastAdDate = userData.lastAdWatchedAt ? new Date(userData.lastAdWatchedAt).toDateString() : '';
    const today = new Date().toDateString();
    const dailyCount = lastAdDate === today ? (userData.dailyAdCount || 0) : 0;

    if (dailyCount >= 60) {
      alert('You have reached your daily limit of 60 ads. Please come back tomorrow!');
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
      // Strictly use Monetag SDK for Telegram Mini App
      const zoneId = currentSettings.monetagZoneId || '10754815';
      const sdkId = currentSettings.monetagSdkId || `show_${zoneId}`;
      
      // Aggressive check and wait for SDK (up to 5 seconds)
      let showAd = (window as any)[sdkId];
      
      if (typeof showAd !== 'function') {
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          showAd = (window as any)[sdkId];
          if (typeof showAd === 'function') break;
        }
      }
      
      if (typeof showAd === 'function') {
        // Call the Monetag SDK function (e.g., show_10754815)
        // Using 'rewarded' for in-app rewarded video
        showAd('rewarded').then(() => {
          // Ad shown successfully - credit reward
          processAdReward(reward, isNextUnique);
        }).catch((err: any) => {
          console.error('Monetag SDK error:', err);
          alert('Ad failed to load. Please try again later.');
          setIsWatching(false);
          setIsUniqueAd(false);
        });
      } else {
        // SDK not loaded yet or blocked
        console.error('Monetag SDK not found after retries:', sdkId);
        alert('Ad system is not ready. Please disable any Ad Blockers and try again in a few seconds.');
        setIsWatching(false);
        setIsUniqueAd(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setIsWatching(false);
      setIsUniqueAd(false);
    }
  };

  const processAdReward = async (reward: number, isNextUnique: boolean) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    try {
      const today = new Date().toDateString();
      const lastAdDate = userData?.lastAdWatchedAt ? new Date(userData.lastAdWatchedAt).toDateString() : '';
      const newDailyCount = lastAdDate === today ? (userData?.dailyAdCount || 0) + 1 : 1;
      const newDailyEarnings = lastAdDate === today ? (userData?.dailyEarnings || 0) + reward : reward;

      if (isNextUnique) {
        await updateDoc(userRef, {
          earnings: increment(reward),
          adsWatched: increment(1),
          dailyAdCount: newDailyCount,
          dailyEarnings: newDailyEarnings,
          lastAdWatchedAt: new Date().toISOString(),
          currentAdCount: 0
        });
        alert('Unique Ad reward credited! Thank you for interacting.');
      } else {
        await updateDoc(userRef, {
          earnings: increment(reward),
          adsWatched: increment(1),
          dailyAdCount: newDailyCount,
          dailyEarnings: newDailyEarnings,
          lastAdWatchedAt: new Date().toISOString(),
          currentAdCount: increment(1)
        });
      }
      
      await creditReferrer(reward);
    } catch (err) {
      console.error('Reward processing error:', err);
    } finally {
      setIsWatching(false);
      setIsUniqueAd(false);
    }
  };

  const handleTaskClick = (task: any) => {
    if (!user || !currentSettings || userData?.tasksCompleted?.includes(task.id)) return;
    
    // Open link
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(task.link);
    } else {
      window.open(task.link, '_blank');
    }

    // Start 10s timer
    setTaskTimers(prev => ({ ...prev, [task.id]: 10 }));
    
    const interval = setInterval(() => {
      setTaskTimers(prev => {
        const current = prev[task.id] || 0;
        if (current <= 1) {
          clearInterval(interval);
          return { ...prev, [task.id]: 0 };
        }
        return { ...prev, [task.id]: current - 1 };
      });
    }, 1000);
  };

  const handleTaskVerify = async (task: any) => {
    if (!user || !currentSettings || taskTimers[task.id] > 0 || userData?.tasksCompleted?.includes(task.id)) return;

    setVerifyingTask(task.id);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Update user data
      const updates: any = {
        earnings: increment(task.reward),
        tasksCompleted: arrayUnion(task.id)
      };

      await updateDoc(userRef, updates);

      // Standard commission
      await creditReferrer(task.reward);

      setVerifyingTask(null);
      alert('Task completed! Reward added.');
    } catch (err) {
      console.error('Task verification error:', err);
      setVerifyingTask(null);
      setError('Failed to verify task. Please try again.');
    }
  };

  const handleWithdraw = () => {
    if (!currentSettings.isWithdrawEnabled) {
      alert('Withdrawal currently off. It will open in few moments. Please wait.');
      return;
    }
    if (userData && userData.earnings < currentSettings.minWithdrawAmount) {
      setError(`Minimum withdrawal is ${currentSettings.currencySymbol}${currentSettings.minWithdrawAmount}`);
      return;
    }
    setWithdrawStep('category');
    setWithdrawCategory(null);
    setSelectedMethod(null);
    setWithdrawDetails('');
    setWithdrawAmount(userData?.earnings.toString() || '0');
    setIsWithdrawModalOpen(true);
  };

  const submitWithdraw = async () => {
    if (!user || !userData || !currentSettings) {
      setError('System not ready. Please try again.');
      return;
    }
    if (!selectedMethod || !withdrawDetails || !withdrawAmount) {
      setError('Please fill all details.');
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < currentSettings.minWithdrawAmount) {
      setError(`Minimum withdrawal is ${currentSettings.currencySymbol}${currentSettings.minWithdrawAmount}`);
      return;
    }
    if (amount > userData.earnings) {
      setError('Insufficient balance');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const withdrawalId = doc(collection(db, 'withdrawals')).id;
      const withdrawalData: WithdrawalRequest = {
        id: withdrawalId,
        userId: user.uid,
        username: userData.username,
        telegramId: userData.telegramId,
        amount: amount,
        method: selectedMethod,
        details: withdrawDetails,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      console.log('Submitting withdrawal...', withdrawalData);
      await setDoc(doc(db, 'withdrawals', withdrawalId), withdrawalData);
      
      // Deduct balance
      console.log('Deducting balance...');
      await updateDoc(doc(db, 'users', user.uid), {
        earnings: increment(-amount)
      });

      // Send to Telegram Channel
      const message = `━━━━━━━━━━━━━━━━━━━━
💰 WITHDRAW REQUEST
━━━━━━━━━━━━━━━━━━━━━

👤 Name: ${userData.firstName}
🆔 ID: ${userData.telegramId}
📱 Username: @${userData.username}
💵 Amount: ${currentSettings.currencySymbol}${amount.toFixed(4)}
💳 Method: ${selectedMethod.toUpperCase()}
📝 Details: ${withdrawDetails}
⏰ Time: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━
🤖 IN THIS BOT : @${currentSettings.botUsername}
━━━━━━━━━━━━━━━━━━━━━`;

      if (currentSettings.botToken && currentSettings.withdrawChannel) {
        await fetch('/api/telegram/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: currentSettings.botToken,
            chatId: currentSettings.withdrawChannel,
            text: message,
          })
        });
      }

      setIsWithdrawModalOpen(false);
      setWithdrawStep('category');
      setWithdrawAmount('');
      setWithdrawDetails('');
      setSelectedMethod(null);
      alert('Withdrawal request submitted successfully!');
    } catch (err: any) {
      console.error('Withdraw error:', err);
      setError(`Failed to submit withdrawal request: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  if (loading) {
    return (
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
            <div className="relative w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-slate-800 shadow-2xl mx-auto bg-slate-900 flex items-center justify-center">
              {currentSettings.appLogo ? (
                <img 
                  src={currentSettings.appLogo} 
                  alt={currentSettings.appName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Send className="w-16 h-16 text-blue-500" />
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              {currentSettings.appName}
            </h1>
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">
                Initializing Secure Session
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (userData?.isBanned) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Account Banned</h1>
          <p className="text-slate-400">Your account has been suspended for violating our terms of service.</p>
          <p className="text-sm text-slate-500">User ID: {userData.telegramId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30 pb-24">
      <header className="px-6 py-6 flex flex-col gap-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-black text-lg leading-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
                {currentSettings.appName}
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                  Official MiniApp
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-800/50 p-1.5 pr-4 rounded-2xl border border-slate-700">
            <div className="relative">
              {tgUser?.photo_url ? (
                <img 
                  src={tgUser.photo_url} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-lg object-cover border border-blue-500/20"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <UserIcon className="w-4 h-4 text-blue-400" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f172a]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white leading-none">
                {tgUser?.first_name || 'Guest'}
              </span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                @{tgUser?.username || 'unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrolling Notice */}
        {currentSettings.homeNotice && (
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-2 overflow-hidden">
            <div className="flex items-center gap-3">
              <Megaphone className="w-3 h-3 text-blue-400 shrink-0" />
              <div className="relative flex-1 overflow-hidden h-4">
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: '-100%' }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  className="absolute whitespace-nowrap text-[10px] font-bold text-blue-200 uppercase tracking-wider"
                >
                  {currentSettings.homeNotice}
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="p-6 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Coins className="w-32 h-32" />
                </div>
                
                <div className="relative z-10">
                  <p className="text-blue-100/80 text-xs font-bold tracking-[0.2em] uppercase mb-2">
                    Your Balance
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tighter">
                      {currentSettings.currencySymbol}{userData?.earnings.toFixed(4) || '0.0000'}
                    </span>
                    <span className="text-blue-200/60 font-bold uppercase text-[10px] tracking-widest">Balance</span>
                  </div>
                  
                  <div className="mt-8 flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold">{userData?.adsWatched || 0}</span>
                      <span className="text-[10px] font-bold text-blue-200/60 uppercase tracking-widest">Total Ads</span>
                    </div>
                    <div className="w-px h-8 bg-blue-400/30" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold">
                        {userData?.lastAdWatchedAt && new Date(userData.lastAdWatchedAt).toDateString() === new Date().toDateString() 
                          ? userData.dailyAdCount || 0 
                          : 0}
                        <span className="text-sm text-blue-200/40 ml-1">/60</span>
                      </span>
                      <span className="text-[10px] font-bold text-blue-200/60 uppercase tracking-widest">Today</span>
                    </div>
                    <div className="w-px h-8 bg-blue-400/30" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold">{userData?.referralCount || 0}</span>
                      <span className="text-[10px] font-bold text-blue-200/60 uppercase tracking-widest">Total Refer</span>
                    </div>
                  </div>
                </div>
              </div>

              <section className="space-y-4">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-1">
                  Daily Earnings
                </h2>
                
                <button
                  onClick={handleWatchAd}
                  disabled={isWatching}
                  className={cn(
                    "w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 transition-all duration-300 font-bold text-lg shadow-xl",
                    isWatching 
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                      : "bg-white text-slate-900 hover:scale-[1.02] active:scale-[0.98] hover:shadow-white/10"
                  )}
                >
                  {isWatching ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {isUniqueAd ? 'Registering...' : 'Watching Ad...'}
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-6 h-6" />
                      {userData && userData.currentAdCount >= currentSettings.commonAdsTarget ? 'Watch Unique Ad' : 'Watch Ad & Earn'}
                    </>
                  )}
                </button>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Progress: {userData?.currentAdCount || 0}/{currentSettings.commonAdsTarget} Ads
                    </p>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                      Next: {userData && userData.currentAdCount >= currentSettings.commonAdsTarget ? 'Unique (High Reward)' : 'Common'}
                    </p>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((userData?.currentAdCount || 0) / currentSettings.commonAdsTarget) * 100, 100)}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
                
                <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Common: <span className="text-blue-400">{currentSettings.currencySymbol}{currentSettings.commonAdReward.toFixed(4)}</span> · Unique: <span className="text-emerald-400">{currentSettings.currencySymbol}{currentSettings.uniqueAdReward.toFixed(4)}</span>
                </p>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] space-y-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Earning Type</p>
                  <p className="text-xl font-bold">Free Earning</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] space-y-2">
                  <History className="w-5 h-5 text-blue-400" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</p>
                  <p className="text-xl font-bold">
                    {currentSettings.currencySymbol}
                    {userData?.lastAdWatchedAt && new Date(userData.lastAdWatchedAt).toDateString() === new Date().toDateString() 
                      ? (userData.dailyEarnings || 0).toFixed(4) 
                      : '0.0000'}
                  </p>
                </div>
              </div>

              {/* Central Animated Logo Section (Moved to the bottom) */}
              <div className="flex flex-col items-center justify-center py-10 relative">
                <div className="relative">
                  {/* Lightning/Electric Aura Effect */}
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      opacity: [0.3, 0.6, 0.3],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                    className="absolute -inset-8 bg-gradient-to-tr from-blue-500 via-cyan-400 to-purple-600 rounded-full blur-3xl opacity-30"
                  />
                  
                  {/* Rotating Lightning Ring */}
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-4 rounded-full border-2 border-transparent border-t-blue-400 border-r-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                  />
                  
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-6 rounded-full border-2 border-transparent border-b-purple-500 border-l-blue-500 opacity-50 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                  />

                  {/* Main Logo Container */}
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="relative w-40 h-40 rounded-[3rem] overflow-hidden border-4 border-slate-800 bg-slate-900 shadow-[0_0_50px_rgba(59,130,246,0.3)] z-10"
                  >
                    {currentSettings.appLogo ? (
                      <img 
                        src={currentSettings.appLogo} 
                        alt={currentSettings.appName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <Send className="w-16 h-16 text-blue-500" />
                      </div>
                    )}
                    
                    {/* Inner Lightning Flash */}
                    <motion.div 
                      animate={{ 
                        opacity: [0, 0.2, 0, 0.1, 0],
                        x: ['-100%', '100%']
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        times: [0, 0.2, 0.4, 0.6, 1],
                        ease: "easeInOut" 
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent skew-x-12"
                    />
                  </motion.div>

                  {/* Pulsing Outer Ring */}
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2],
                      opacity: [0.5, 0]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeOut" 
                    }}
                    className="absolute -inset-2 rounded-[3.5rem] border-2 border-blue-500/30 z-0"
                  />
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <h3 className="text-xl font-black tracking-tighter text-white uppercase italic">
                    {currentSettings.appName}
                  </h3>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em] mt-1">
                    Premium Experience
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Available Tasks</h2>
                <p className="text-xs text-slate-400 font-medium">Complete tasks to earn extra rewards.</p>
              </div>

              <div className="space-y-4">
                {currentSettings.tasks && currentSettings.tasks.filter(t => !userData?.tasksCompleted?.includes(t.id)).length > 0 ? (
                  currentSettings.tasks.filter(t => !userData?.tasksCompleted?.includes(t.id)).map((task) => (
                    <div 
                      key={task.id}
                      className="bg-slate-900/50 border border-slate-800 p-5 rounded-[2rem] flex items-center justify-between group hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                          {task.logoUrl ? (
                            <img 
                              src={task.logoUrl} 
                              className="w-8 h-8 object-contain"
                              alt="Task"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                              {currentSettings.currencySymbol}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-2">
                            {task.title}
                            {task.isMustTask && (
                              <span className="text-[8px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full uppercase tracking-tighter border border-amber-500/20">Must</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">+{currentSettings.currencySymbol}{task.reward.toFixed(2)}</span>
                            {task.type === 'TELEGRAM_CHANNEL' && (
                              <span className="text-[8px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Telegram</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {taskTimers[task.id] !== undefined ? (
                          <button 
                            onClick={() => handleTaskVerify(task)}
                            disabled={verifyingTask === task.id || taskTimers[task.id] > 0}
                            className={cn(
                              "px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2",
                              taskTimers[task.id] > 0
                                ? "bg-slate-800 text-slate-500"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                            )}
                          >
                            {verifyingTask === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : taskTimers[task.id] > 0 ? (
                              <><Timer className="w-3 h-3" /> {taskTimers[task.id]}s</>
                            ) : (
                              <>Verify <Check className="w-3 h-3" /></>
                            )}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleTaskClick(task)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                          >
                            Go <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto border border-slate-800">
                      <ListTodo className="w-8 h-8 text-slate-700" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No tasks available</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'refer' && (
            <motion.div 
              key="refer"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Users className="w-32 h-32" />
                </div>
                
                <div className="relative z-10 space-y-6">
                  <div>
                    <p className="text-indigo-100/80 text-xs font-bold tracking-[0.2em] uppercase mb-2">
                      Referral Program
                    </p>
                    <h2 className="text-3xl font-black tracking-tighter">
                      Invite & Earn
                    </h2>
                    <p className="text-indigo-100/60 text-[10px] font-bold uppercase tracking-widest mt-1">
                      Get {currentSettings.currencySymbol}{currentSettings.referReward.toFixed(4)} per referral + {currentSettings.referralCommissionPercentage}% from their earnings
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold">{userData?.referralCount || 0}</span>
                      <span className="text-[10px] font-bold text-indigo-200/60 uppercase tracking-widest">Total Referrals</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-1">Your Referral Link</h3>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl flex items-center gap-3">
                    <input 
                      type="text" 
                      readOnly 
                      value={userData?.telegramId && userData.telegramId !== 'unknown' 
                        ? `https://t.me/${currentSettings.botUsername}?startapp=${userData.telegramId}`
                        : 'Loading referral link...'}
                      className="bg-transparent border-none text-xs font-medium text-slate-300 w-full focus:outline-none"
                    />
                  <button 
                    onClick={handleCopyReferLink}
                    className="p-2 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600/20 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={handleShareReferLink}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-[2rem] font-bold transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share with Friends
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-1">Recent Referrals</h3>
                <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden">
                  {referrals.length > 0 ? (
                    <div className="divide-y divide-slate-800">
                      {referrals.map((ref) => (
                        <div key={ref.telegramId} className="p-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                              {ref.photoUrl ? (
                                <img src={ref.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon className="w-5 h-5 text-slate-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{ref.firstName}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">@{ref.username}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">ID: {ref.telegramId}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center space-y-3">
                      <Users className="w-8 h-8 text-slate-700 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No referrals yet</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="relative inline-block">
                  {tgUser?.photo_url ? (
                    <img 
                      src={tgUser.photo_url} 
                      className="w-24 h-24 rounded-[2.5rem] border-4 border-blue-500/20 shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-[2.5rem] bg-blue-500/10 flex items-center justify-center border-4 border-blue-500/20">
                      <UserIcon className="w-10 h-10 text-blue-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl border-4 border-[#0f172a]">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{tgUser?.first_name || 'User'}</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">@{tgUser?.username || 'unknown'}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                      <Wallet className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Available for Withdraw</p>
                      <p className="text-xl font-bold">{currentSettings.currencySymbol}{userData?.earnings.toFixed(4) || '0.0000'}</p>
                    </div>
                  </div>
                </div>

                { (tgUser?.id.toString() === ADMIN_TG_ID || userData?.isAdmin) && (
                  <Link 
                    to="/admin" 
                    className="w-full py-5 bg-slate-800 hover:bg-slate-700 rounded-[2rem] font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
                  >
                    <ShieldAlert className="w-5 h-5 text-blue-400" /> Admin Panel
                  </Link>
                )}

                <button 
                  onClick={handleWithdraw}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-[2rem] font-bold transition-all shadow-xl shadow-blue-600/20"
                >
                  Withdraw Funds
                </button>
              </div>

              {/* Withdrawal History */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-1">Withdrawal History</h3>
                <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden">
                  {withdrawRequests.length > 0 ? (
                    <div className="divide-y divide-slate-800">
                      {withdrawRequests.map((req) => (
                        <div key={req.id} className="p-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center border",
                              req.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                              req.status === 'rejected' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                              "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            )}>
                              {req.status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                               req.status === 'rejected' ? <XCircle className="w-5 h-5" /> :
                               <Clock className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm uppercase">{req.method}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {new Date(req.createdAt).toLocaleDateString()} · {currentSettings.currencySymbol}{req.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              "text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                              req.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" :
                              req.status === 'rejected' ? "bg-red-500/10 text-red-400" :
                              "bg-amber-500/10 text-amber-400"
                            )}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center space-y-3">
                      <History className="w-8 h-8 text-slate-700 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No history yet</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-1">Statistics</h3>
                <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] divide-y divide-slate-800">
                  <div className="p-5 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Ads</span>
                    <span className="font-bold">{userData?.adsWatched || 0}</span>
                  </div>
                  <div className="p-5 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasks Done</span>
                    <span className="font-bold">{userData?.tasksCompleted?.length || 0}</span>
                  </div>
                  <div className="p-5 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Join Date</span>
                    <span className="font-bold text-xs">{userData?.joinedAt ? new Date(userData.joinedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {withdrawStep !== 'category' && (
                    <button 
                      onClick={() => {
                        if (withdrawStep === 'method') setWithdrawStep('category');
                        if (withdrawStep === 'details') setWithdrawStep('method');
                        if (withdrawStep === 'amount') setWithdrawStep('details');
                        if (withdrawStep === 'confirm') setWithdrawStep('amount');
                      }}
                      className="p-2 hover:bg-slate-800 rounded-xl transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h3 className="font-bold">Withdraw Funds</h3>
                </div>
                <button 
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {withdrawStep === 'category' && (
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => {
                        setWithdrawCategory('mobile');
                        setWithdrawStep('method');
                      }}
                      className="p-6 bg-slate-800/50 border border-slate-700 rounded-3xl flex items-center gap-4 hover:border-blue-500/50 transition-all text-left group"
                    >
                      <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold">Mobile Banking</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Bkash, Nagad, Rocket, Upay</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setWithdrawCategory('crypto');
                        setWithdrawStep('method');
                      }}
                      className="p-6 bg-slate-800/50 border border-slate-700 rounded-3xl flex items-center gap-4 hover:border-blue-500/50 transition-all text-left group"
                    >
                      <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <Bitcoin className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold">Cryptocurrency</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Binance ID</p>
                      </div>
                    </button>
                  </div>
                )}

                {withdrawStep === 'method' && (
                  <div className="grid grid-cols-2 gap-4">
                    {withdrawCategory === 'mobile' ? (
                      <>
                        {currentSettings.methods.bkash && (
                          <button onClick={() => { setSelectedMethod('bkash'); setWithdrawStep('details'); }} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-pink-500/50 transition-all font-bold text-sm">Bkash</button>
                        )}
                        {currentSettings.methods.nagad && (
                          <button onClick={() => { setSelectedMethod('nagad'); setWithdrawStep('details'); }} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-orange-500/50 transition-all font-bold text-sm">Nagad</button>
                        )}
                        {currentSettings.methods.rocket && (
                          <button onClick={() => { setSelectedMethod('rocket'); setWithdrawStep('details'); }} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-purple-500/50 transition-all font-bold text-sm">Rocket</button>
                        )}
                        {currentSettings.methods.upay && (
                          <button onClick={() => { setSelectedMethod('upay'); setWithdrawStep('details'); }} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-blue-500/50 transition-all font-bold text-sm">Upay</button>
                        )}
                      </>
                    ) : (
                      <>
                        {currentSettings.methods.binance && (
                          <button onClick={() => { setSelectedMethod('binance'); setWithdrawStep('details'); }} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-amber-500/50 transition-all font-bold text-sm col-span-2">Binance</button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {withdrawStep === 'details' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                      {selectedMethod === 'binance' ? 'Your Binance ID' : `Your ${selectedMethod} Number`}
                    </label>
                    <input
                      type="text"
                      value={withdrawDetails}
                      onChange={(e) => setWithdrawDetails(e.target.value)}
                      placeholder={selectedMethod === 'binance' ? 'Enter Binance ID' : 'Enter Phone Number'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <button
                      onClick={() => setWithdrawStep('amount')}
                      disabled={!withdrawDetails}
                      className="w-full py-4 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-2xl font-bold transition-all"
                    >
                      Next
                    </button>
                  </div>
                )}

                {withdrawStep === 'amount' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                      Withdrawal Amount (Min: {currentSettings.currencySymbol}{currentSettings.minWithdrawAmount})
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">{currentSettings.currencySymbol}</span>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pl-8 focus:outline-none focus:border-blue-500 transition-all font-bold"
                      />
                    </div>
                    <button
                      onClick={() => setWithdrawStep('confirm')}
                      className="w-full py-4 bg-blue-600 rounded-2xl font-bold transition-all"
                    >
                      Review Request
                    </button>
                  </div>
                )}

                {withdrawStep === 'confirm' && (
                  <div className="space-y-6">
                    <div className="bg-slate-950 rounded-3xl p-6 space-y-4 border border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Method</span>
                        <span className="font-bold uppercase">{selectedMethod}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account/ID</span>
                        <span className="font-bold">{withdrawDetails}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</span>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">{currentSettings.currencySymbol}{parseFloat(withdrawAmount).toFixed(4)}</p>
                          {selectedMethod === 'binance' && currentSettings.exchangeRate && (
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              ≈ ${(parseFloat(withdrawAmount) / currentSettings.exchangeRate).toFixed(2)} USDT
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={submitWithdraw}
                      disabled={isSubmittingWithdraw}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmittingWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Withdrawal'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-[2.5rem] p-2 flex items-center justify-around shadow-2xl z-40">
        <button 
          onClick={() => setActiveTab('home')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-3xl transition-all",
            activeTab === 'home' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-3xl transition-all",
            activeTab === 'tasks' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <ListTodo className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Tasks</span>
        </button>
        <button 
          onClick={() => setActiveTab('refer')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-3xl transition-all",
            activeTab === 'refer' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <Users className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Refer</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-3xl transition-all",
            activeTab === 'profile' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>

      {/* Support Circle */}
      <div className="fixed bottom-24 right-6 z-40">
        <button 
          onClick={() => setIsSupportOpen(true)}
          className="w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-purple-600/40 transition-all hover:scale-110 active:scale-95 border-4 border-[#0f172a]"
        >
          <Headset className="w-6 h-6" />
        </button>
      </div>

      {/* Support Modal */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold">Support Center</h3>
                <button onClick={() => setIsSupportOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {currentSettings.supportLinks && currentSettings.supportLinks.length > 0 ? (
                  currentSettings.supportLinks.map((link) => (
                    <a 
                      key={link.id}
                      href={link.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-purple-500/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all">
                          {link.platform === 'telegram' && <Send className="w-4 h-4" />}
                          {link.platform === 'facebook' && <Facebook className="w-4 h-4" />}
                          {link.platform === 'youtube' && <Youtube className="w-4 h-4" />}
                          {link.platform === 'instagram' && <Instagram className="w-4 h-4" />}
                          {link.platform === 'tiktok' && (
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.85.51-1.44 1.43-1.58 2.41-.14 1.01.23 2.08.94 2.79.69.69 1.74 1.02 2.71.83 1.02-.16 1.93-.83 2.36-1.77.13-.3.24-.62.26-.94.06-3.96.02-7.92.04-11.88-.03-.04-.04-.08-.05-.13z"/>
                            </svg>
                          )}
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-bold text-sm">{link.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{link.platform}</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-600" />
                    </a>
                  ))
                ) : (
                  <p className="text-center text-slate-500 text-xs font-bold uppercase py-4">No support links available</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Bell className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Notice</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                {currentSettings.popupNotice}
              </p>
              <button 
                onClick={() => setShowPopup(false)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}

        {showUniqueNotice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Zap className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Unique Ad Rules</h2>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                <p className="text-emerald-400 text-xs font-bold leading-relaxed whitespace-pre-wrap">
                  {currentSettings.uniqueAdNotice}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowUniqueNotice(false)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleWatchAd}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-600/20"
                >
                  Start Ad
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-6 right-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 backdrop-blur-xl z-50"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-200">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-xs font-bold text-red-400 uppercase"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
