'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck2,
  Award,
  Bell,
  LogOut,
  GraduationCap,
  Menu,
  X,
  Layers
} from 'lucide-react';
import StudentProfileModal from '@/components/student/StudentProfileModal';

interface StudentUser {
  id?: string;
  name: string;
  student_id: string | null;
  email: string;
  avatar_url?: string | null;
}

let cachedStudentUser: StudentUser | null = null;

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; is_read: boolean }[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);

  // If this is the exam attempt screen, render in distraction-free mode without standard navbar!
  const isExamAttempt = pathname.includes('/attempt');

  useEffect(() => {
    // Restore cached student profile on client side safely after hydration
    if (cachedStudentUser) {
      setUser(cachedStudentUser);
    } else {
      try {
        const saved = localStorage.getItem('student_portal_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          cachedStudentUser = parsed;
          setUser(parsed);
        }
      } catch {}
    }

    fetch(`/api/auth/me?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user);
          cachedStudentUser = data.user;
          try {
            localStorage.setItem('student_portal_user', JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch(() => {});

    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, []);

  // Close notifications dropdown when clicking outside anywhere in the window or pressing Escape
  useEffect(() => {
    if (!showNotifDropdown) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      const insideDesktop = notifRef.current && notifRef.current.contains(target);
      const insideMobile = mobileNotifRef.current && mobileNotifRef.current.contains(target);

      if (!insideDesktop && !insideMobile) {
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
    cachedStudentUser = null;
    try {
      localStorage.removeItem('student_portal_user');
    } catch {}
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const navItems = [
    { label: 'My Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Batches', href: '/student/batches', icon: Layers },
    { label: 'Daily Homework', href: '/student/assignments', icon: BookOpen },
    { label: 'Online Examinations', href: '/student/exams', icon: FileCheck2 },
    { label: 'My Results', href: '/student/results', icon: Award },
  ];

  if (isExamAttempt) {
    // The exam workspace provides its own full-screen, high-contrast, distraction-free environment
    return <div className="min-h-screen bg-[#f8fafc]">{children}</div>;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between shadow-xs sticky top-0 z-30">
        <button
          onClick={() => setProfileModalOpen(true)}
          className="flex items-center gap-2 overflow-hidden text-left hover:opacity-80 transition cursor-pointer"
          title="Click to edit name or upload photo"
        >
          {user ? (
            user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-lg object-cover border border-teal-200 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )
          ) : (
            <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse shrink-0"></div>
          )}
          <div className="truncate min-w-0">
            {user ? (
              <>
                <h1 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">{user.name}</h1>
                <span className="text-[10px] text-teal-600 font-mono font-semibold">{user.student_id || 'Student'}</span>
              </>
            ) : (
              <div className="space-y-1 py-0.5 animate-pulse">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-2 w-12 bg-slate-200 rounded"></div>
              </div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <div className="relative" ref={mobileNotifRef}>
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in">
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

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 rounded-lg hover:bg-slate-100 transition"
            aria-label="Toggle Navigation"
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
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-100">
              <GraduationCap size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">Student Portal</h2>
              <span className="text-xs text-teal-600 font-medium">Tushar Shukla Class</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/student/dashboard' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-teal-50 text-teal-800 shadow-xs border border-teal-100 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-teal-600' : 'text-slate-400'} />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={() => setProfileModalOpen(true)}
            className="w-full text-left bg-slate-50 hover:bg-slate-100/90 rounded-xl p-3 mb-3 border border-slate-100 transition group flex items-center gap-2.5 cursor-pointer"
            title="Click to edit name or upload photo"
          >
            {user ? (
              user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-teal-200 shrink-0 shadow-xs"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-teal-200 transition">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
              )
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
            )}
            <div className="min-w-0 flex-1">
              {user ? (
                <>
                  <p className="text-xs font-bold text-slate-800 truncate group-hover:text-teal-700 transition">{user.name}</p>
                  <p className="text-[11px] font-mono text-teal-600 font-semibold mt-0.5">{user.student_id || 'Student'}</p>
                </>
              ) : (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded"></div>
                  <div className="h-2.5 w-14 bg-slate-200 rounded"></div>
                </div>
              )}
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
              Student Classroom Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell with Outside-Click-to-Close */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Notifications"
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

            <button
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-slate-900 p-1 pr-2.5 rounded-xl hover:bg-slate-100 transition cursor-pointer group"
              title="Click to edit name or upload photo"
            >
              {user ? (
                user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover border border-teal-200 shadow-xs"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[11px] group-hover:bg-teal-200 transition shadow-xs">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                )
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse"></div>
              )}
              {user ? (
                <span className="hidden sm:inline font-bold group-hover:text-teal-700 transition">{user.name}</span>
              ) : (
                <div className="hidden sm:block h-3.5 w-16 bg-slate-200 rounded animate-pulse"></div>
              )}
            </button>
          </div>
        </header>

        <main className="p-3 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Student Profile & Photo Modal */}
      <StudentProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onProfileUpdated={(updated) => {
          setUser(prev => {
            const next = prev ? { ...prev, name: updated.name, avatar_url: updated.avatar_url } : null;
            cachedStudentUser = next;
            try {
              if (next) localStorage.setItem('student_portal_user', JSON.stringify(next));
            } catch {}
            return next;
          });
        }}
      />
    </div>
  );
}
