'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  TableProperties,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
  ClipboardCheck,
  Calendar,
  Bell,
  LogOut,
  Menu,
  X,
  Sparkles
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; is_read: boolean }[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Calendar', href: '/admin/calendar', icon: Calendar },
    { label: 'Batches', href: '/admin/batches', icon: Users },
    { label: 'Students', href: '/admin/students', icon: GraduationCap },
    { label: 'Assignments', href: '/admin/assignments', icon: BookOpen },
    { label: 'Monitoring Matrix', href: '/admin/matrix', icon: TableProperties },
    { label: 'Submissions Queue', href: '/admin/submissions', icon: CheckCircle2 },
    { label: 'Question Bank', href: '/admin/question-bank', icon: HelpCircle },
    { label: 'Online Exams', href: '/admin/exams', icon: FileSpreadsheet },
    { label: 'Exam Evaluations', href: '/admin/exam-evaluations', icon: ClipboardCheck },
  ];

  const [adminUser, setAdminUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data || !data.authenticated || data.user?.role !== 'admin') {
          router.push('/login');
        } else {
          setAdminUser(data.user);
        }
      })
      .catch(() => {
        router.push('/login');
      });

    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!showNotifDropdown) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowNotifDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifDropdown]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between shadow-xs sticky top-0 z-30">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            TS
          </div>
          <div className="truncate min-w-0">
            <h1 className="font-bold text-slate-800 text-xs sm:text-sm leading-tight truncate">Tushar Shukla</h1>
            <span className="text-[10px] text-indigo-600 font-semibold tracking-wide uppercase">Trainer Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg relative"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 rounded-lg hover:bg-slate-100 transition"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar Desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/80 p-5 flex flex-col justify-between
        transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:w-64
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-indigo-200">
              TS
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">Tushar Shukla</h2>
              <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                <Sparkles size={11} /> Admin & Trainer
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-100/80 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100 flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-800 truncate">{adminUser?.name || 'Tushar Shukla'}</p>
              <p className="text-[11px] text-slate-500 truncate">{adminUser?.email || 'Instructor & Administrator'}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active"></span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Live Classroom Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h4 className="text-xs font-bold text-slate-800">Notifications</h4>
                    <span className="text-[10px] text-slate-500">{unreadCount} unread</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No notifications</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <p className="font-semibold text-slate-800">{n.title}</p>
                          <p className="text-slate-500 mt-0.5 text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-[1px] bg-slate-200"></div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                TS
              </span>
              <span className="hidden sm:inline">Trainer Shukla</span>
            </div>
          </div>
        </header>

        {/* Page Children */}
        <main className="p-3 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
