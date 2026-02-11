import { useState, useEffect, useRef, useCallback } from 'react';
import { quizApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Spinner, Input } from '../components/ui';
import {
    Brain, ChevronRight, ChevronLeft, Trophy, Target, Users, Swords, Crown,
    Clock, Zap, Lock, CheckCircle, XCircle, ArrowLeft, Copy, Check,
    Star, TrendingUp, Shield, Award, Play, History, Hash
} from 'lucide-react';

// ═══════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════

interface QuizQuestion {
    id: string;
    question: string;
    optionA: string;
    optionB: string;
    timeLimit: number;
}

interface Answer {
    questionId: string;
    answer: string;
    timeTaken: number;
}

interface GradedAnswer extends Answer {
    correct: boolean;
}

interface GameResult {
    score: number;
    totalQuestions: number;
    isPerfect?: boolean;
    payout: number;
    entryAmount: number;
    answers: GradedAnswer[];
    message: string;
    gameComplete?: boolean;
}

type View = 'courses' | 'modules' | 'levels' | 'mode' | 'amount' | 'playing' | 'results' | 'history' | 'my-codes' | 'duel-join' | 'duel-waiting' | 'league-setup' | 'league-join' | 'league-lobby';

// ═══════════════════════════════════════════════
//  MAIN QUIZ PAGE COMPONENT
// ═══════════════════════════════════════════════

