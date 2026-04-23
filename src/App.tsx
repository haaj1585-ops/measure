/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  History, 
  Users, 
  Plus, 
  TrendingUp, 
  Activity,
  TrendingDown,
  Calendar,
  Ruler,
  X
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError } from './lib/firebase';
import { cn, formatDate } from './lib/utils';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- Types ---
interface Measurement {
  id: string;
  userId: string;
  date: string;
  bodyPart: string;
  value: number;
  unit: string;
  notes?: string;
}

const BODY_PARTS = [
  "Weight", "Body Fat %", "Neck", "Shoulders", "Chest", 
  "Left Bicep", "Right Bicep", "Left Forearm", "Right Forearm", 
  "Waist", "Hips", 
  "Left Thigh", "Right Thigh", "Left Calf", "Right Calf"
];

// --- Simple Local Identity ---
function getLocalUserId() {
  let id = localStorage.getItem('physique_pro_userId');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('physique_pro_userId', id);
  }
  return id;
}

// --- Components ---

function Sidebar({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) {
  const navItems = [
    { id: 'dashboard', icon: Activity, label: 'Performance' },
    { id: 'session', icon: Plus, label: 'Entry Tool' },
    { id: 'sheet', icon: Ruler, label: 'Analytics Grid' },
  ];

  return (
    <div className="w-20 md:w-64 border-r border-slate-200 h-screen bg-white flex flex-col p-6">
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Dumbbell className="w-6 h-6 text-white" />
        </div>
        <span className="hidden md:block text-xl font-bold tracking-tight text-slate-900">Physique Hub</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group relative",
              activeTab === item.id 
                ? "bg-blue-50 text-blue-600" 
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", activeTab === item.id ? "text-blue-600" : "text-slate-400")} />
            <span className="hidden md:block text-sm font-semibold tracking-wide">{item.label}</span>
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

interface PerformanceCardProps {
  key?: string | number;
  part: string;
  measurements: Measurement[];
  onRemove: () => void;
  onSwitch: (newPart: string) => void;
}

const PerformanceCard = ({ 
  part, 
  measurements, 
  onRemove, 
  onSwitch 
}: PerformanceCardProps) => {
  const partData = useMemo(() => {
    return measurements
      .filter(m => m.bodyPart === part)
      .slice()
      .reverse();
  }, [measurements, part]);

  const latest = partData[partData.length - 1];
  const previous = partData[partData.length - 2];
  
  const diff = useMemo(() => {
    if (!latest || !previous) return null;
    const valueDiff = latest.value - previous.value;
    return { val: valueDiff.toFixed(1) };
  }, [latest, previous]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <select 
            value={part}
            onChange={(e) => onSwitch(e.target.value)}
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-transparent focus:outline-none cursor-pointer hover:text-blue-600 transition-colors w-full"
          >
            {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-slate-900 leading-none">{latest?.value || '--'}</span>
            <span className="text-[10px] font-bold text-slate-300 uppercase leading-none">{latest?.unit}</span>
            {diff && (
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-full ml-1",
                parseFloat(diff.val) >= 0 ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
              )}>
                {parseFloat(diff.val) > 0 ? '+' : ''}{diff.val}
              </span>
            )}
          </div>
        </div>
        <button onClick={onRemove} className="p-1 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-rose-500 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-[120px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={partData}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />
            <Tooltip 
              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '10px' }}
              labelFormatter={(val) => formatDate(val)}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ fill: '#2563eb', stroke: '#fff', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Dashboard({ measurements }: { measurements: Measurement[] }) {
  const [visibleParts, setVisibleParts] = useState<string[]>(['Weight', 'Chest', 'Waist', 'Hips', 'Left Bicep', 'Right Bicep']);

  const addPart = () => {
    const remaining = BODY_PARTS.filter(p => !visibleParts.includes(p));
    if (remaining.length > 0) {
      setVisibleParts([...visibleParts, remaining[0]]);
    }
  };

  const removePart = (part: string) => {
    setVisibleParts(visibleParts.filter(p => p !== part));
  };

  const switchPart = (oldPart: string, newPart: string) => {
    setVisibleParts(visibleParts.map(p => p === oldPart ? newPart : p));
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-blue-600 decoration-4 underline-offset-8 uppercase italic">Anatomical Performance</h2>
          <p className="text-slate-500 text-xs mt-4 font-bold uppercase tracking-[0.3em]">Visualizing transformation metrics</p>
        </div>
        <button 
          onClick={addPart}
          disabled={visibleParts.length >= BODY_PARTS.length}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:active:scale-100"
        >
          <Plus className="w-5 h-5" /> Add Metric Card
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {visibleParts.map(part => (
          <PerformanceCard 
            key={part} 
            part={part} 
            measurements={measurements} 
            onRemove={() => removePart(part)}
            onSwitch={(newPart) => switchPart(part, newPart)}
          />
        ))}
      </div>

      {visibleParts.length === 0 && (
        <div className="flex flex-col items-center justify-center p-24 bg-white border-4 border-dashed border-slate-100 rounded-[3rem] text-center space-y-6">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
            <Activity className="w-10 h-10 text-slate-200" />
          </div>
          <div>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm italic">Clean Slate</p>
            <p className="text-slate-300 text-xs mt-2 uppercase font-medium tracking-widest">Add a muscle group or target to begin visualization</p>
          </div>
          <button 
            onClick={addPart} 
            className="px-8 py-3 bg-blue-50 text-blue-600 font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
          >
            Start Analysis
          </button>
        </div>
      )}
    </div>
  );
}

function ComparisonSheet({ measurements }: { measurements: Measurement[] }) {
  const dates = useMemo(() => {
    // Sort dates properly to show most recent sessions first
    return Array.from(new Set(measurements.map(m => m.date.split('T')[0])))
      .sort((a, b) => b.localeCompare(a));
  }, [measurements]);

  const valueMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    measurements.forEach(m => {
      const d = m.date.split('T')[0];
      if (!map[d]) map[d] = {};
      map[d][m.bodyPart] = m.value;
    });
    return map;
  }, [measurements]);

  const deleteSession = async (date: string) => {
    if (!confirm(`Permanently delete all data for ${date}?`)) return;
    const sessionDocs = measurements.filter(m => m.date.split('T')[0] === date);
    for (const d of sessionDocs) {
      await deleteDoc(doc(db, 'measurements', d.id));
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-blue-500 decoration-4 underline-offset-8">Analytics Grid</h2>
        <p className="text-slate-500 text-sm mt-3 font-medium">Full historical overview in chronological columns</p>
      </header>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 p-6 text-left border-r border-slate-200 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Data Point</th>
              {dates.map(date => (
                <th key={date} className="p-6 border-r border-slate-200 min-w-[140px]">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{formatDate(date)}</span>
                    <button 
                      onClick={() => deleteSession(date)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors px-2 py-1 bg-rose-50 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {BODY_PARTS.map(part => (
              <tr key={part} className="group hover:bg-slate-50 transition-all">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-6 border-r border-slate-200 transition-all">
                  <span className="text-sm font-bold text-slate-700 tracking-tight">{part}</span>
                </td>
                {dates.map(date => {
                  const val = valueMap[date]?.[part];
                  const dateIdx = dates.indexOf(date);
                  const prevDate = dates[dateIdx + 1];
                  const prevVal = prevDate ? valueMap[prevDate]?.[part] : null;
                  const delta = (val && prevVal) ? (val - prevVal).toFixed(1) : null;

                  return (
                    <td key={date} className="p-6 border-r border-slate-200 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold text-slate-900">{val || '--'}</span>
                        {delta && delta !== "0.0" && (
                          <span className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full",
                            parseFloat(delta) > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                          )}>
                            {parseFloat(delta) > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchMeasurementTool({ onComplete }: { onComplete: () => void }) {
  const userId = useMemo(() => getLocalUserId(), []);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeEntries = (Object.entries(values) as [string, string][]).filter(([_, val]) => val.trim() !== "");
    if (activeEntries.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const timestamp = Timestamp.fromDate(new Date(date));
      const batchPromises = activeEntries.map(([part, val]) => {
        let unit = 'cm';
        if (part === 'Weight') unit = 'kg';
        if (part === 'Body Fat %') unit = '%';

        return addDoc(collection(db, 'measurements'), {
          bodyPart: part,
          value: parseFloat(val),
          unit,
          date: timestamp,
          userId,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(batchPromises);
      onComplete();
    } catch (error) {
       handleFirestoreError(error, 'write', 'measurements');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-blue-500 decoration-4 underline-offset-8">Data Entry Tool</h2>
          <p className="text-slate-500 text-sm mt-3 font-medium">Input your current or previous measurements below</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-inner">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entry Date:</label>
          <input 
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-slate-900 focus:outline-none font-bold text-sm tracking-tight"
          />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {BODY_PARTS.map(part => (
            <div key={part} className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm hover:border-blue-300 transition-all group">
              <div className="flex flex-col gap-2 mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{part}</span>
                <span className="text-[9px] font-bold text-blue-500 opacity-0 group-focus-within:opacity-100 transition-opacity uppercase tracking-tighter">Enter Magnitude</span>
              </div>
              <input 
                type="number"
                step="0.01"
                placeholder="00.00"
                value={values[part] || ''}
                onChange={(e) => setValues({ ...values, [part]: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-900 text-3xl font-bold focus:outline-none focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-200"
              />
            </div>
          ))}
        </div>

        <div className="pt-8 flex justify-end">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "px-12 py-5 font-black uppercase tracking-widest text-sm rounded-full shadow-xl transition-all flex items-center gap-4",
              isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 shadow-lg"
            )}
          >
            {isSubmitting ? 'Processing...' : (
              <>
                <Plus className="w-5 h-5" />
                Commit Batch Entry
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

const LogOut = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function MainApp() {
  const userId = useMemo(() => getLocalUserId(), []);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'measurements'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data();
        return {
          id: doc.id,
          ...item,
          date: item.date instanceof Timestamp ? item.date.toDate().toISOString() : item.date
        } as Measurement;
      });
      setMeasurements(data);
    }, (error) => {
      console.error("Error fetching measurements:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 md:p-16 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <Dashboard measurements={measurements} />}
              {activeTab === 'session' && <BatchMeasurementTool onComplete={() => setActiveTab('sheet')} />}
              {activeTab === 'sheet' && <ComparisonSheet measurements={measurements} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <MainApp />;
}
