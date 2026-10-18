'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Lock,
  User,
  Mail,
  Hash,
  Check,
  X,
  Loader2,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id?: string;
    name: string;
    student_id?: string | null;
    email: string;
    avatar_url?: string | null;
    role?: string;
  } | null;
  onProfileUpdated: (updated: { name: string; avatar_url: string | null }) => void;
  initialTab?: 'profile' | 'security';
}

export default function StudentProfileModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
  initialTab = 'profile'
}: StudentProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>(initialTab);

  // Profile info state
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatar_url || null);
      setError(null);
      setSuccess(null);
      setPwdError(null);
      setPwdSuccess(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab(initialTab);
    }
  }, [user, isOpen, initialTab]);

  if (!isOpen || !user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image size exceeds 15 MB limit.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const size = 256;
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(event.target?.result as string);
                return;
              }

              // Square center-crop
              const minDim = Math.min(img.width, img.height);
              const startX = (img.width - minDim) / 2;
              const startY = (img.height - minDim) / 2;

              ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
              const optimized = canvas.toDataURL('image/jpeg', 0.85);
              resolve(optimized);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      setAvatarUrl(dataUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo processing failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAdmin = user?.role === 'admin';
    const cleanName = isAdmin ? name.trim() : user.name;

    if (isAdmin && cleanName.length < 2) {
      setError('Full name must be at least 2 characters long.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isAdmin ? cleanName : undefined,
          avatar_url: avatarUrl
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onProfileUpdated({
        name: data.user.name,
        avatar_url: data.user.avatar_url || null
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!oldPassword) {
      setPwdError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setPwdError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 4) {
      setPwdError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === oldPassword) {
      setPwdError('New password must be different from your current password.');
      return;
    }

    setPwdSaving(true);

    try {
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPwdSuccess('Password changed successfully! Remember your new password for your next login.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwdSaving(false);
    }
  };

  const initials = name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'ST';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {user.role === 'admin' ? 'Account Settings' : 'Student Account & Security'}
            </h3>
            <p className="text-xs text-slate-500">
              Manage your profile details and change your password
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={15} />
            Profile Info
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setPwdError(null);
              setPwdSuccess(null);
            }}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'security'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound size={15} />
            Change Password
          </button>
        </div>

        {/* Tab 1: Profile Info */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <Check size={16} /> {success}
              </div>
            )}

            {/* Profile Picture Upload Section */}
            <div className="flex flex-col items-center justify-center space-y-3 pb-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg shadow-slate-200/80 bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-2xl relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}

                  {uploading && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white">
                      <Loader2 size={24} className="animate-spin" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-teal-600 text-white shadow-md hover:bg-teal-700 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Upload Photo"
                >
                  <Camera size={14} />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 px-3 py-1 rounded-lg hover:bg-teal-50 border border-teal-200 transition cursor-pointer"
                >
                  {uploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    disabled={uploading || saving}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer"
                    title="Remove picture"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">JPG, PNG, WebP up to 10 MB</p>
            </div>

            {/* Full Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User size={14} className="text-teal-600" />
                  Full Name
                </label>
                {user.role !== 'admin' && (
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </div>
              {user.role === 'admin' ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={60}
                  required
                  disabled={saving}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs font-medium"
                />
              ) : (
                <div>
                  <input
                    type="text"
                    value={user.name}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 cursor-not-allowed select-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Student name is officially registered and cannot be modified.
                  </p>
                </div>
              )}
            </div>

            {/* Non-Editable Locked Fields */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Hash size={13} className="text-slate-400" />
                    {user.role === 'admin' ? 'Account / User ID' : 'Student Roll / ID'}
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Lock size={10} /> Locked
                  </span>
                </div>
                <input
                  type="text"
                  value={user.student_id || 'Not assigned'}
                  disabled
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 cursor-not-allowed select-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Mail size={13} className="text-slate-400" />
                    Email Address
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Lock size={10} /> Locked
                  </span>
                </div>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Security & Password Change */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-start gap-2.5 text-xs text-teal-900">
              <ShieldCheck size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Protect Your Account</p>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Confirm your current password first to set a new password of your choice.
                </p>
              </div>
            </div>

            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <Check size={16} /> {pwdSuccess}
              </div>
            )}

            {/* Current / Old Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Current (Old) Password</span>
                <span className="text-[10px] text-slate-400 font-normal">Required for confirmation</span>
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  disabled={pwdSaving}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>New Password</span>
                <span className="text-[10px] text-slate-400 font-normal">Min. 4 characters</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create your new password"
                  required
                  disabled={pwdSaving}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-2xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Confirm New Password</span>
                {confirmPassword && newPassword === confirmPassword && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <Check size={12} /> Passwords match
                  </span>
                )}
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="text-[10px] text-rose-500 font-bold">
                    Passwords do not match
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  disabled={pwdSaving}
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border bg-white text-sm text-slate-900 focus:outline-none transition shadow-2xs font-mono ${
                    confirmPassword && newPassword !== confirmPassword
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={pwdSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pwdSaving || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {pwdSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
