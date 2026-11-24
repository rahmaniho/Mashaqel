import {
  Briefcase,
  Building2,
  ClipboardCheck,
  FileBarChart,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Network,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * دقیقاً همان منو و گروه‌بندی سامانه مشاغل (web/index.html) تا نمای دمو با برنامه هماهنگ باشد.
 * badge = شمارش واقعی همان بخش در کارگاه نمونه.
 */
export const APP_MENU = [
  {
    title: 'عملیات اصلی',
    items: [
      { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, filledWhenActive: true },
      { id: 'workshops', label: 'مدیریت کارگاه‌ها', icon: Building2 },
      { id: 'org', label: 'ساختار سازمانی', icon: Network },
      { id: 'jobs', label: 'بانک مشاغل', icon: Briefcase, badge: 3 },
    ],
  },
  {
    title: 'ارزیابی و طبقه‌بندی',
    items: [
      { id: 'evaluation', label: 'ارزیابی مشاغل', icon: ClipboardCheck, badge: 2 },
      { id: 'group', label: 'تعیین گروه شغلی', icon: Layers },
    ],
  },
  {
    title: 'کارکنان و مزد',
    items: [
      { id: 'employees', label: 'مدیریت کارکنان', icon: Users },
      { id: 'payroll', label: 'محاسبات حقوق و دستمزد', icon: Wallet },
      { id: 'arrears', label: 'محاسبه معوقات', icon: ReceiptText },
    ],
  },
  {
    title: 'سامانه',
    items: [
      { id: 'reports', label: 'گزارش‌ها', icon: FileBarChart },
      { id: 'guide', label: 'آموزش سامانه', icon: GraduationCap },
      { id: 'settings', label: 'تنظیمات', icon: Settings },
      { id: 'users', label: 'مدیریت کاربران', icon: ShieldCheck },
    ],
  },
];