export const QuizPage = () => {
    const { user, refreshUser } = useAuth();

    // Navigation state
    const [view, setView] = useState<View>('courses');
    const [courses, setCourses] = useState<any[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [selectedModule, setSelectedModule] = useState<any>(null);
    const [selectedLevel, setSelectedLevel] = useState<any>(null);
    const [selectedMode, setSelectedMode] = useState<'SOLO' | 'DUEL' | 'LEAGUE'>('SOLO');

    // Game state
    const [entryAmount, setEntryAmount] = useState('');
    const [pin, setPin] = useState('');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [gameId, setGameId] = useState('');
    const [gameResult, setGameResult] = useState<GameResult | null>(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [gameStartTime, setGameStartTime] = useState(0);
    const [questionStartTime, setQuestionStartTime] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showCorrect, setShowCorrect] = useState(false);

    // Duel/League state
    const [matchCode, setMatchCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [maxPlayers, setMaxPlayers] = useState('5');
    const [lobbyStatus, setLobbyStatus] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // History state
    const [gameHistory, setGameHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyMeta, setHistoryMeta] = useState<any>({});
    const [myCodes, setMyCodes] = useState<any[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const timerRef = useRef<any>(null);
    const pollingRef = useRef<any>(null);

    // Load courses on mount
    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const res = await quizApi.getCourses();
            setCourses(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    // Timer logic
    useEffect(() => {
        if (view !== 'playing') return;

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Time's up — auto-submit with no answer
                    handleAnswer('');
                    return 15;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [view, currentQuestionIndex]);

    // Polling for duel/league status
    useEffect(() => {
        if (view === 'duel-waiting' && gameId) {
            pollingRef.current = setInterval(async () => {
                try {
                    const res = await quizApi.getDuelStatus(gameId);
                    setLobbyStatus(res.data);
                    if (res.data.status === 'IN_PROGRESS') {
                        clearInterval(pollingRef.current);
                        // Fetch questions — they come from joining
                    }
                    if (res.data.status === 'COMPLETED') {
                        clearInterval(pollingRef.current);
                        setGameResult({
                            score: 0, totalQuestions: 0,
                            payout: 0, entryAmount: 0,
                            answers: [],
                            message: 'Match complete!',
                            gameComplete: true
                        });
                        setView('results');
                        refreshUser();
                    }
                } catch { }
            }, 3000);
            return () => clearInterval(pollingRef.current);
        }

        if (view === 'league-lobby' && gameId) {
            pollingRef.current = setInterval(async () => {
                try {
                    const res = await quizApi.getLeagueStatus(gameId);
                    setLobbyStatus(res.data);
                    if (res.data.status === 'IN_PROGRESS' || res.data.status === 'COMPLETED') {
                        clearInterval(pollingRef.current);
                    }
                } catch { }
            }, 3000);
            return () => clearInterval(pollingRef.current);
        }
    }, [view, gameId]);

    // ═══════════════════════════════════════════════
    //  HANDLERS
    // ═══════════════════════════════════════════════

    const handleAnswer = useCallback((answer: string) => {
        clearInterval(timerRef.current);
        const timeTaken = (Date.now() - questionStartTime) / 1000;

        const currentQ = questions[currentQuestionIndex];
        const newAnswer: Answer = {
            questionId: currentQ.id,
            answer: answer || '',
            timeTaken: Math.round(timeTaken * 100) / 100
        };

        setSelectedAnswer(answer);
        setShowCorrect(true);

        // Show correct/incorrect for 1.2s then advance
        setTimeout(() => {
            const updatedAnswers = [...answers, newAnswer];
            setAnswers(updatedAnswers);
            setSelectedAnswer(null);
            setShowCorrect(false);

            if (currentQuestionIndex + 1 < questions.length) {
                setCurrentQuestionIndex(prev => prev + 1);
                setTimeLeft(questions[currentQuestionIndex + 1]?.timeLimit || 15);
                setQuestionStartTime(Date.now());
            } else {
                // Submit game
                const totalTime = (Date.now() - gameStartTime) / 1000;
                submitGame(updatedAnswers, totalTime);
            }
        }, 1200);
    }, [currentQuestionIndex, questions, answers, questionStartTime, gameStartTime]);

    const submitGame = async (finalAnswers: Answer[], totalTime: number) => {
        setLoading(true);
        setView('results');
        try {
            let res;
            if (selectedMode === 'SOLO') {
                res = await quizApi.submitSolo(gameId, finalAnswers, totalTime);
            } else if (selectedMode === 'DUEL') {
                res = await quizApi.submitDuel(gameId, finalAnswers, totalTime);
            } else {
                res = await quizApi.submitLeague(gameId, finalAnswers, totalTime);
            }
            setGameResult(res.data);
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit answers');
        } finally {
            setLoading(false);
        }
    };

    const startSoloGame = async () => {
        if (!entryAmount || !pin) {
            setError('Enter amount and PIN');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.startSolo(selectedLevel.id, Number(entryAmount), pin);
            setGameId(res.data.gameId);
            setQuestions(res.data.questions);
            setCurrentQuestionIndex(0);
            setAnswers([]);
            setTimeLeft(res.data.questions[0]?.timeLimit || 15);
            setGameStartTime(Date.now());
            setQuestionStartTime(Date.now());
            setView('playing');
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start game');
        } finally {
            setLoading(false);
        }
    };

    const createDuel = async () => {
        if (!entryAmount || !pin) { setError('Enter amount and PIN'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.createDuel(selectedLevel.id, Number(entryAmount), pin);
            setGameId(res.data.gameId);
            setMatchCode(res.data.matchCode);
            setView('duel-waiting');
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create duel');
        } finally {
            setLoading(false);
        }
    };

    const joinDuel = async () => {
        if (!joinCode || !pin) { setError('Enter match code and PIN'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.joinDuel(joinCode.toUpperCase(), pin);
            setGameId(res.data.gameId);
            setQuestions(res.data.questions);
            setCurrentQuestionIndex(0);
            setAnswers([]);
            setTimeLeft(res.data.questions[0]?.timeLimit || 15);
            setGameStartTime(Date.now());
            setQuestionStartTime(Date.now());
            setSelectedMode('DUEL');
            setView('playing');
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to join duel');
        } finally {
            setLoading(false);
        }
    };

    const createLeague = async () => {
        if (!entryAmount || !pin || !maxPlayers) { setError('Fill all fields'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.createLeague(selectedLevel.id, Number(entryAmount), Number(maxPlayers), pin);
            setGameId(res.data.gameId);
            setMatchCode(res.data.matchCode);
            setLobbyStatus({ playerCount: 1, maxPlayers: Number(maxPlayers), status: 'WAITING', participants: [] });
            setView('league-lobby');
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create league');
        } finally {
            setLoading(false);
        }
    };

    const joinLeague = async () => {
        if (!joinCode || !pin) { setError('Enter code and PIN'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.joinLeague(joinCode.toUpperCase(), pin);
            setGameId(res.data.gameId);
            setLobbyStatus({ playerCount: res.data.currentPlayers, maxPlayers: res.data.maxPlayers, status: 'WAITING', participants: [] });
            setSelectedMode('LEAGUE');
            setView('league-lobby');
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to join league');
        } finally {
            setLoading(false);
        }
    };

    const startLeagueGame = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await quizApi.startLeague(gameId);
            setQuestions(res.data.questions);
            setCurrentQuestionIndex(0);
            setAnswers([]);
            setTimeLeft(res.data.questions[0]?.timeLimit || 15);
            setGameStartTime(Date.now());
            setQuestionStartTime(Date.now());
            setView('playing');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start league');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const res = await quizApi.getHistory(page);
            setGameHistory(res.data.data);
            setHistoryMeta(res.data.meta);
            setHistoryPage(page);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyCodes = async () => {
        setLoading(true);
        try {
            const res = await quizApi.getMyCodes();
            setMyCodes(res.data);
            if (res.data.length === 0) {
                // optional: add toast or just show empty state
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load codes');
        } finally {
            setLoading(false);
        }
    };

    const cancelMatch = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this match? You will be refunded instantly.')) return;
        setLoading(true);
        try {
            await quizApi.cancelQuiz(id);
            if (view === 'my-codes') {
                fetchMyCodes();
            } else {
                resetGame();
            }
            refreshUser();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to cancel match');
        } finally {
            setLoading(false);
        }
    };

    const continueGame = (game: any) => {
        setGameId(game.id);
        setMatchCode(game.matchCode);
        setSelectedMode(game.mode);

        if (game.mode === 'DUEL') {
            setView('duel-waiting');
        } else if (game.mode === 'LEAGUE') {
            setLobbyStatus({
                playerCount: game.currentPlayers,
                maxPlayers: game.maxPlayers,
                status: game.status,
                participants: []
            });
            setView('league-lobby');
        }
    };

    const resetGame = () => {
        setView('courses');
        setSelectedCourse(null);
        setSelectedModule(null);
        setSelectedLevel(null);
        setEntryAmount('');
        setPin('');
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setAnswers([]);
        setGameId('');
        setGameResult(null);
        setMatchCode('');
        setJoinCode('');
        setError('');
        setSelectedAnswer(null);
        setShowCorrect(false);
        clearInterval(pollingRef.current);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const goBack = () => {
        setError('');
        if (view === 'modules') setView('courses');
        else if (view === 'levels') setView('modules');
        else if (view === 'mode') setView('levels');
        else if (view === 'amount') setView('mode');
        else if (view === 'duel-join') setView('mode');
        else if (view === 'league-setup') setView('mode');
        else if (view === 'league-join') setView('mode');
        else if (view === 'history') setView('courses');
        else if (view === 'my-codes') setView('courses');
        else resetGame();
    };

    // ═══════════════════════════════════════════════
    //  RENDER HELPERS
    // ═══════════════════════════════════════════════

    const renderHeader = (title: string, subtitle?: string) => (
        <div className="flex items-center gap-3 mb-6">
            <button onClick={goBack} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
                <ArrowLeft size={18} className="text-slate-300" />
            </button>
            <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════
    //  VIEWS
    // ═══════════════════════════════════════════════

    // COURSES VIEW
    if (view === 'courses') {
        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Brain size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Mendula Quiz Arena</h1>
                            <p className="text-xs text-slate-400">Test your knowledge, earn rewards</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { fetchHistory(); setView('history'); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                    >
                        <History size={14} /> History
                    </button>
                    <button
                        onClick={() => { fetchMyCodes(); setView('my-codes'); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors ml-2"
                    >
                        <Hash size={14} /> My Codes
                    </button>
                </div>

                {/* Game Mode Cards */}
                <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 text-center bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border-emerald-700/20 hover:border-emerald-500/40 transition-all cursor-pointer group"
                        onClick={() => { }}>
                        <Target size={24} className="text-emerald-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                        <div className="text-[10px] font-bold text-emerald-400">Solo</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">vs System</div>
                    </Card>
                    <Card className="p-3 text-center bg-gradient-to-br from-orange-900/30 to-orange-800/10 border-orange-700/20 hover:border-orange-500/40 transition-all cursor-pointer group">
                        <Swords size={24} className="text-orange-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                        <div className="text-[10px] font-bold text-orange-400">Duel</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">1 vs 1</div>
                    </Card>
                    <Card className="p-3 text-center bg-gradient-to-br from-violet-900/30 to-violet-800/10 border-violet-700/20 hover:border-violet-500/40 transition-all cursor-pointer group">
                        <Crown size={24} className="text-violet-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                        <div className="text-[10px] font-bold text-violet-400">League</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">Tournament</div>
                    </Card>
                </div>

                {/* Courses */}
                <div>
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Star size={14} className="text-amber-400" /> Select a Course
                    </h3>
                    {loading ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : (
                        <div className="space-y-2">
                            {courses.map(course => (
                                <Card
                                    key={course.id}
                                    className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-800/80 hover:border-slate-600/50 transition-all group"
                                    onClick={() => { setSelectedCourse(course); setView('modules'); }}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                                        {course.icon || '📚'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-white text-sm">{course.name}</div>
                                        <div className="text-[11px] text-slate-400 truncate">{course.description}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {course.modules?.length || 0} module{course.modules?.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
        );
    }

    // MODULES VIEW
    if (view === 'modules') {
        return (
            <div className="space-y-4">
                {renderHeader(selectedCourse?.name, selectedCourse?.description)}
                <div className="space-y-2">
                    {selectedCourse?.modules?.map((mod: any) => (
                        <Card
                            key={mod.id}
                            className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-800/80 hover:border-slate-600/50 transition-all group"
                            onClick={() => { setSelectedModule(mod); setView('levels'); }}
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 flex items-center justify-center border border-blue-500/20">
                                <Brain size={18} className="text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white text-sm">{mod.name}</div>
                                <div className="text-[11px] text-slate-400 truncate">{mod.description}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    {mod.levels?.length || 0} level{mod.levels?.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    // LEVELS VIEW
    if (view === 'levels') {
        const levelColors: Record<number, string> = {
            1: 'from-emerald-600/20 to-green-600/20 border-emerald-500/20',
            2: 'from-amber-600/20 to-yellow-600/20 border-amber-500/20',
            3: 'from-red-600/20 to-rose-600/20 border-red-500/20',
        };
        const levelIcons: Record<number, string> = { 1: '🟢', 2: '🟡', 3: '🔴' };

        return (
            <div className="space-y-4">
                {renderHeader(selectedModule?.name, `${selectedCourse?.name} • ${selectedModule?.description}`)}
                <div className="space-y-2">
                    {selectedModule?.levels?.map((level: any) => (
                        <Card
                            key={level.id}
                            className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-800/80 transition-all group bg-gradient-to-r ${levelColors[level.level] || levelColors[1]}`}
                            onClick={() => {
                                if (level._count?.questions >= 5) {
                                    setSelectedLevel(level);
                                    setView('mode');
                                }
                            }}
                        >
                            <div className="text-2xl">{levelIcons[level.level] || '🟢'}</div>
                            <div className="flex-1">
                                <div className="font-semibold text-white text-sm">{level.name}</div>
                                <div className="text-[10px] text-slate-400">
                                    {level._count?.questions || 0} questions
                                </div>
                            </div>
                            {level._count?.questions >= 5 ? (
                                <Play size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                            ) : (
                                <Lock size={16} className="text-slate-600" />
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    // MODE SELECTION VIEW
    if (view === 'mode') {
        return (
            <div className="space-y-4">
                {renderHeader('Choose Game Mode', `${selectedCourse?.name} • ${selectedModule?.name} • ${selectedLevel?.name}`)}

                <Card
                    className="p-4 cursor-pointer hover:bg-emerald-900/20 hover:border-emerald-500/30 transition-all group"
                    onClick={() => { setSelectedMode('SOLO'); setView('amount'); }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center border border-emerald-500/30">
                            <Target size={24} className="text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-white flex items-center gap-2">
                                Solo Skill Challenge
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">BEST FOR START</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">You vs System • 100% correct to win • 1.9x payout</div>
                        </div>
                        <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400" />
                    </div>
                </Card>

                <Card
                    className="p-4 cursor-pointer hover:bg-orange-900/20 hover:border-orange-500/30 transition-all group"
                    onClick={() => { setSelectedMode('DUEL'); setView('amount'); }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center border border-orange-500/30">
                            <Swords size={24} className="text-orange-400" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-white flex items-center gap-2">
                                Duel Skill Match
                                <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">PVP</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">1v1 Challenge • Higher score wins • 10% platform fee</div>
                        </div>
                        <ChevronRight size={18} className="text-slate-500 group-hover:text-orange-400" />
                    </div>
                </Card>

                <Card className="p-4 cursor-pointer hover:bg-violet-900/20 hover:border-violet-500/30 transition-all group"
                    onClick={() => { setSelectedMode('LEAGUE'); setView('amount'); }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center border border-violet-500/30">
                            <Crown size={24} className="text-violet-400" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-white flex items-center gap-2">
                                League Skill Arena
                                <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">MULTI</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">3-50 players • Bracket payouts • 10% platform fee</div>
                        </div>
                        <ChevronRight size={18} className="text-slate-500 group-hover:text-violet-400" />
                    </div>
                </Card>

                {/* Join existing match */}
                <div className="border-t border-slate-800 pt-4 space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Join Existing Match</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <Card
                            className="p-3 text-center cursor-pointer hover:bg-orange-900/10 hover:border-orange-500/20 transition-all"
                            onClick={() => { setSelectedMode('DUEL'); setView('duel-join'); }}
                        >
                            <Swords size={18} className="text-orange-400 mx-auto mb-1" />
                            <div className="text-[11px] font-medium text-white">Join Duel</div>
                            <div className="text-[9px] text-slate-500">Enter match code</div>
                        </Card>
                        <Card
                            className="p-3 text-center cursor-pointer hover:bg-violet-900/10 hover:border-violet-500/20 transition-all"
                            onClick={() => { setSelectedMode('LEAGUE'); setView('league-join'); }}
                        >
                            <Crown size={18} className="text-violet-400 mx-auto mb-1" />
                            <div className="text-[11px] font-medium text-white">Join League</div>
                            <div className="text-[9px] text-slate-500">Enter league code</div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // AMOUNT / PIN ENTRY VIEW
    if (view === 'amount') {
        const modeConfig = {
            SOLO: { color: 'emerald', label: 'Solo Challenge', icon: Target, winInfo: 'Score 100% to win 1.9x your entry' },
            DUEL: { color: 'orange', label: 'Duel Match', icon: Swords, winInfo: 'Beat your opponent to win the pot (minus 10% fee)' },
            LEAGUE: { color: 'violet', label: 'League Arena', icon: Crown, winInfo: 'Top 4 win bracket payouts (minus 10% fee)' },
        };
        const config = modeConfig[selectedMode];
        const amountPresets = ['100', '200', '500', '1000', '2000', '5000'];

        return (
            <div className="space-y-4">
                {renderHeader(config.label, `${selectedCourse?.name} • ${selectedModule?.name} • ${selectedLevel?.name}`)}

                {/* Entry Amount */}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Zap size={14} className={`text-${config.color}-400`} /> Entry Amount (₦)
                    </div>
                    <Input
                        type="number"
                        placeholder="Enter amount"
                        value={entryAmount}
                        onChange={(e: any) => setEntryAmount(e.target.value)}
                        className="text-lg font-bold text-center"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {amountPresets.map(amt => (
                            <button
                                key={amt}
                                onClick={() => setEntryAmount(amt)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                    ${entryAmount === amt
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                            >
                                ₦{Number(amt).toLocaleString()}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <TrendingUp size={10} /> {config.winInfo}
                    </div>
                </Card>

                {/* League: Max Players */}
                {selectedMode === 'LEAGUE' && (
                    <Card className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Users size={14} className="text-violet-400" /> Max Players
                        </div>
                        <Input
                            type="number"
                            placeholder="3-50 players"
                            value={maxPlayers}
                            onChange={(e: any) => setMaxPlayers(e.target.value)}
                            min={3}
                            max={50}
                        />
                    </Card>
                )}

                {/* PIN */}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Lock size={14} className="text-slate-400" /> Transaction PIN
                    </div>
                    <Input
                        type="password"
                        placeholder="Enter your PIN"
                        value={pin}
                        onChange={(e: any) => setPin(e.target.value)}
                        maxLength={6}
                    />
                </Card>

                {/* Balance Info */}
                <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500">Available Balance</span>
                    <span className="font-bold text-white">₦{(user?.balance || 0).toLocaleString()}</span>
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <Button
                    onClick={() => {
                        if (selectedMode === 'SOLO') startSoloGame();
                        else if (selectedMode === 'DUEL') createDuel();
                        else createLeague();
                    }}
                    disabled={loading || !entryAmount || !pin}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-3 rounded-xl"
                >
                    {loading ? <Spinner /> : selectedMode === 'SOLO' ? '⚡ Start Challenge' : selectedMode === 'DUEL' ? '⚔️ Create Duel' : '👑 Create League'}
                </Button>
            </div>
        );
    }

    // DUEL JOIN VIEW
    if (view === 'duel-join') {
        return (
            <div className="space-y-4">
                {renderHeader('Join Duel Match', 'Enter the match code shared by your opponent')}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Hash size={14} className="text-orange-400" /> Match Code
                    </div>
                    <Input
                        placeholder="Enter 6-character code"
                        value={joinCode}
                        onChange={(e: any) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center text-lg font-mono tracking-widest uppercase"
                    />
                </Card>
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Lock size={14} className="text-slate-400" /> Transaction PIN
                    </div>
                    <Input
                        type="password"
                        placeholder="Enter your PIN"
                        value={pin}
                        onChange={(e: any) => setPin(e.target.value)}
                        maxLength={6}
                    />
                </Card>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <Button onClick={joinDuel} disabled={loading || !joinCode || !pin}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold py-3 rounded-xl">
                    {loading ? <Spinner /> : '⚔️ Join Duel'}
                </Button>
            </div>
        );
    }

    // LEAGUE JOIN VIEW
    if (view === 'league-join') {
        return (
            <div className="space-y-4">
                {renderHeader('Join League', 'Enter the league code to participate')}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Hash size={14} className="text-violet-400" /> League Code
                    </div>
                    <Input
                        placeholder="Enter 6-character code"
                        value={joinCode}
                        onChange={(e: any) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center text-lg font-mono tracking-widest uppercase"
                    />
                </Card>
                <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Lock size={14} className="text-slate-400" /> Transaction PIN
                    </div>
                    <Input
                        type="password"
                        placeholder="Enter your PIN"
                        value={pin}
                        onChange={(e: any) => setPin(e.target.value)}
                        maxLength={6}
                    />
                </Card>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <Button onClick={joinLeague} disabled={loading || !joinCode || !pin}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold py-3 rounded-xl">
                    {loading ? <Spinner /> : '👑 Join League'}
                </Button>
            </div>
        );
    }

    // DUEL WAITING VIEW
    if (view === 'duel-waiting') {
        return (
            <div className="space-y-4">
                {renderHeader('Waiting for Opponent', 'Share the match code with your challenger')}
                <Card className="p-6 text-center space-y-4">
                    <Swords size={48} className="text-orange-400 mx-auto animate-pulse" />
                    <div>
                        <p className="text-xs text-slate-400 mb-2">Match Code</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-mono font-bold text-white tracking-[0.3em]">{matchCode}</span>
                            <button onClick={() => copyToClipboard(matchCode)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-slate-400" />}
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 animate-pulse">Waiting for opponent to join...</div>
                    {lobbyStatus && (
                        <div className="text-xs text-slate-400">
                            Players: {lobbyStatus.playerCount}/2
                        </div>
                    )}
                </Card>
                <div className="flex gap-2">
                    <Button onClick={resetGame} variant="ghost" className="flex-1 text-slate-400">Close</Button>
                    <Button onClick={() => cancelMatch(gameId)} variant="ghost" className="flex-1 text-red-400 border border-red-500/20 hover:bg-red-500/10">Cancel Match</Button>
                </div>
            </div>
        );
    }

    // LEAGUE LOBBY VIEW
    if (view === 'league-lobby') {
        return (
            <div className="space-y-4">
                {renderHeader('League Lobby', `${lobbyStatus?.playerCount || 0}/${lobbyStatus?.maxPlayers || maxPlayers} players`)}
                <Card className="p-6 text-center space-y-4">
                    <Crown size={48} className="text-violet-400 mx-auto animate-pulse" />
                    <div>
                        <p className="text-xs text-slate-400 mb-2">League Code</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-mono font-bold text-white tracking-[0.3em]">{matchCode}</span>
                            <button onClick={() => copyToClipboard(matchCode)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-slate-400" />}
                            </button>
                        </div>
                    </div>

                    {/* Players list */}
                    {lobbyStatus?.participants?.length > 0 && (
                        <div className="space-y-1">
                            {lobbyStatus.participants.map((p: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">
                                        {i + 1}
                                    </div>
                                    <span className="text-xs text-white">{p.username || 'Player'}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="text-xs text-slate-500">
                        {(lobbyStatus?.playerCount || 1) < 3
                            ? `Need at least 3 players to start. ${3 - (lobbyStatus?.playerCount || 1)} more needed.`
                            : 'Ready to start!'
                        }
                    </div>
                </Card>

                {(lobbyStatus?.playerCount || 1) >= 3 && (
                    <Button onClick={startLeagueGame} disabled={loading}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold py-3 rounded-xl">
                        {loading ? <Spinner /> : `🏆 Start League (${lobbyStatus?.playerCount} players)`}
                    </Button>
                )}
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <div className="flex gap-2">
                    <Button onClick={resetGame} variant="ghost" className="flex-1 text-slate-400">Close</Button>
                    <Button onClick={() => cancelMatch(gameId)} variant="ghost" className="flex-1 text-red-400 border border-red-500/20 hover:bg-red-500/10">Cancel League</Button>
                </div>
            </div>
        );
    }

    // PLAYING VIEW
    if (view === 'playing') {
        const currentQ = questions[currentQuestionIndex];
        if (!currentQ) return <div className="flex justify-center py-12"><Spinner /></div>;

        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        const isTimeCritical = timeLeft <= 5;

        return (
            <div className="space-y-4">
                {/* Progress Bar & Info */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium">
                        Question {currentQuestionIndex + 1}/{questions.length}
                    </span>
                    <div className={`flex items-center gap-1 font-bold text-lg ${isTimeCritical ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                        <Clock size={16} /> {timeLeft}s
                    </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Question */}
                <Card className="p-5 min-h-[140px] flex items-center justify-center">
                    <p className="text-white font-semibold text-base text-center leading-relaxed">
                        {currentQ.question}
                    </p>
                </Card>

                {/* Options */}
                <div className="space-y-3">
                    {['A', 'B'].map(option => {
                        const optionText = option === 'A' ? currentQ.optionA : currentQ.optionB;
                        let btnClass = 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 hover:border-slate-500 text-white';

                        if (showCorrect) {
                            if (selectedAnswer === option) {
                                // User selected this option
                                btnClass = 'bg-amber-500/20 border-amber-500/50 text-amber-300';
                            }
                        }

                        return (
                            <button
                                key={option}
                                onClick={() => !showCorrect && handleAnswer(option)}
                                disabled={showCorrect}
                                className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${btnClass}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                    ${showCorrect && selectedAnswer === option ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                                    {option}
                                </div>
                                <span className="font-medium text-sm">{optionText}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Score indicator */}
                <div className="flex items-center justify-center gap-1 pt-2">
                    {answers.map((a, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${a.answer ? 'bg-amber-500' : 'bg-slate-700'}`}
                        />
                    ))}
                    {Array.from({ length: questions.length - answers.length }).map((_, i) => (
                        <div key={`remaining-${i}`} className="w-2 h-2 rounded-full bg-slate-800" />
                    ))}
                </div>
            </div>
        );
    }

    // RESULTS VIEW
    if (view === 'results') {
        if (loading || !gameResult) {
            return (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <Spinner />
                    <p className="text-sm text-slate-400">Calculating results...</p>
                </div>
            );
        }

        const isWin = gameResult.isPerfect || gameResult.payout > 0;
        const percentage = gameResult.totalQuestions > 0
            ? Math.round((gameResult.score / gameResult.totalQuestions) * 100) : 0;

        return (
            <div className="space-y-4">
                {/* Result Header */}
                <div className="text-center py-4">
                    <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-3
                        ${isWin
                            ? 'bg-gradient-to-br from-amber-400/20 to-yellow-500/20 border-2 border-amber-400/40'
                            : 'bg-gradient-to-br from-slate-700/20 to-slate-600/20 border-2 border-slate-600/40'
                        }`}>
                        {isWin
                            ? <Trophy size={36} className="text-amber-400" />
                            : <Target size={36} className="text-slate-400" />
                        }
                    </div>
                    <h2 className={`text-2xl font-bold ${isWin ? 'text-amber-400' : 'text-white'}`}>
                        {isWin ? 'You Won! 🎉' : 'Keep Practicing!'}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">{gameResult.message}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 text-center">
                        <div className="text-lg font-bold text-white">{gameResult.score}/{gameResult.totalQuestions}</div>
                        <div className="text-[10px] text-slate-400">Score</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className={`text-lg font-bold ${percentage >= 70 ? 'text-emerald-400' : percentage >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {percentage}%
                        </div>
                        <div className="text-[10px] text-slate-400">Accuracy</div>
                    </Card>
                    <Card className="p-3 text-center">
                        <div className={`text-lg font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isWin ? `₦${gameResult.payout.toLocaleString()}` : `-₦${(gameResult.entryAmount || 0).toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-slate-400">{isWin ? 'Won' : 'Lost'}</div>
                    </Card>
                </div>

                {/* Answer Breakdown */}
                {gameResult.answers?.length > 0 && (
                    <Card className="p-3 space-y-2">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Answer Breakdown</h3>
                        <div className="space-y-1.5">
                            {gameResult.answers.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    {a.correct
                                        ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                        : <XCircle size={14} className="text-red-400 shrink-0" />
                                    }
                                    <span className="text-slate-300 flex-1">Q{i + 1}</span>
                                    <span className="text-slate-500">{a.timeTaken.toFixed(1)}s</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2">
                    <Button
                        onClick={resetGame}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 rounded-xl"
                    >
                        Play Again
                    </Button>
                    <Button
                        onClick={() => { fetchHistory(); setView('history'); }}
                        variant="ghost"
                        className="w-full text-slate-400"
                    >
                        <History size={16} /> View History
                    </Button>
                </div>
            </div>
        );
    }

    // HISTORY VIEW
    if (view === 'history') {
        return (
            <div className="space-y-4">
                {renderHeader('Quiz History', 'Your past games and earnings')}

                {loading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                ) : gameHistory.length === 0 ? (
                    <Card className="p-8 text-center">
                        <Brain size={32} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No games played yet</p>
                        <p className="text-xs text-slate-500 mt-1">Start a quiz to see your history here</p>
                    </Card>
                ) : (
                    <>
                        <div className="space-y-2">
                            {gameHistory.map((game: any) => (
                                <Card key={game.id} className="p-3 flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                                        ${game.isWinner ? 'bg-emerald-500/20' : 'bg-red-500/10'}`}>
                                        {game.isWinner
                                            ? <Trophy size={16} className="text-emerald-400" />
                                            : <Target size={16} className="text-red-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                            {game.course}
                                            <span className={`text-[8px] px-1 py-0.5 rounded ${game.mode === 'SOLO' ? 'bg-emerald-500/20 text-emerald-400' : game.mode === 'DUEL' ? 'bg-orange-500/20 text-orange-400' : 'bg-violet-500/20 text-violet-400'}`}>
                                                {game.mode}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">{game.module} • {game.level}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xs font-bold ${game.isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {game.isWinner ? `+₦${game.payout.toLocaleString()}` : `-₦${game.entryAmount.toLocaleString()}`}
                                        </div>
                                        <div className="text-[10px] text-slate-500">Score: {game.score}</div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Pagination */}
                        {historyMeta.totalPages > 1 && (
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="ghost"
                                    onClick={() => fetchHistory(historyPage - 1)}
                                    disabled={historyPage <= 1}
                                    className="text-xs"
                                >
                                    <ChevronLeft size={14} /> Prev
                                </Button>
                                <span className="text-xs text-slate-500">
                                    {historyPage} / {historyMeta.totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    onClick={() => fetchHistory(historyPage + 1)}
                                    disabled={historyPage >= historyMeta.totalPages}
                                    className="text-xs"
                                >
                                    Next <ChevronRight size={14} />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    // MY CODES VIEW
    if (view === 'my-codes') {
        return (
            <div className="space-y-4">
                {renderHeader('My Created Games', 'Active and pending game codes')}

                {loading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                ) : myCodes.length === 0 ? (
                    <Card className="p-8 text-center">
                        <Brain size={32} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No active game codes</p>
                        <p className="text-xs text-slate-500 mt-1">Create a Duel or Leauge match to see it here</p>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {myCodes.map((game: any) => (
                            <Card key={game.id} className="p-4 relative overflow-hidden group">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${game.mode === 'DUEL' ? 'bg-orange-500/20 text-orange-400' : 'bg-violet-500/20 text-violet-400'}`}>
                                                {game.mode}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${game.status === 'WAITING' ? 'bg-amber-500/20 text-amber-400' :
                                                game.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                                                    game.status === 'EXPIRED' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-slate-700 text-slate-400'}`}>
                                                {game.status}
                                            </span>
                                        </div>
                                        <div className="text-sm font-bold text-white mt-1">{game.course}</div>
                                        <div className="text-xs text-slate-500">{game.module} • {game.level}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-mono font-bold text-white tracking-wider">{game.matchCode}</div>
                                        <button onClick={() => copyToClipboard(game.matchCode)} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 justify-end ml-auto mt-1">
                                            {copied ? <Check size={12} /> : <Copy size={12} />} Copy Code
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                                    <div className="flex items-center gap-4 text-xs">
                                        <div className="text-slate-400">
                                            Entry: <span className="text-white font-bold">₦{game.entryAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="text-slate-400">
                                            Players: <span className="text-white font-bold">{game.currentPlayers}/{game.maxPlayers}</span>
                                        </div>
                                    </div>
                                    {game.expiresAt && game.status === 'WAITING' && (
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] text-amber-500 flex items-center gap-1 mr-2">
                                                <Clock size={12} /> {new Date(game.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <Button
                                                onClick={() => cancelMatch(game.id)}
                                                variant="ghost"
                                                className="h-7 px-2 text-[10px] text-red-400 hover:bg-red-500/10 border border-red-500/20"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => continueGame(game)}
                                                className="h-7 px-3 text-xs bg-slate-700 hover:bg-slate-600"
                                            >
                                                <Play size={12} className="mr-1" /> Continue
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        );
    }



    return null;
};
