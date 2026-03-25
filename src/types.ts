export type TaskType = 'DEFAULT' | 'TELEGRAM_CHANNEL';

export interface Task {
  id: string;
  title: string;
  reward: number;
  link: string;
  type: TaskType;
  channelId?: string;
  logoUrl?: string;
  isMustTask?: boolean;
}

export interface SupportLink {
  id: string;
  platform: 'telegram' | 'facebook' | 'tiktok' | 'youtube' | 'instagram';
  name: string;
  link: string;
}

export interface AppSettings {
  appName: string;
  appLogo: string;
  earningPerAd: number;
  userSharePercentage: number;
  monetagZoneId: string;
  monetagSdkId: string;
  botUsername: string;
  botToken: string;
  newUserChannel: string;
  withdrawChannel: string;
  newUserMsgTemplate: string;
  referReward: number;
  commonAdReward: number;
  uniqueAdReward: number;
  commonAdsTarget: number;
  popupNotice: string;
  homeNotice: string;
  uniqueAdNotice: string;
  currencySymbol: string;
  exchangeRate: number; // 1 USD/USDT = X BDT
  isWithdrawEnabled: boolean;
  minWithdrawAmount: number;
  appShortName: string;
  referralCommissionPercentage: number;
  methods: {
    bkash: boolean;
    nagad: boolean;
    rocket: boolean;
    upay: boolean;
    binance: boolean;
  };
  tasks: Task[];
  supportLinks: SupportLink[];
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  telegramId: string;
  amount: number;
  method: string;
  details: string; // Phone number or Binance ID
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface UserData {
  telegramId: string;
  username: string;
  firstName: string;
  photoUrl: string;
  earnings: number;
  adsWatched: number;
  lastAdWatchedAt: string;
  referralCount: number;
  referredBy: string | null;
  tasksCompleted: string[];
  currentAdCount: number;
  dailyAdCount: number;
  dailyEarnings: number;
  isBanned: boolean;
  isAdmin?: boolean;
  joinedAt: string;
  referralCounted?: boolean;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink: (url: string) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}
