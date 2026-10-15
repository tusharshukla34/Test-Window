'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  BookOpen,
  FileSpreadsheet,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Filter,
  ArrowRight,
  CalendarDays,
  List,
  CheckCircle2,
  Layers,
  ExternalLink
} from 'lucide-react';
import { ClayCard, ClayButton, Modal } from '@/components/ui/ClayComponents';
import { CalendarEvent, CalendarEventType, Batch } from '@/lib/db/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminCalendarPage() {
  const router = useRouter();

  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Data state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [batches, setBatches] = useState<(Batch & { student_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspect Modal
  const [inspectEvent, setInspectEvent] = useState<CalendarEvent | null>(null);

  const fetchCalendarData = () => {
    setLoading(true);
    setError(null);

    const url = selectedBatchId !== 'all'
      ? `/api/admin/calendar?batch_id=${selectedBatchId}`
      : '/api/admin/calendar';

    fetch(url)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return null;
        }
        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new Error(data?.error || `Failed to fetch calendar data (HTTP ${res.status})`);
        }
        return data;
      })
      .then((data) => {
        if (data) {
          setEvents(Array.isArray(data.events) ? data.events : []);
          setBatches(Array.isArray(data.batches) ? data.batches : []);
        }
      })
      .catch((err) => {
        console.error('Failed to load calendar events:', err);
        setError(err instanceof Error ? err.message : 'Unable to connect to server');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCalendarData();
  }, [selectedBatchId]);

  // Today string for highlighting
  const todayStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedType !== 'all' && ev.type !== selectedType) return false;
      return true;
    });
  }, [events, selectedType]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of filteredEvents) {
      if (!map[ev.date]) {
        map[ev.date] = [];
      }
      map[ev.date].push(ev);
    }
    return map;
  }, [filteredEvents]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(todayStr);
  };

  // Generate Calendar Days Grid
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      eventCount: number;
      events: CalendarEvent[];
    }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const d = String(dayNum).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        eventCount: (eventsByDate[dateStr] || []).length,
        events: eventsByDate[dateStr] || []
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const m = String(month + 1).padStart(2, '0');
      const dayFormatted = String(d).padStart(2, '0');
      const dateStr = `${year}-${m}-${dayFormatted}`;

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        eventCount: (eventsByDate[dateStr] || []).length,
        events: eventsByDate[dateStr] || []
      });
    }

    // Trailing days from next month
    const totalSlots = days.length > 35 ? 42 : 35;
    const remainingSlots = totalSlots - days.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextDate = new Date(year, month + 1, d);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dayFormatted = String(d).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayFormatted}`;

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        eventCount: (eventsByDate[dateStr] || []).length,
        events: eventsByDate[dateStr] || []
      });
    }

    return days;
  }, [currentDate, todayStr, selectedDateStr, eventsByDate]);

  // Selected Day's Events
  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  // Month Statistics
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthEvents = events.filter((ev) => {
      const d = new Date(ev.timestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const batchesCount = monthEvents.filter((e) => e.type === 'batch_created').length;
    const tasksCount = monthEvents.filter((e) => e.type === 'assignment_assigned').length;
    const examsCount = monthEvents.filter((e) => e.type === 'exam_scheduled').length;
    const deadlinesCount = monthEvents.filter((e) => e.type === 'assignment_deadline').length;

    return {
      total: monthEvents.length,
      batches: batchesCount,
      tasks: tasksCount,
      exams: examsCount,
      deadlines: deadlinesCount
    };
  }, [events, currentDate]);

  // Event category metadata & styling
  const getEventBadge = (type: CalendarEventType) => {
    switch (type) {
      case 'batch_created':
        return {
          label: 'Batch Created',
          icon: Users,
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          dot: 'bg-purple-500',
          cardBorder: 'border-l-purple-500'
        };
      case 'assignment_assigned':
        return {
          label: 'Homework Assigned',
          icon: BookOpen,
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          dot: 'bg-indigo-500',
          cardBorder: 'border-l-indigo-500'
        };
      case 'assignment_deadline':
        return {
          label: 'Task Due',
          icon: Clock,
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          cardBorder: 'border-l-rose-500'
        };
      case 'exam_scheduled':
        return {
          label: 'Exam Scheduled',
          icon: FileSpreadsheet,
          bg: 'bg-amber-100 text-amber-900 border-amber-200',
          dot: 'bg-amber-500',
          cardBorder: 'border-l-amber-500'
        };
      case 'exam_window':
        return {
          label: 'Exam Live',
          icon: Sparkles,
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          dot: 'bg-teal-500',
          cardBorder: 'border-l-teal-500'
        };
      default:
        return {
          label: 'Activity',
          icon: CalendarIcon,
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          dot: 'bg-slate-500',
          cardBorder: 'border-l-slate-400'
        };
    }
  };

  const formatHeaderDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 mt-3 font-semibold">Loading Activity Calendar...</p>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Failed to Load Calendar</h2>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md">{error}</p>
        <div className="mt-6 flex items-center gap-3">
          <ClayButton variant="primary" size="md" onClick={fetchCalendarData} className="shadow-md">
            <RefreshCw size={16} /> Retry Now
          </ClayButton>
          <ClayButton variant="outline" size="md" onClick={() => router.push('/admin/dashboard')}>
            Back to Dashboard
          </ClayButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <CalendarDays size={15} /> Trainer Activity Log & Schedule
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight break-words">
            Trainer Operations Calendar
          </h1>
          <p className="text-indigo-200 text-xs sm:text-sm mt-1 max-w-xl">
            Track daily administrative actions: batches created, daily homework assignments assigned, and online exams scheduled across all batches.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <ClayButton
            variant="teal"
            size="sm"
            onClick={() => router.push('/admin/assignments/create')}
            className="shadow-md font-semibold text-xs"
          >
            <Plus size={15} /> Assign Task
          </ClayButton>
          <ClayButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/exams')}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
          >
            <FileSpreadsheet size={15} /> Schedule Exam
          </ClayButton>
          <ClayButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/batches')}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold"
          >
            <Users size={15} /> Create Batch
          </ClayButton>
        </div>
      </div>

      {/* Month Metrics Overview Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <ClayCard className="p-4 bg-white/90">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {MONTH_NAMES[currentDate.getMonth()]} Actions
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <CalendarIcon size={15} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{monthStats.total}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Recorded operations</p>
        </ClayCard>

        <ClayCard className="p-4 bg-purple-50/60 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Batches Created</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Users size={15} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-purple-950">{monthStats.batches}</p>
          <p className="text-[11px] text-purple-600 mt-0.5">New cohort launches</p>
        </ClayCard>

        <ClayCard className="p-4 bg-blue-50/60 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Tasks Assigned</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BookOpen size={15} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-950">{monthStats.tasks}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">Homework assignments</p>
        </ClayCard>

        <ClayCard className="p-4 bg-amber-50/60 border border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Exams Scheduled</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <FileSpreadsheet size={15} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-950">{monthStats.exams}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Evaluation assessments</p>
        </ClayCard>
      </div>

      {/* Control Bar: Month Switcher & Filters */}
      <ClayCard className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month/Year Switcher & Today button */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition hover:shadow-xs"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-3 sm:px-4 text-sm sm:text-base font-extrabold text-slate-800 select-none min-w-[150px] text-center">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition hover:shadow-xs"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <ClayButton
              variant="outline"
              size="sm"
              onClick={handleJumpToday}
              className="font-bold text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              Today
            </ClayButton>

            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 ml-auto sm:ml-0">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays size={14} /> Month Grid
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'timeline'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={14} /> Activity Timeline
              </button>
            </div>
          </div>

          {/* Filtering dropdowns */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Filter by Batch */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter size={14} className="text-slate-400" />
              <label htmlFor="batch-filter" className="sr-only">Filter by Batch</label>
              <select
                id="batch-filter"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Type */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <label htmlFor="type-filter" className="sr-only">Filter by Activity Type</label>
              <select
                id="type-filter"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Action Types</option>
                <option value="batch_created">🏷️ Batches Created</option>
                <option value="assignment_assigned">📝 Tasks Assigned</option>
                <option value="exam_scheduled">📋 Exams Scheduled</option>
                <option value="assignment_deadline">⏰ Deadlines</option>
                <option value="exam_window">🎯 Exam Windows</option>
              </select>
            </div>
          </div>
        </div>
      </ClayCard>

      {/* Main Calendar Section */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left 2 Cols: Interactive Calendar Matrix */}
          <div className="xl:col-span-2">
            <ClayCard className="p-3 sm:p-5 overflow-hidden">
              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 mb-2 text-center">
                {DAY_NAMES.map((day, idx) => (
                  <div
                    key={day}
                    className={`py-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider ${
                      idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 35 or 42 Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarGrid.map((day) => {
                  const isSelected = day.dateStr === selectedDateStr;
                  const isToday = day.isToday;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDateStr(day.dateStr)}
                      className={`
                        min-h-[82px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none
                        ${isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 shadow-md ring-2 ring-indigo-400/30'
                          : isToday
                          ? 'border-indigo-300 bg-white shadow-xs'
                          : day.isCurrentMonth
                          ? 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-xs'
                          : 'border-slate-100 bg-slate-50/40 text-slate-400 opacity-60'}
                      `}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`
                            text-xs sm:text-sm font-extrabold inline-flex items-center justify-center w-6 h-6 rounded-full
                            ${isToday
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : isSelected
                              ? 'text-indigo-900 font-black'
                              : day.isCurrentMonth
                              ? 'text-slate-700'
                              : 'text-slate-400'}
                          `}
                        >
                          {day.dayNum}
                        </span>

                        {isToday && (
                          <span className="hidden sm:inline-block text-[9px] uppercase font-bold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded-md">
                            Today
                          </span>
                        )}

                        {day.eventCount > 0 && !isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 sm:hidden"></span>
                        )}
                      </div>

                      {/* Event Chips List (up to 2 visible on cell) */}
                      <div className="space-y-1 overflow-hidden flex-1 flex flex-col justify-end">
                        {day.events.slice(0, 2).map((ev) => {
                          const badge = getEventBadge(ev.type);
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectEvent(ev);
                              }}
                              className={`
                                text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate border flex items-center gap-1 transition-transform hover:scale-[1.02]
                                ${badge.bg}
                              `}
                              title={`${badge.label}: ${ev.title}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`}></span>
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}

                        {day.eventCount > 2 && (
                          <div className="text-[9px] font-bold text-slate-500 pl-1">
                            +{day.eventCount - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ClayCard>
          </div>

          {/* Right Col: Selected Day Inspector Detail Panel */}
          <div className="xl:col-span-1">
            <ClayCard className="p-4 sm:p-5 sticky top-20 border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 block">
                    {selectedDateStr === todayStr ? 'Today’s Agenda' : 'Day Inspector'}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight mt-0.5">
                    {formatHeaderDate(selectedDateStr)}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Action' : 'Actions'}
                  </span>
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="py-10 text-center px-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <CalendarIcon size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No actions logged on this date</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    No batches were created, homework assigned, or exams scheduled on {formatHeaderDate(selectedDateStr)}.
                  </p>

                  <div className="mt-5 space-y-2">
                    <button
                      onClick={() => router.push('/admin/assignments/create')}
                      className="w-full py-2 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} /> Assign Homework Today
                    </button>
                    <button
                      onClick={() => router.push('/admin/exams')}
                      className="w-full py-2 px-3 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <FileSpreadsheet size={14} /> Schedule an Exam
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {selectedDayEvents.map((ev) => {
                    const badge = getEventBadge(ev.type);
                    const Icon = badge.icon;

                    return (
                      <div
                        key={ev.id}
                        className={`p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:bg-white hover:shadow-xs transition-all ${badge.cardBorder}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${badge.bg}`}>
                            <Icon size={11} /> {badge.label}
                          </span>
                          {ev.time && (
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                              <Clock size={11} /> {ev.time}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug break-words">
                          {ev.title}
                        </h4>

                        {ev.subtitle && (
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">
                            {ev.subtitle}
                          </p>
                        )}

                        {/* Batch Names Tag Strip */}
                        {ev.batch_names && ev.batch_names.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-2">
                            {ev.batch_names.map((bName, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs"
                              >
                                {bName}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Quick View Button */}
                        {ev.link_url && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            <button
                              onClick={() => setInspectEvent(ev)}
                              className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1"
                            >
                              Quick Details
                            </button>
                            <button
                              onClick={() => router.push(ev.link_url!)}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition"
                            >
                              Open Portal <ArrowRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ClayCard>
          </div>
        </div>
      ) : (
        /* Timeline Mode */
        <ClayCard className="p-4 sm:p-6">
          <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <List size={18} className="text-indigo-600" /> Chronological Action Timeline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every cohort created, homework assigned, and exam scheduled in sequential order.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {filteredEvents.length} Total Events
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No events found matching the active filters.
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredEvents.map((ev) => {
                const badge = getEventBadge(ev.type);
                const Icon = badge.icon;

                return (
                  <div key={ev.id} className="relative group">
                    {/* Timeline Node Icon Bubble */}
                    <div className={`absolute -left-6 sm:-left-8 top-1 w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center text-white shadow-xs ${badge.dot}`}>
                      <Icon size={13} />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all group-hover:bg-white group-hover:shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {formatHeaderDate(ev.date)}
                          </span>
                        </div>
                        {ev.time && (
                          <span className="text-[11px] font-mono text-slate-500">
                            {ev.time}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900">{ev.title}</h4>
                      {ev.subtitle && (
                        <p className="text-xs text-slate-500 mt-1">{ev.subtitle}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200/60 flex-wrap gap-2">
                        {ev.batch_names && ev.batch_names.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Batches:</span>
                            {ev.batch_names.map((bName, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md"
                              >
                                {bName}
                              </span>
                            ))}
                          </div>
                        ) : <div></div>}

                        {ev.link_url && (
                          <button
                            onClick={() => router.push(ev.link_url!)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                          >
                            Open Details <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ClayCard>
      )}

      {/* Inspect Event Modal */}
      <Modal
        isOpen={Boolean(inspectEvent)}
        onClose={() => setInspectEvent(null)}
        title={inspectEvent ? getEventBadge(inspectEvent.type).label : 'Activity Details'}
        maxWidth="max-w-lg"
      >
        {inspectEvent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getEventBadge(inspectEvent.type).bg}`}>
                {getEventBadge(inspectEvent.type).label}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {inspectEvent.date} {inspectEvent.time ? `• ${inspectEvent.time}` : ''}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {inspectEvent.title}
              </h3>
              {inspectEvent.subtitle && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {inspectEvent.subtitle}
                </p>
              )}
            </div>

            {inspectEvent.batch_names && inspectEvent.batch_names.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                  Target Cohort Batches
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {inspectEvent.batch_names.map((b, idx) => (
                    <span key={idx} className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {inspectEvent.metadata && Object.keys(inspectEvent.metadata).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {inspectEvent.metadata.subject && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Subject</span>
                    <span className="font-bold text-slate-800">{inspectEvent.metadata.subject}</span>
                  </div>
                )}
                {inspectEvent.metadata.max_score !== undefined && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Maximum Marks</span>
                    <span className="font-mono font-bold text-slate-800">{inspectEvent.metadata.max_score} Marks</span>
                  </div>
                )}
                {inspectEvent.metadata.duration_minutes !== undefined && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Duration</span>
                    <span className="font-mono font-bold text-slate-800">{inspectEvent.metadata.duration_minutes} Mins</span>
                  </div>
                )}
                {inspectEvent.metadata.student_count !== undefined && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Student Count</span>
                    <span className="font-mono font-bold text-slate-800">{inspectEvent.metadata.student_count} Students</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <ClayButton variant="outline" size="sm" onClick={() => setInspectEvent(null)}>
                Close
              </ClayButton>
              {inspectEvent.link_url && (
                <ClayButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const url = inspectEvent.link_url!;
                    setInspectEvent(null);
                    router.push(url);
                  }}
                >
                  <ExternalLink size={14} /> Open in Portal
                </ClayButton>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
