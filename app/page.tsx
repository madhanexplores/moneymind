"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Wallet, 
  Briefcase, 
  Timer, 
  StickyNote, 
  Target, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  ChevronRight, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  LogOut,
  User,
  Play,
  Pause,
  RotateCcw,
  Save,
  Trash2,
  Filter,
  LogIn,
  Dumbbell,
  Heart,
  Users,
  FileText,
  Calendar as CalendarIcon,
  Palette,
  Menu,
  X,
  ChevronLeft,
  Sun,
  Moon,
  Download,
  Mail,
  Phone,
  Zap,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { auth, db } from "@/lib/firebase";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  Timestamp,
  orderBy
} from "firebase/firestore";

// --- Types ---
type Tab = "overview" | "finances" | "projects" | "notes" | "goals" | "gym" | "clients";
type TimeRange = "weekly" | "monthly" | "yearly";
type ThemeColor = "blue" | "emerald" | "rose" | "amber" | "violet";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast here
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-white/10 text-white shadow-lg shadow-black/20" 
        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
    <span className="font-medium text-sm">{label}</span>
    {active && (
      <motion.div 
        layoutId="sidebar-active"
        className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"
      />
    )}
  </button>
);

const StatCard = ({ title, value, change, trend, icon: Icon, color = "blue" }: { title: string, value: string, change: string, trend: "up" | "down", icon: any, color?: string }) => {
  const getColors = () => {
    const colors: any = {
      blue: "bg-blue-500/10 text-blue-500",
      emerald: "bg-emerald-500/10 text-emerald-500",
      rose: "bg-rose-500/10 text-rose-500",
      amber: "bg-amber-500/10 text-amber-500",
      violet: "bg-violet-500/10 text-violet-500",
    };
    return colors[color] || colors.blue;
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-[#111111] border border-white/5 rounded-3xl p-4 sm:p-6 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2.5 rounded-xl", getColors())}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-bold font-mono">{value}</h3>
        <span className={cn(
          "text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1",
          trend === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
          {change}
        </span>
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Data State
  const [projects, setProjects] = React.useState<any[]>([]);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [goals, setGoals] = React.useState<any[]>([]);
  const [notes, setNotes] = React.useState<any[]>([]);
  const [workouts, setWorkouts] = React.useState<any[]>([]);
  const [clients, setClients] = React.useState<any[]>([]);
  const [checklists, setChecklists] = React.useState<any[]>([]);
  const [timeRange, setTimeRange] = React.useState<TimeRange>("monthly");
  const [accentColor, setAccentColor] = React.useState<ThemeColor>("blue");
  const [financeDateStart, setFinanceDateStart] = React.useState<string>("");
  const [financeDateEnd, setFinanceDateEnd] = React.useState<string>("");

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return true;
      const tDate = new Date(t.date).getTime();
      const start = financeDateStart ? new Date(financeDateStart).getTime() : -Infinity;
      const end = financeDateEnd ? new Date(financeDateEnd).getTime() : Infinity;
      // Set end date to end of day
      const adjustedEnd = financeDateEnd ? new Date(financeDateEnd).setHours(23, 59, 59, 999) : Infinity;
      return tDate >= start && tDate <= adjustedEnd;
    });
  }, [transactions, financeDateStart, financeDateEnd]);

  // Auth Listener
  React.useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });

    // Safety timeout: stop loading after 5 seconds even if auth state is unknown
    const timer = setTimeout(() => {
      setIsAuthReady(true);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Data Listeners
  React.useEffect(() => {
    if (!user) {
      setProjects([]);
      setTransactions([]);
      setGoals([]);
      setNotes([]);
      return;
    }

    const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "projects"));

    const qTransactions = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("date", "desc"));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "transactions"));

    const qGoals = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "goals"));

    const qNotes = query(collection(db, "notes"), where("userId", "==", user.uid), orderBy("date", "desc"));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "notes"));

    const qWorkouts = query(collection(db, "workouts"), where("userId", "==", user.uid), orderBy("date", "desc"));
    const unsubWorkouts = onSnapshot(qWorkouts, (snapshot) => {
      setWorkouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "workouts"));

    const qClients = query(collection(db, "clients"), where("userId", "==", user.uid), orderBy("name", "asc"));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "clients"));

    const qChecklists = query(collection(db, "checklists"), where("userId", "==", user.uid));
    const unsubChecklists = onSnapshot(qChecklists, (snapshot) => {
      setChecklists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "checklists"));

    return () => {
      unsubProjects();
      unsubTransactions();
      unsubGoals();
      unsubNotes();
      unsubWorkouts();
      unsubClients();
      unsubChecklists();
    };
  }, [user]);

  const [authError, setAuthError] = React.useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    // Force account selection to help with some auth issues
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      if (error.code === 'auth/network-request-failed') {
        setAuthError("Network error: Please check your internet connection or disable ad-blockers that might be blocking Firebase.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in popup was closed before completion.");
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else {
        setAuthError(error.message || "An unexpected error occurred during sign-in.");
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Financial Aggregation Logic
  const getFinancialData = () => {
    const now = new Date();
    const data: any[] = [];
    
    if (timeRange === "weekly") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayTransactions = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.toDateString() === d.toDateString();
        });
        const income = dayTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
        const expenses = dayTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
        data.push({ name: dayStr, income, expenses });
      }
    } else if (timeRange === "monthly") {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
        const monthTransactions = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
        });
        const income = monthTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
        const expenses = monthTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
        data.push({ name: monthStr, income, expenses });
      }
    } else {
      // Yearly (Last 5 years)
      for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setFullYear(now.getFullYear() - i);
        const yearStr = d.getFullYear().toString();
        const yearTransactions = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === d.getFullYear();
        });
        const income = yearTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
        const expenses = yearTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
        data.push({ name: yearStr, income, expenses });
      }
    }
    
    return data.length > 0 ? data : [
      { name: "N/A", income: 0, expenses: 0 }
    ];
  };

  const setPeriod = (period: 'week' | 'month' | 'year' | 'all') => {
    const now = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 1);
    } else {
      setFinanceDateStart("");
      setFinanceDateEnd("");
      return;
    }
    setFinanceDateStart(start.toISOString().split('T')[0]);
    setFinanceDateEnd(now.toISOString().split('T')[0]);
  };
  const calculateStreak = (items: any[], dateField: string = "date") => {
    if (!items || items.length === 0) return 0;
    
    // Sort unique dates in descending order
    const dates = Array.from(new Set(items.map(item => {
      const val = item[dateField];
      if (!val) return "";
      // Handle Firebase Timestamp or string date
      if (val && typeof val === 'object' && 'seconds' in val) {
        return new Date(val.seconds * 1000).toDateString();
      }
      return new Date(val).toDateString();
    }))).filter(d => d !== "").map(d => new Date(d));
    
    dates.sort((a, b) => b.getTime() - a.getTime());
    
    if (dates.length === 0) return 0;
    
    const now = new Date();
    const today = new Date(now.toDateString());
    const yesterday = new Date(now.toDateString());
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the most recent date is today or yesterday
    const latestDate = dates[0];
    if (latestDate < yesterday) return 0;
    
    let streak = 0;
    let currentDate = latestDate;
    
    for (let i = 0; i < dates.length; i++) {
      const dateToCheck = dates[i];
      
      // Calculate day difference
      const diffTime = currentDate.getTime() - dateToCheck.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (i === 0) {
        streak = 1;
      } else if (diffDays === 1) {
        streak++;
        currentDate = dateToCheck;
      } else if (diffDays > 1) {
        break;
      }
    }
    
    return streak;
  };

  const gymStreak = calculateStreak(workouts, "date");
  const noteStreak = calculateStreak(notes, "createdAt");

  const totalRevenue = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const activeProjectsCount = projects.filter(p => p.status === "In Progress").length;
  const completionRate = projects.length > 0 
    ? Math.round((projects.filter(p => p.status === "Completed").length / projects.length) * 100) 
    : 0;

  const [isProjectModalOpen, setIsProjectModalOpen] = React.useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = React.useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = React.useState(false);
  const [isGoalUpdateModalOpen, setIsGoalUpdateModalOpen] = React.useState(false);
  const [selectedGoal, setSelectedGoal] = React.useState<any>(null);
  const [manualGoalAmt, setManualGoalAmt] = React.useState<number>(0);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = React.useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = React.useState(false);

  // Form States
  const [newProject, setNewProject] = React.useState({ name: "", client: "", status: "Pending", progress: 0, deadline: "" });
  const [newTransaction, setNewTransaction] = React.useState({ amount: 0, type: "income", category: "", description: "", date: new Date().toISOString().split('T')[0] });
  const [newGoal, setNewGoal] = React.useState({ title: "", target: 0, current: 0, deadline: "" });
  const [newWorkout, setNewWorkout] = React.useState({ exercise: "", sets: 0, reps: 0, weight: 0, date: new Date().toISOString().split('T')[0] });
  const [newClient, setNewClient] = React.useState({ name: "", email: "", company: "", phone: "", notes: "" });
  const [newChecklist, setNewChecklist] = React.useState("");

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "projects"), {
        ...newProject,
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsProjectModalOpen(false);
      setNewProject({ name: "", client: "", status: "Pending", progress: 0, deadline: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "projects");
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "transactions"), {
        ...newTransaction,
        amount: Number(newTransaction.amount),
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsTransactionModalOpen(false);
      setNewTransaction({ amount: 0, type: "income", category: "", description: "", date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "transactions");
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "goals"), {
        ...newGoal,
        target: Number(newGoal.target),
        current: Number(newGoal.current),
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsGoalModalOpen(false);
      setNewGoal({ title: "", target: 0, current: 0, deadline: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "goals");
    }
  };

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "workouts"), {
        ...newWorkout,
        sets: Number(newWorkout.sets),
        reps: Number(newWorkout.reps),
        weight: Number(newWorkout.weight),
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsWorkoutModalOpen(false);
      setNewWorkout({ exercise: "", sets: 0, reps: 0, weight: 0, date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "workouts");
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "clients"), {
        ...newClient,
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setIsClientModalOpen(false);
      setNewClient({ name: "", email: "", company: "", phone: "", notes: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "clients");
    }
  };

  const handleUpdateChecklist = async (id: string, completed: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "checklists", id), { completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "checklists");
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChecklist.trim()) return;
    try {
      await addDoc(collection(db, "checklists"), {
        text: newChecklist,
        completed: false,
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setNewChecklist("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "checklists");
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "checklists", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "checklists");
    }
  };

  const handleManualGoalUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedGoal) return;
    try {
      await updateDoc(doc(db, "goals", selectedGoal.id), {
        current: Number(manualGoalAmt)
      });
      setIsGoalUpdateModalOpen(false);
      setSelectedGoal(null);
      setManualGoalAmt(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "goals");
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "workouts", workoutId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "workouts");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "projects", projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "projects");
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "transactions", transactionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "transactions");
    }
  };

  const handleUpdateGoal = async (goalId: string, current: number, target: number) => {
    if (!user) return;
    try {
      const newProgress = Math.min(target, current + (target * 0.1)); // Increment by 10% for demo
      await updateDoc(doc(db, "goals", goalId), {
        current: newProgress
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "goals");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "goals", goalId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "goals");
    }
  };

  const getAccentClass = (type: 'bg' | 'text' | 'border' | 'shadow' | 'ring') => {
    const colors = {
      blue: { bg: "bg-blue-600", text: "text-blue-500", border: "border-blue-500", shadow: "shadow-blue-900/20", ring: "ring-blue-500" },
      emerald: { bg: "bg-emerald-600", text: "text-emerald-500", border: "border-emerald-500", shadow: "shadow-emerald-900/20", ring: "ring-emerald-500" },
      rose: { bg: "bg-rose-600", text: "text-rose-500", border: "border-rose-500", shadow: "shadow-rose-900/20", ring: "ring-rose-500" },
      amber: { bg: "bg-amber-600", text: "text-amber-500", border: "border-amber-500", shadow: "shadow-amber-900/20", ring: "ring-amber-500" },
      violet: { bg: "bg-violet-600", text: "text-violet-500", border: "border-violet-500", shadow: "shadow-violet-900/20", ring: "ring-violet-500" },
    };
    return colors[accentColor][type];
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Modals */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">New Project</h3>
              <form onSubmit={handleAddProject} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Project Name</label>
                  <input 
                    required
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="e.g. Website Redesign"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Client</label>
                  <input 
                    required
                    value={newProject.client}
                    onChange={(e) => setNewProject({...newProject, client: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="Client Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                    <select 
                      value={newProject.status}
                      onChange={(e) => setNewProject({...newProject, status: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="Pending" className="bg-[#1a1a1a]">Pending</option>
                      <option value="In Progress" className="bg-[#1a1a1a]">In Progress</option>
                      <option value="Completed" className="bg-[#1a1a1a]">Completed</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Deadline</label>
                    <input 
                      required
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({...newProject, deadline: e.target.value})}
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setIsProjectModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-colors">Create Project</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isTransactionModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Add Transaction</h3>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Amount ($)</label>
                    <input 
                      required
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                      type="number" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Type</label>
                    <select 
                      value={newTransaction.type}
                      onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="income" className="bg-[#1a1a1a]">Income</option>
                      <option value="expense" className="bg-[#1a1a1a]">Expense</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Category</label>
                  <input 
                    required
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="e.g. Design, Software, Tax"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date</label>
                  <input 
                    required
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                    type="date" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-colors">Add Record</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isGoalModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Set New Goal</h3>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Goal Title</label>
                  <input 
                    required
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="e.g. Save for New Laptop"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Target Amount</label>
                    <input 
                      required
                      value={newGoal.target}
                      onChange={(e) => setNewGoal({...newGoal, target: Number(e.target.value)})}
                      type="number" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Deadline</label>
                    <input 
                      required
                      value={newGoal.deadline}
                      onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-colors">Set Goal</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isGoalUpdateModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-2">Update Goal Progress</h3>
              <p className="text-gray-400 text-sm mb-6">{selectedGoal?.title}</p>
              <form onSubmit={handleManualGoalUpdate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current Amount ($)</label>
                  <input 
                    required
                    autoFocus
                    value={manualGoalAmt}
                    onChange={(e) => setManualGoalAmt(Number(e.target.value))}
                    type="number" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                    <span>Target: ${selectedGoal?.target.toLocaleString()}</span>
                    <span>Remaining: ${Math.max(0, selectedGoal?.target - manualGoalAmt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => { setIsGoalUpdateModalOpen(false); setSelectedGoal(null); }} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className={cn("flex-1 px-6 py-3 rounded-xl font-bold transition-colors", getAccentClass('bg'))}>Update</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isClientModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Add Client</h3>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Full Name</label>
                  <input 
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email</label>
                  <input 
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    type="email" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Company</label>
                  <input 
                    value={newClient.company}
                    onChange={(e) => setNewClient({...newClient, company: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className={cn("flex-1 px-6 py-3 rounded-xl font-bold transition-colors", getAccentClass('bg'))}>Add Client</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        {isWorkoutModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Log Workout</h3>
              <form onSubmit={handleAddWorkout} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Exercise</label>
                  <input 
                    required
                    value={newWorkout.exercise}
                    onChange={(e) => setNewWorkout({...newWorkout, exercise: e.target.value})}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    placeholder="e.g. Bench Press"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Sets</label>
                    <input 
                      required
                      value={newWorkout.sets}
                      onChange={(e) => setNewWorkout({...newWorkout, sets: Number(e.target.value)})}
                      type="number" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Reps</label>
                    <input 
                      required
                      value={newWorkout.reps}
                      onChange={(e) => setNewWorkout({...newWorkout, reps: Number(e.target.value)})}
                      type="number" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Weight (kg)</label>
                    <input 
                      required
                      value={newWorkout.weight}
                      onChange={(e) => setNewWorkout({...newWorkout, weight: Number(e.target.value)})}
                      type="number" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date</label>
                  <input 
                    required
                    value={newWorkout.date}
                    onChange={(e) => setNewWorkout({...newWorkout, date: e.target.value})}
                    type="date" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setIsWorkoutModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold transition-colors">Log Workout</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(isSidebarOpen || (mounted && window.innerWidth > 768)) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed md:relative z-[60] w-72 h-full bg-[#111111] border-r border-white/5 flex flex-col shadow-2xl md:shadow-none",
              !isSidebarOpen && "hidden md:flex"
            )}
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-500", getAccentClass('bg'), getAccentClass('shadow'))}>
                  <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">FreelanceFlow</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 custom-scrollbar overflow-y-auto">
              <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === "overview"} onClick={() => { setActiveTab("overview"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Wallet} label="Finances" active={activeTab === "finances"} onClick={() => { setActiveTab("finances"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Briefcase} label="Projects" active={activeTab === "projects"} onClick={() => { setActiveTab("projects"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Users} label="Clients" active={activeTab === "clients"} onClick={() => { setActiveTab("clients"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={StickyNote} label="Notes" active={activeTab === "notes"} onClick={() => { setActiveTab("notes"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Target} label="Goals" active={activeTab === "goals"} onClick={() => { setActiveTab("goals"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Dumbbell} label="Gym" active={activeTab === "gym"} onClick={() => { setActiveTab("gym"); setIsSidebarOpen(false); }} />
            </nav>

            <div className="p-4 mt-auto border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Theme Accent</span>
                <div className="flex gap-1.5">
                  {(['blue', 'emerald', 'rose', 'amber', 'violet'] as ThemeColor[]).map((c) => (
                    <button 
                      key={c}
                      onClick={() => setAccentColor(c)}
                      className={cn(
                        "w-4 h-4 rounded-full transition-all duration-300 hover:scale-125",
                        c === "blue" ? "bg-blue-500" : 
                        c === "emerald" ? "bg-emerald-500" : 
                        c === "rose" ? "bg-rose-500" : 
                        c === "amber" ? "bg-amber-500" : "bg-violet-500",
                        accentColor === c && "ring-2 ring-white ring-offset-2 ring-offset-[#111] scale-110"
                      )}
                    />
                  ))}
                </div>
              </div>
              
              {user ? (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <Image src={user.photoURL || ""} alt={user.displayName || "User"} width={40} height={40} className="w-10 h-10 rounded-xl border border-white/10" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{user.displayName}</p>
                    <button onClick={handleSignOut} className="text-[10px] text-gray-500 hover:text-rose-400 flex items-center gap-1 transition-colors">
                      <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black p-3 rounded-2xl font-bold hover:bg-gray-200 transition-all shadow-lg"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search projects, clients..." 
                className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 lg:w-96 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#0a0a0a]"></span>
            </button>
            <button 
              onClick={() => setIsProjectModalOpen(true)}
              className={cn("flex items-center gap-2 text-white p-2.5 sm:px-4 sm:py-2 rounded-xl text-sm font-bold transition-all", getAccentClass('bg'), getAccentClass('shadow'))}
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {!isAuthReady ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-500 font-medium animate-pulse">Loading your workspace...</p>
              </div>
            </div>
          ) : !user ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center">
                <LayoutDashboard className="w-10 h-10 text-blue-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Welcome to FreelanceFlow</h2>
                <p className="text-gray-400 max-w-md">Your all-in-one workspace for freelance success. Sign in to start tracking your projects and finances.</p>
              </div>
              
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 max-w-md flex items-start gap-3 text-left"
                >
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-400">{authError}</p>
                </motion.div>
              )}

              <button 
                onClick={handleSignIn}
                className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all shadow-xl shadow-white/5"
              >
                <LogIn className="w-5 h-5" />
                Sign In with Google
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div 
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Dashboard Overview</h2>
                      <p className="text-sm text-gray-400">Welcome back, {user?.displayName?.split(' ')[0]}! Here&apos;s what&apos;s happening.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
                      <button 
                        onClick={() => setTimeRange("weekly")}
                        className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-all", timeRange === "weekly" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}
                      >
                        Weekly
                      </button>
                      <button 
                        onClick={() => setTimeRange("monthly")}
                        className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-all", timeRange === "monthly" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}
                      >
                        Monthly
                      </button>
                      <button 
                        onClick={() => setTimeRange("yearly")}
                        className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-all", timeRange === "yearly" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300")}
                      >
                        Yearly
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} change="+12%" trend="up" icon={Wallet} color="emerald" />
                    <StatCard title="Gym Streak" value={`${gymStreak} Days`} change={gymStreak > 0 ? "Active" : "Start now"} trend="up" icon={Flame} color="rose" />
                    <StatCard title="Journal Streak" value={`${noteStreak} Days`} change={noteStreak > 0 ? "Active" : "Capture a note"} trend="up" icon={Zap} color="amber" />
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-xl tracking-tight">Revenue Analytics</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", getAccentClass('bg'))} />
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Income</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500" />
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Expenses</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-[200px] sm:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getFinancialData()}>
                            <defs>
                              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={accentColor === 'blue' ? '#3b82f6' : accentColor === 'emerald' ? '#10b981' : accentColor === 'rose' ? '#f43f5e' : accentColor === 'amber' ? '#f59e0b' : '#8b5cf6'} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={accentColor === 'blue' ? '#3b82f6' : accentColor === 'emerald' ? '#10b981' : accentColor === 'rose' ? '#f43f5e' : accentColor === 'amber' ? '#f59e0b' : '#8b5cf6'} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} fontStyle="bold" />
                            <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} fontStyle="bold" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="income" stroke={accentColor === 'blue' ? '#3b82f6' : accentColor === 'emerald' ? '#10b981' : accentColor === 'rose' ? '#f43f5e' : accentColor === 'amber' ? '#f59e0b' : '#8b5cf6'} fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                            <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fillOpacity={0.1} fill="#f43f5e" strokeWidth={2} strokeDasharray="5 5" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "finances" && (
                <motion.div 
                  key="finances"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-1">Financial Records</h2>
                      <p className="text-gray-400">Manage your income and expenses.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                        <button 
                          onClick={() => setPeriod('week')}
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all"
                        >
                          Week
                        </button>
                        <button 
                          onClick={() => setPeriod('month')}
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all"
                        >
                          Month
                        </button>
                        <button 
                          onClick={() => setPeriod('year')}
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all"
                        >
                          Year
                        </button>
                        <button 
                          onClick={() => setPeriod('all')}
                          className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all"
                        >
                          All
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 overflow-hidden">
                        <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                          <input 
                            type="date" 
                            value={financeDateStart}
                            onChange={(e) => setFinanceDateStart(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-white p-0 w-24 sm:w-28" 
                          />
                          <span className="text-gray-600">to</span>
                          <input 
                            type="date" 
                            value={financeDateEnd}
                            onChange={(e) => setFinanceDateEnd(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-white p-0 w-24 sm:w-28" 
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsTransactionModalOpen(true)}
                        className={cn("flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-medium transition-all", getAccentClass('bg'), getAccentClass('shadow'))}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                      <p className="text-emerald-400 text-sm font-medium mb-1">Total Income</p>
                      <h3 className="text-2xl font-bold font-mono text-emerald-400">
                        ${filteredTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
                      </h3>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
                      <p className="text-rose-400 text-sm font-medium mb-1">Total Expenses</p>
                      <h3 className="text-2xl font-bold font-mono text-rose-400">
                        ${filteredTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
                      </h3>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                      <p className="text-blue-400 text-sm font-medium mb-1">Net Balance</p>
                      <h3 className="text-2xl font-bold font-mono text-blue-400">
                        ${(filteredTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0) - 
                           filteredTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0)).toLocaleString()}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Category</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Type</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Amount</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-300">{new Date(t.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-sm text-gray-300">{t.category}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                t.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                              )}>
                                {t.type}
                              </span>
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-sm font-mono text-right",
                              t.type === "income" ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {t.type === "income" ? "+" : "-"}${t.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-2 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No transactions found for the selected period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === "projects" && (
                <motion.div 
                  key="projects"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-1">Projects</h2>
                      <p className="text-gray-400">Track and manage your active work.</p>
                    </div>
                    <button 
                      onClick={() => setIsProjectModalOpen(true)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Project</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                      <motion.div 
                        key={project.id}
                        whileHover={{ y: -4 }}
                        className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 flex flex-col group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                            project.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" :
                            project.status === "In Progress" ? "bg-blue-500/10 text-blue-400" :
                            "bg-amber-500/10 text-amber-400"
                          )}>
                            {project.status}
                          </span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleDeleteProject(project.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-gray-500 hover:text-rose-500 transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400 mb-6">
                          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {project.client}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {project.deadline}</span>
                        </div>
                        
                        <div className="mt-auto space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Progress</span>
                            <span className="font-bold">{project.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${project.progress}%` }}
                              className={cn(
                                "h-full rounded-full",
                                project.status === "Completed" ? "bg-emerald-500" : "bg-blue-500"
                              )}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {projects.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                          <Briefcase className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500">No projects found. Create your first one!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "notes" && (
                <motion.div 
                  key="notes"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-1">Notes</h2>
                        <p className="text-gray-400">Capture your thoughts and ideas.</p>
                      </div>
                      {noteStreak > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                          <Zap className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                          <span className="text-lg font-bold text-amber-500 font-mono">{noteStreak} Day Streak</span>
                        </div>
                      )}
                    </div>
                    <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl font-medium transition-all border border-white/10">
                      <Plus className="w-4 h-4" />
                      <span>New Note</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { title: "Project Ideas", content: "Explore new SaaS opportunities in the productivity space.", date: "2 hours ago", color: "blue" },
                      { title: "Meeting Notes", content: "Client feedback on the new dashboard design was positive.", date: "Yesterday", color: "emerald" },
                      { title: "To-Do List", content: "1. Update dependencies\n2. Fix mobile bugs\n3. Deploy to production", date: "3 days ago", color: "amber" },
                    ].map((note, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ y: -4 }}
                        className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 space-y-4 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn("w-2 h-2 rounded-full", note.color === "blue" ? "bg-blue-500" : note.color === "emerald" ? "bg-emerald-500" : "bg-amber-500")} />
                          <span className="text-xs text-gray-500 font-mono">{note.date}</span>
                        </div>
                        <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">{note.title}</h3>
                        <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{note.content}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeTab === "goals" && (
                <motion.div 
                  key="goals"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-1">Goals</h2>
                      <p className="text-gray-400">Set and track your milestones.</p>
                    </div>
                    <button 
                      onClick={() => setIsGoalModalOpen(true)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Set New Goal</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals.map((goal) => (
                      <motion.div 
                        key={goal.id}
                        className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg">{goal.title}</h3>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setSelectedGoal(goal);
                                setManualGoalAmt(goal.current);
                                setIsGoalUpdateModalOpen(true);
                              }}
                              className="p-2 hover:bg-white/5 rounded-lg text-blue-400 transition-colors"
                              title="Update Progress"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="p-2 hover:bg-white/5 rounded-lg text-rose-400 transition-colors"
                              title="Delete Goal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Progress</span>
                            <span className="font-mono">${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {goals.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                          <Target className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500">No goals set yet. What&apos;s your next target?</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "gym" && (
                <motion.div 
                  key="gym"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-1">Gym Tracker</h2>
                        <p className="text-gray-400 text-sm">Maintain your health while you hustle.</p>
                      </div>
                      {gymStreak > 0 && (
                        <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-2xl flex items-center gap-2 animate-pulse">
                          <Flame className="w-5 h-5 text-rose-500" />
                          <span className="text-lg font-bold text-rose-500 font-mono">{gymStreak}</span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsWorkoutModalOpen(true)}
                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-rose-900/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Log Workout</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="md:col-span-2 lg:col-span-2 space-y-6">
                      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Exercise</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Sets x Reps</th>
                               <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Weight</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Date</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {workouts.map((workout) => (
                              <tr key={workout.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 font-medium">{workout.exercise}</td>
                                <td className="px-6 py-4 text-gray-400">{workout.sets} x {workout.reps}</td>
                                <td className="px-6 py-4 text-gray-400 font-mono">{workout.weight} kg</td>
                                <td className="px-6 py-4 text-xs text-gray-500">{workout.date}</td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => handleDeleteWorkout(workout.id)}
                                    className="p-2 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {workouts.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No workouts logged yet. Time to hit the gym!</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="md:col-span-2 lg:col-span-1 space-y-6">
                      <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-rose-500/20 rounded-lg">
                            <Heart className="w-5 h-5 text-rose-500" />
                          </div>
                          <h3 className="font-bold">Health Tip</h3>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          &quot;Sitting is the new smoking.&quot; As a freelancer, remember to take a 5-minute walk every hour to keep your blood flowing and mind sharp.
                        </p>
                      </div>

                      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold">Workout Checklist</h3>
                          <span className="text-[10px] bg-white/5 px-2 py-1 rounded-lg text-gray-500 uppercase tracking-widest">{checklists.filter(c => c.completed).length}/{checklists.length} Done</span>
                        </div>
                        <form onSubmit={handleAddChecklist} className="flex gap-2 mb-4">
                          <input 
                            type="text" 
                            placeholder="Add task..." 
                            value={newChecklist}
                            onChange={(e) => setNewChecklist(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button type="submit" className="p-1.5 bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </form>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {checklists.map((item) => (
                            <div key={item.id} className="flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => handleUpdateChecklist(item.id, !item.completed)}
                                  className={cn(
                                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                    item.completed ? "bg-emerald-500 border-emerald-500" : "border-white/10 hover:border-white/30"
                                  )}
                                >
                                  {item.completed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </button>
                                <span className={cn("text-sm transition-all", item.completed ? "text-gray-500 line-through" : "text-gray-300")}>
                                  {item.text}
                                </span>
                              </div>
                              <button 
                                onClick={() => handleDeleteChecklist(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-500 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {checklists.length === 0 && (
                            <div className="py-8 text-center">
                              <p className="text-xs text-gray-500 italic">No tasks yet. Create one!</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "clients" && (
                <motion.div 
                  key="clients"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-6xl mx-auto space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">Client CRM</h2>
                      <p className="text-gray-400">Manage your professional relationships and contacts.</p>
                    </div>
                    <button 
                      onClick={() => setIsClientModalOpen(true)}
                      className={cn("flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-bold transition-all", getAccentClass('bg'), getAccentClass('shadow'))}
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Client</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => (
                      <motion.div 
                        key={client.id}
                        whileHover={{ y: -5 }}
                        className="bg-[#111111] border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold", getAccentClass('bg'))}>
                            {client.name?.charAt(0) || "?"}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400"><Mail className="w-4 h-4" /></button>
                            <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400"><Phone className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-1">{client.name}</h3>
                        <p className="text-sm text-gray-400 mb-4">{client.company || "Independent"}</p>
                        
                        <div className="space-y-3 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <Mail className="w-4 h-4" />
                            <span>{client.email || "No email"}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <Phone className="w-4 h-4" />
                            <span>{client.phone || "No phone"}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

