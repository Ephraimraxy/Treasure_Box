import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// ═══════════════════════════════════════════════
//  QUIZ CONTENT ENDPOINTS
// ═══════════════════════════════════════════════

// Get all courses with modules and levels
router.get('/courses', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const courses = await prisma.quizCourse.findMany({
            where: { isActive: true },
            include: {
                modules: {
                    where: { isActive: true },
                    include: {
                        levels: {
                            orderBy: { level: 'asc' },
                            include: {
                                _count: { select: { questions: true } }
                            }
                        }
                    },
                    orderBy: { name: 'asc' }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(courses);
    } catch (error) {
        next(error);
    }
});

// Get questions for a level (used internally during game start)
async function getRandomQuestions(levelId: string, count: number = 10) {
    const questions = await prisma.quizQuestion.findMany({
        where: { levelId },
        select: {
            id: true,
            question: true,
            optionA: true,
            optionB: true,
            correctOption: true,
            timeLimit: true
        }
    });

    // Shuffle and take `count`
    const shuffled = questions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ═══════════════════════════════════════════════
//  MODE A: SOLO SKILL CHALLENGE
// ═══════════════════════════════════════════════

// Start a solo game
router.post('/solo/start', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { levelId, entryAmount, pin } = req.body;

        if (!levelId || !entryAmount || entryAmount <= 0) {
            return res.status(400).json({ error: 'Level and valid entry amount are required' });
        }

        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (!user) throw new Error('User not found');
            if (user.isSuspended) throw new Error('Account suspended');
            if (user.balance < entryAmount) throw new Error('Insufficient balance');

            // Verify PIN
            if (!user.transactionPin) throw new Error('Transaction PIN not set');
            const isPinValid = await bcrypt.compare(pin, user.transactionPin);
            if (!isPinValid) throw new Error('Invalid PIN');

            // Check level exists and has questions
            const level = await prisma.quizLevel.findUnique({
                where: { id: levelId },
                include: { _count: { select: { questions: true } } }
            });
            if (!level) throw new Error('Level not found');
            if (level._count.questions < 5) throw new Error('Not enough questions in this level');

            // Get random questions (function uses prisma, so we can pass tx prisma if needed, but simpler to keep read outside or just use global prisma for read is 'okay', but for strict consistency use tx. Note: getRandomQuestions is a helper. Let's inline or accept prisma arg?
            // Actually, for questions read it's fine to be outside or global. 
            // But let's keep reads inside if possible for snapshot consistency, though less critical here.
            // Using global prisma inside tx callback is bad practice. We should use `prisma` (tx).
            // I'll reimplement random fetch using `prisma` (tx).

            const questions = await prisma.quizQuestion.findMany({
                where: { levelId },
                select: {
                    id: true,
                    question: true,
                    optionA: true,
                    optionB: true,
                    correctOption: true,
                    timeLimit: true
                }
            });

            // Shuffle
            const shuffled = questions.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 10);

            if (selected.length < 5) throw new Error('Not enough questions available');

            const questionIds = selected.map(q => q.id);

            // Debit user
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { balance: { decrement: entryAmount } }
            });

            // Create transaction
            await prisma.transaction.create({
                data: {
                    userId: req.user!.id,
                    type: 'QUIZ_ENTRY',
                    amount: entryAmount,
                    status: 'SUCCESS',
                    description: `Solo Challenge Entry - ${level.name}`
                }
            });

            // Create game
            const game = await prisma.quizGame.create({
                data: {
                    mode: 'SOLO',
                    levelId,
                    entryAmount,
                    status: 'IN_PROGRESS',
                    maxPlayers: 1,
                    questionIds: questionIds,
                    startedAt: new Date(),
                    participants: {
                        create: {
                            userId: req.user!.id
                        }
                    }
                }
            });

            return { game, questions: selected };
        });

        // Return questions WITHOUT correct answers
        const safeQuestions = result.questions.map(q => ({
            id: q.id,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            timeLimit: q.timeLimit
        }));

        res.json({
            gameId: result.game.id,
            questions: safeQuestions,
            entryAmount,
            winCondition: '100% correct answers to win'
        });
    } catch (error: any) {
        // Map common errors to status codes
        if (error.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Account suspended') return res.status(403).json({ error: error.message });
        if (error.message === 'Insufficient balance') return res.status(400).json({ error: error.message });
        if (error.message === 'Transaction PIN not set') return res.status(400).json({ error: error.message });
        if (error.message === 'Invalid PIN') return res.status(401).json({ error: error.message });
        if (error.message === 'Level not found') return res.status(404).json({ error: error.message });
        next(error);
    }
});

// Submit solo game answers
router.post('/solo/submit', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { gameId, answers, totalTime } = req.body;

        if (!gameId || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: 'Game ID and answers are required' });
        }

        const game = await prisma.quizGame.findUnique({
            where: { id: gameId },
            include: { participants: true }
        });

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Game is not in progress' });

        const participant = game.participants.find(p => p.userId === req.user!.id);
        if (!participant) return res.status(403).json({ error: 'You are not in this game' });
        if (participant.completedAt) return res.status(400).json({ error: 'Already submitted' });

        // Score the answers (Read-only, can be outside transaction or inside. Inside ensures question consistency if valid)
        const questionIds = answers.map((a: any) => a.questionId);
        const questions = await prisma.quizQuestion.findMany({
            where: { id: { in: questionIds } }
        });

        const questionMap = new Map(questions.map(q => [q.id, q]));
        let score = 0;
        const gradedAnswers = answers.map((a: any) => {
            const question = questionMap.get(a.questionId);
            const isCorrect = question?.correctOption === a.answer;
            if (isCorrect) score++;
            return {
                questionId: a.questionId,
                answer: a.answer,
                correct: isCorrect,
                timeTaken: a.timeTaken || 0
            };
        });

        const totalQuestions = answers.length;
        const isPerfect = score === totalQuestions;

        // Transaction for writes
        await prisma.$transaction(async (prisma) => {
            // Re-fetch game/participant status to lock/ensure no double submission race
            const currentParticipant = await prisma.quizParticipant.findUnique({ where: { id: participant.id } });
            if (currentParticipant?.completedAt) throw new Error('Already submitted');

            let payout = 0;
            if (isPerfect) {
                const platformFee = game.entryAmount * 0.1;
                payout = game.entryAmount + (game.entryAmount - platformFee); // capital + 90% profit

                // Credit user
                await prisma.user.update({
                    where: { id: req.user!.id },
                    data: { balance: { increment: payout } }
                });

                // Record winning transaction
                await prisma.transaction.create({
                    data: {
                        userId: req.user!.id,
                        type: 'QUIZ_WINNING',
                        amount: payout,
                        status: 'SUCCESS',
                        description: `Solo Challenge Win - ${score}/${totalQuestions}`
                    }
                });

                // Notification
                await prisma.notification.create({
                    data: {
                        userId: req.user!.id,
                        title: 'Quiz Win! 🎉',
                        message: `Congratulations! Your skill paid off. ₦${payout.toLocaleString()} has been credited to your wallet.`,
                        type: 'SUCCESS'
                    }
                });
            } else {
                // Notification for loss
                await prisma.notification.create({
                    data: {
                        userId: req.user!.id,
                        title: 'Quiz Complete',
                        message: `Good effort! You scored ${score}/${totalQuestions}. Keep practicing and try again.`,
                        type: 'INFO'
                    }
                });
            }

            // Update participant
            await prisma.quizParticipant.update({
                where: { id: participant.id },
                data: {
                    score,
                    totalTime: totalTime || 0,
                    isWinner: isPerfect,
                    payout,
                    answers: gradedAnswers,
                    completedAt: new Date()
                }
            });

            // Complete game
            await prisma.quizGame.update({
                where: { id: gameId },
                data: {
                    status: 'COMPLETED',
                    platformFee: isPerfect ? game.entryAmount * 0.1 : game.entryAmount,
                    prizePool: isPerfect ? payout : 0,
                    endedAt: new Date()
                }
            });
        });

        res.json({
            score,
            totalQuestions,
            isPerfect,
            payout: isPerfect ? (game.entryAmount + (game.entryAmount * 0.9)) : 0, // Recalculate for response or use var if hoisted. 
            // Better to recalculate safely or return strict data.
            // Actually, I can calculte payout outside tx for response.
            entryAmount: game.entryAmount,
            answers: gradedAnswers,
            message: isPerfect
                ? 'Congratulations! Your skill paid off. Your earnings have been credited to your wallet.'
                : 'Good effort! Keep practicing and try again.'
        });
    } catch (error: any) {
        if (error.message === 'Already submitted') return res.status(400).json({ error: error.message });
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  MODE B: DUEL SKILL MATCH
// ═══════════════════════════════════════════════

function generateMatchCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char code
}

// Create a duel match
router.post('/duel/create', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { levelId, entryAmount, pin } = req.body;

        if (!levelId || !entryAmount || entryAmount <= 0) {
            return res.status(400).json({ error: 'Level and valid entry amount are required' });
        }

        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (!user) throw new Error('User not found');
            if (user.isSuspended) throw new Error('Account suspended');
            if (user.balance < entryAmount) throw new Error('Insufficient balance');

            if (!user.transactionPin) throw new Error('Transaction PIN not set');
            const isPinValid = await bcrypt.compare(pin, user.transactionPin);
            if (!isPinValid) throw new Error('Invalid PIN');

            const level = await prisma.quizLevel.findUnique({
                where: { id: levelId },
                include: { _count: { select: { questions: true } } }
            });
            if (!level) throw new Error('Level not found');
            if (level._count.questions < 5) throw new Error('Not enough questions');

            // Get questions
            const questions = await prisma.quizQuestion.findMany({
                where: { levelId },
                select: { id: true, question: true, optionA: true, optionB: true, correctOption: true, timeLimit: true }
            });
            const shuffled = questions.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 10);
            if (selected.length < 5) throw new Error('Not enough questions');
            const questionIds = selected.map(q => q.id);

            // Debit creator
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { balance: { decrement: entryAmount } }
            });
            await prisma.transaction.create({
                data: {
                    userId: req.user!.id,
                    type: 'QUIZ_ENTRY',
                    amount: entryAmount,
                    status: 'SUCCESS',
                    description: `Duel Match Entry - ${level.name}`
                }
            });

            // Create game with match code
            const matchCode = generateMatchCode();
            const game = await prisma.quizGame.create({
                data: {
                    mode: 'DUEL',
                    levelId,
                    entryAmount,
                    status: 'WAITING',
                    matchCode,
                    maxPlayers: 2,
                    questionIds,
                    participants: {
                        create: { userId: req.user!.id }
                    }
                }
            });
            return { game, matchCode };
        });

        res.json({
            gameId: result.game.id,
            matchCode: result.matchCode,
            entryAmount,
            message: 'Share the match code with your opponent'
        });
    } catch (error: any) {
        if (error.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Account suspended') return res.status(403).json({ error: error.message });
        if (error.message === 'Insufficient balance') return res.status(400).json({ error: error.message });
        if (error.message === 'Transaction PIN not set') return res.status(400).json({ error: error.message });
        if (error.message === 'Invalid PIN') return res.status(401).json({ error: error.message });
        if (error.message === 'Level not found') return res.status(404).json({ error: error.message });
        next(error);
    }
});

// Join a duel match
router.post('/duel/join', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { matchCode, pin } = req.body;

        if (!matchCode) return res.status(400).json({ error: 'Match code is required' });

        const result = await prisma.$transaction(async (prisma) => {
            // Lock/Fetch game state inside tx
            const game = await prisma.quizGame.findUnique({
                where: { matchCode: matchCode.toUpperCase() },
                include: { participants: true, level: true }
            });

            if (!game) throw new Error('Match not found');
            if (game.status !== 'WAITING') throw new Error('Match is no longer available');
            if (game.participants.length >= 2) throw new Error('Match is full');
            if (game.participants.some(p => p.userId === req.user!.id)) {
                throw new Error('You are already in this match');
            }

            const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (!user) throw new Error('User not found');
            if (user.isSuspended) throw new Error('Account suspended');
            if (user.balance < game.entryAmount) throw new Error('Insufficient balance');

            if (!user.transactionPin) throw new Error('Transaction PIN not set');
            const isPinValid = await bcrypt.compare(pin, user.transactionPin);
            if (!isPinValid) throw new Error('Invalid PIN');

            // Debit joiner
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { balance: { decrement: game.entryAmount } }
            });
            await prisma.transaction.create({
                data: {
                    userId: req.user!.id,
                    type: 'QUIZ_ENTRY',
                    amount: game.entryAmount,
                    status: 'SUCCESS',
                    description: `Duel Match Entry - ${game.level.name}`
                }
            });

            // Add participant and start game
            await prisma.quizParticipant.create({
                data: { gameId: game.id, userId: req.user!.id }
            });
            await prisma.quizGame.update({
                where: { id: game.id },
                data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });

            // Return questions for response
            const questionIds = game.questionIds as string[];
            const questions = await prisma.quizQuestion.findMany({
                where: { id: { in: questionIds } },
                select: { id: true, question: true, optionA: true, optionB: true, timeLimit: true }
            });

            return { game, questions };
        });

        res.json({
            gameId: result.game.id,
            questions: result.questions,
            entryAmount: result.game.entryAmount,
            message: 'Match started!'
        });
    } catch (error: any) {
        if (error.message === 'Match not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Match is no longer available') return res.status(400).json({ error: error.message });
        if (error.message === 'Match is full') return res.status(400).json({ error: error.message });
        if (error.message === 'You are already in this match') return res.status(400).json({ error: error.message });
        if (error.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Account suspended') return res.status(403).json({ error: error.message });
        if (error.message === 'Insufficient balance') return res.status(400).json({ error: error.message });
        if (error.message === 'Transaction PIN not set') return res.status(400).json({ error: error.message });
        if (error.message === 'Invalid PIN') return res.status(401).json({ error: error.message });
        next(error);
    }
});

// Submit duel answers
router.post('/duel/submit', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { gameId, answers, totalTime } = req.body;

        if (!gameId || !answers) return res.status(400).json({ error: 'Game ID and answers required' });

        const game = await prisma.quizGame.findUnique({
            where: { id: gameId },
            include: { participants: true }
        });

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.mode !== 'DUEL') return res.status(400).json({ error: 'Not a duel game' });

        const participant = game.participants.find(p => p.userId === req.user!.id);
        if (!participant) return res.status(403).json({ error: 'Not in this game' });
        if (participant.completedAt) return res.status(400).json({ error: 'Already submitted' });

        // Grade answers
        const questionIds = answers.map((a: any) => a.questionId);
        const questions = await prisma.quizQuestion.findMany({
            where: { id: { in: questionIds } }
        });
        const questionMap = new Map(questions.map(q => [q.id, q]));

        let score = 0;
        const gradedAnswers = answers.map((a: any) => {
            const q = questionMap.get(a.questionId);
            const correct = q?.correctOption === a.answer;
            if (correct) score++;
            return { questionId: a.questionId, answer: a.answer, correct, timeTaken: a.timeTaken || 0 };
        });

        const result = await prisma.$transaction(async (prisma) => {
            // Lock Game Row to serialize payout logic checks
            await prisma.quizGame.update({
                where: { id: gameId },
                data: { updatedAt: new Date() }
            });

            // Re-check participant status inside tx
            const currentParticipant = await prisma.quizParticipant.findUnique({ where: { id: participant.id } });
            if (currentParticipant?.completedAt) throw new Error('Already submitted');

            // Update participant
            await prisma.quizParticipant.update({
                where: { id: participant.id },
                data: { score, totalTime: totalTime || 0, answers: gradedAnswers, completedAt: new Date() }
            });

            // Check if both players have submitted
            const updatedGame = await prisma.quizGame.findUnique({
                where: { id: gameId },
                include: { participants: true }
            });

            const allDone = updatedGame!.participants.every(p => p.completedAt !== null);

            if (allDone) {
                // Determine winner
                const players = updatedGame!.participants.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.totalTime - b.totalTime; // faster wins on tie
                });

                const totalPool = game.entryAmount * 2;
                const platformFee = totalPool * 0.1;
                const remainingPool = totalPool - platformFee;

                const isTie = players[0].score === players[1].score &&
                    Math.abs(players[0].totalTime - players[1].totalTime) < 0.5;

                if (isTie) {
                    // Split equally
                    const splitAmount = remainingPool / 2;
                    for (const p of players) {
                        await prisma.quizParticipant.update({
                            where: { id: p.id },
                            data: { payout: splitAmount }
                        });
                        await prisma.user.update({
                            where: { id: p.userId },
                            data: { balance: { increment: splitAmount } }
                        });
                        await prisma.transaction.create({
                            data: {
                                userId: p.userId,
                                type: 'QUIZ_WINNING',
                                amount: splitAmount,
                                status: 'SUCCESS',
                                description: `Duel Match Tie - Split Payout`
                            }
                        });
                        await prisma.notification.create({
                            data: {
                                userId: p.userId,
                                title: 'Duel Draw! 🤝',
                                message: `It's a tie! ₦${splitAmount.toLocaleString()} credited to your wallet.`,
                                type: 'SUCCESS'
                            }
                        });
                    }
                } else {
                    // Winner takes all (minus platform fee)
                    const winner = players[0];
                    const loser = players[1];

                    await prisma.quizParticipant.update({
                        where: { id: winner.id },
                        data: { isWinner: true, payout: remainingPool }
                    });
                    await prisma.user.update({
                        where: { id: winner.userId },
                        data: { balance: { increment: remainingPool } }
                    });
                    await prisma.transaction.create({
                        data: {
                            userId: winner.userId,
                            type: 'QUIZ_WINNING',
                            amount: remainingPool,
                            status: 'SUCCESS',
                            description: `Duel Match Win - Score: ${winner.score}`
                        }
                    });
                    await prisma.notification.create({
                        data: {
                            userId: winner.userId,
                            title: 'Duel Win! 🎉',
                            message: `You won! ₦${remainingPool.toLocaleString()} credited to your wallet.`,
                            type: 'SUCCESS'
                        }
                    });
                    await prisma.notification.create({
                        data: {
                            userId: loser.userId,
                            title: 'Duel Complete',
                            message: `Good effort! Score: ${loser.score}. Keep practicing!`,
                            type: 'INFO'
                        }
                    });
                }

                await prisma.quizGame.update({
                    where: { id: gameId },
                    data: { status: 'COMPLETED', platformFee, prizePool: remainingPool, endedAt: new Date() }
                });
            }

            return { allDone, score, totalQuestions: answers.length };
        });

        res.json({
            score,
            totalQuestions: result.totalQuestions,
            submitted: true,
            gameComplete: result.allDone,
            message: result.allDone ? 'Match complete! Check your results.' : 'Answers submitted. Waiting for opponent.'
        });
    } catch (error: any) {
        if (error.message === 'Already submitted') return res.status(400).json({ error: error.message });
        next(error);
    }
});

// Get duel status (for polling)
router.get('/duel/:gameId/status', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const game = await prisma.quizGame.findUnique({
            where: { id: req.params.gameId },
            include: {
                participants: {
                    include: { user: { select: { id: true, username: true, name: true } } }
                }
            }
        });
        if (!game) return res.status(404).json({ error: 'Game not found' });

        const isParticipant = game.participants.some(p => p.userId === req.user!.id);
        if (!isParticipant) return res.status(403).json({ error: 'Not in this game' });

        res.json({
            status: game.status,
            playerCount: game.participants.length,
            participants: game.participants.map(p => ({
                userId: p.userId,
                username: p.user.username || p.user.name,
                score: game.status === 'COMPLETED' ? p.score : undefined,
                isWinner: game.status === 'COMPLETED' ? p.isWinner : undefined,
                payout: game.status === 'COMPLETED' ? p.payout : undefined,
                completed: !!p.completedAt
            }))
        });
    } catch (error) {
        next(error);
    }
});


// ═══════════════════════════════════════════════
//  MODE C: LEAGUE SKILL ARENA
// ═══════════════════════════════════════════════

// Create a league
router.post('/league/create', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { levelId, entryAmount, maxPlayers, pin } = req.body;

        if (!levelId || !entryAmount || !maxPlayers || entryAmount <= 0) {
            return res.status(400).json({ error: 'Level, entry amount, and max players are required' });
        }
        if (maxPlayers < 3 || maxPlayers > 50) {
            return res.status(400).json({ error: 'Players must be between 3 and 50' });
        }

        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (!user) throw new Error('User not found');
            if (user.isSuspended) throw new Error('Account suspended');
            if (user.balance < entryAmount) throw new Error('Insufficient balance');

            if (!user.transactionPin) throw new Error('Transaction PIN not set');
            const isPinValid = await bcrypt.compare(pin, user.transactionPin);
            if (!isPinValid) throw new Error('Invalid PIN');

            const level = await prisma.quizLevel.findUnique({
                where: { id: levelId },
                include: { _count: { select: { questions: true } } }
            });
            if (!level) throw new Error('Level not found');
            if (level._count.questions < 5) throw new Error('Not enough questions');

            // Get questions
            const questions = await prisma.quizQuestion.findMany({
                where: { levelId },
                select: { id: true, question: true, optionA: true, optionB: true, correctOption: true, timeLimit: true }
            });
            const shuffled = questions.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 15);
            if (selected.length < 5) throw new Error('Not enough questions');
            const questionIds = selected.map(q => q.id);

            // Debit creator
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { balance: { decrement: entryAmount } }
            });
            await prisma.transaction.create({
                data: {
                    userId: req.user!.id,
                    type: 'QUIZ_ENTRY',
                    amount: entryAmount,
                    status: 'SUCCESS',
                    description: `League Arena Entry - ${level.name}`
                }
            });

            const matchCode = generateMatchCode();
            const game = await prisma.quizGame.create({
                data: {
                    mode: 'LEAGUE',
                    levelId,
                    entryAmount,
                    status: 'WAITING',
                    matchCode,
                    maxPlayers,
                    questionIds,
                    participants: {
                        create: { userId: req.user!.id }
                    }
                }
            });

            return { game, matchCode };
        });

        res.json({
            gameId: result.game.id,
            matchCode: result.matchCode,
            entryAmount,
            maxPlayers,
            currentPlayers: 1,
            message: 'League created! Share the code for others to join.'
        });
    } catch (error: any) {
        if (error.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Account suspended') return res.status(403).json({ error: error.message });
        if (error.message === 'Insufficient balance') return res.status(400).json({ error: error.message });
        if (error.message === 'Transaction PIN not set') return res.status(400).json({ error: error.message });
        if (error.message === 'Invalid PIN') return res.status(401).json({ error: error.message });
        if (error.message === 'Level not found') return res.status(404).json({ error: error.message });
        next(error);
    }
});

// Join a league
router.post('/league/join', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { matchCode, pin } = req.body;

        if (!matchCode) return res.status(400).json({ error: 'Match code is required' });

        const result = await prisma.$transaction(async (prisma) => {
            const game = await prisma.quizGame.findUnique({
                where: { matchCode: matchCode.toUpperCase() },
                include: { participants: true, level: true }
            });

            if (!game) throw new Error('League not found');
            if (game.mode !== 'LEAGUE') throw new Error('Not a league game');
            if (game.status !== 'WAITING') throw new Error('League is no longer accepting players');
            if (game.participants.length >= game.maxPlayers) throw new Error('League is full');
            if (game.participants.some(p => p.userId === req.user!.id)) {
                throw new Error('Already in this league');
            }

            const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (!user) throw new Error('User not found');
            if (user.isSuspended) throw new Error('Account suspended');
            if (user.balance < game.entryAmount) throw new Error('Insufficient balance');

            if (!user.transactionPin) throw new Error('Transaction PIN not set');
            const isPinValid = await bcrypt.compare(pin, user.transactionPin);
            if (!isPinValid) throw new Error('Invalid PIN');

            // Debit
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { balance: { decrement: game.entryAmount } }
            });
            await prisma.transaction.create({
                data: {
                    userId: req.user!.id,
                    type: 'QUIZ_ENTRY',
                    amount: game.entryAmount,
                    status: 'SUCCESS',
                    description: `League Arena Entry - ${game.level.name}`
                }
            });

            await prisma.quizParticipant.create({
                data: { gameId: game.id, userId: req.user!.id }
            });

            const updatedGame = await prisma.quizGame.findUnique({
                where: { id: game.id },
                include: { participants: true }
            });

            return { game, updatedGame };
        });

        res.json({
            gameId: result.game.id,
            currentPlayers: result.updatedGame!.participants.length,
            maxPlayers: result.game.maxPlayers,
            message: `Joined league! ${result.updatedGame!.participants.length}/${result.game.maxPlayers} players`
        });
    } catch (error: any) {
        if (error.message === 'League not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Not a league game') return res.status(400).json({ error: error.message });
        if (error.message === 'League is no longer accepting players') return res.status(400).json({ error: error.message });
        if (error.message === 'League is full') return res.status(400).json({ error: error.message });
        if (error.message === 'Already in this league') return res.status(400).json({ error: error.message });
        if (error.message === 'User not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Account suspended') return res.status(403).json({ error: error.message });
        if (error.message === 'Insufficient balance') return res.status(400).json({ error: error.message });
        if (error.message === 'Transaction PIN not set') return res.status(400).json({ error: error.message });
        if (error.message === 'Invalid PIN') return res.status(401).json({ error: error.message });
        next(error);
    }
});

// Start league (creator only, when enough players)
router.post('/league/start', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { gameId } = req.body;

        const game = await prisma.quizGame.findUnique({
            where: { id: gameId },
            include: { participants: true }
        });

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.status !== 'WAITING') return res.status(400).json({ error: 'Game already started' });

        // Only creator (first participant) can start
        const creator = game.participants.sort((a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime()
        )[0];
        if (creator.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Only the creator can start the league' });
        }
        if (game.participants.length < 3) {
            return res.status(400).json({ error: 'Need at least 3 players to start' });
        }

        await prisma.quizGame.update({
            where: { id: gameId },
            data: { status: 'IN_PROGRESS', startedAt: new Date() }
        });

        // Return questions
        const questionIds = game.questionIds as string[];
        const questions = await prisma.quizQuestion.findMany({
            where: { id: { in: questionIds } },
            select: { id: true, question: true, optionA: true, optionB: true, timeLimit: true }
        });

        res.json({
            gameId: game.id,
            questions,
            playerCount: game.participants.length,
            message: 'League started!'
        });
    } catch (error) {
        next(error);
    }
});

// Submit league answers
router.post('/league/submit', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { gameId, answers, totalTime } = req.body;

        if (!gameId || !answers) return res.status(400).json({ error: 'Game ID and answers required' });

        const game = await prisma.quizGame.findUnique({
            where: { id: gameId },
            include: { participants: true }
        });

        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (game.mode !== 'LEAGUE') return res.status(400).json({ error: 'Not a league game' });

        const participant = game.participants.find(p => p.userId === req.user!.id);
        if (!participant) return res.status(403).json({ error: 'Not in this game' });
        if (participant.completedAt) return res.status(400).json({ error: 'Already submitted' });

        // Grade
        const questionIds = answers.map((a: any) => a.questionId);
        const questions = await prisma.quizQuestion.findMany({
            where: { id: { in: questionIds } }
        });
        const qMap = new Map(questions.map(q => [q.id, q]));

        let score = 0;
        const graded = answers.map((a: any) => {
            const q = qMap.get(a.questionId);
            const correct = q?.correctOption === a.answer;
            if (correct) score++;
            return { questionId: a.questionId, answer: a.answer, correct, timeTaken: a.timeTaken || 0 };
        });

        const result = await prisma.$transaction(async (prisma) => {
            // Lock Game
            await prisma.quizGame.update({
                where: { id: gameId },
                data: { updatedAt: new Date() }
            });

            // Re-check
            const currentParticipant = await prisma.quizParticipant.findUnique({ where: { id: participant.id } });
            if (currentParticipant?.completedAt) throw new Error('Already submitted');

            // Update participant
            await prisma.quizParticipant.update({
                where: { id: participant.id },
                data: { score, totalTime: totalTime || 0, answers: graded, completedAt: new Date() }
            });

            // Check if all done
            const refreshedGame = await prisma.quizGame.findUnique({
                where: { id: gameId },
                include: { participants: true }
            });
            const allDone = refreshedGame!.participants.every(p => p.completedAt !== null);

            if (allDone) {
                const players = refreshedGame!.participants.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.totalTime - b.totalTime;
                });

                const totalPool = game.entryAmount * players.length;
                const platformFee = totalPool * 0.1;
                const remainingPool = totalPool - platformFee;

                // Bracket payouts: 45%, 25%, 15%, 15% for top 4
                const brackets = [0.45, 0.25, 0.15, 0.15];
                const payoutSlots = Math.min(4, players.length);

                for (let i = 0; i < players.length; i++) {
                    let payout = 0;

                    if (i < payoutSlots) {
                        payout = remainingPool * brackets[i];

                        // Handle ties within same bracket
                        let tieStart = i;
                        let tieEnd = i;
                        while (tieEnd + 1 < payoutSlots &&
                            players[tieEnd + 1].score === players[i].score &&
                            Math.abs(players[tieEnd + 1].totalTime - players[i].totalTime) < 0.5) {
                            tieEnd++;
                        }

                        if (tieEnd > tieStart) {
                            // Split tied brackets equally
                            let totalBracketPayout = 0;
                            for (let j = tieStart; j <= tieEnd && j < payoutSlots; j++) {
                                totalBracketPayout += remainingPool * brackets[j];
                            }
                            payout = totalBracketPayout / (tieEnd - tieStart + 1);
                            // Skip ahead past tied players (outer loop will increment, need to adjust)
                            // Actually, clean way is to process ties as a group.
                            // But here I'm iterating linear.
                            // If I am at `i` and `tieEnd > i`, I calculate payout for ONE of them and apply to all?
                            // No, I need to apply to `i`. Next iteration needs to know it's part of tie?
                            // My previous logic was: `payout = ...`. And `i = tieEnd` at end of loop?
                            // Let's fix loop logic.
                        }
                    }

                    // RE-EVALUATING TIE LOGIC FOR ATOMICITY
                    // If i is start of tie group, calculate payout for group.
                    // Assign to players[i...tieEnd].
                    // Advance i to tieEnd.

                    let actualPayout = 0;
                    if (i < payoutSlots) {
                        let tieEnd = i;
                        while (tieEnd + 1 < players.length && // potentially all players tied
                            players[tieEnd + 1].score === players[i].score &&
                            Math.abs(players[tieEnd + 1].totalTime - players[i].totalTime) < 0.5) {
                            tieEnd++;
                        }

                        if (tieEnd > i) {
                            // Valid tie group starting at i
                            let groupTotalPayout = 0;
                            // Sum up brackets covered by this group, limited by payoutSlots
                            for (let j = i; j <= tieEnd; j++) {
                                if (j < payoutSlots) {
                                    groupTotalPayout += remainingPool * brackets[j];
                                }
                            }
                            actualPayout = groupTotalPayout / (tieEnd - i + 1);

                            // Apply to all in group
                            for (let k = i; k <= tieEnd; k++) {
                                await prisma.quizParticipant.update({
                                    where: { id: players[k].id },
                                    data: { isWinner: actualPayout > 0, payout: actualPayout }
                                });
                                if (actualPayout > 0) {
                                    await prisma.user.update({
                                        where: { id: players[k].userId },
                                        data: { balance: { increment: actualPayout } }
                                    });
                                    await prisma.transaction.create({
                                        data: {
                                            userId: players[k].userId,
                                            type: 'QUIZ_WINNING',
                                            amount: actualPayout,
                                            status: 'SUCCESS',
                                            description: `League Arena - Rank #${i + 1} (Tie)`
                                        }
                                    });
                                    await prisma.notification.create({
                                        data: {
                                            userId: players[k].userId,
                                            title: `League Rank #${i + 1}! 🏆`,
                                            message: `You tied for rank #${i + 1}! ₦${actualPayout.toLocaleString()} credited.`,
                                            type: 'SUCCESS'
                                        }
                                    });
                                } else {
                                    await prisma.notification.create({
                                        data: {
                                            userId: players[k].userId,
                                            title: 'League Complete',
                                            message: `You placed #${k + 1}. Better luck next time!`,
                                            type: 'INFO'
                                        }
                                    });
                                }
                            }
                            i = tieEnd; // Skip processed players
                            continue;
                        } else {
                            // No tie, simple payout
                            actualPayout = remainingPool * brackets[i];
                        }
                    }

                    // Single player processing (no tie, or simple logic if not handled above? Above handles all ties)
                    // If we are here, it's not a tie group (or tieEnd == i)

                    await prisma.quizParticipant.update({
                        where: { id: players[i].id },
                        data: { isWinner: actualPayout > 0, payout: actualPayout }
                    });

                    if (actualPayout > 0) {
                        await prisma.user.update({
                            where: { id: players[i].userId },
                            data: { balance: { increment: actualPayout } }
                        });
                        await prisma.transaction.create({
                            data: {
                                userId: players[i].userId,
                                type: 'QUIZ_WINNING',
                                amount: actualPayout,
                                status: 'SUCCESS',
                                description: `League Arena - Rank #${i + 1}`
                            }
                        });
                        await prisma.notification.create({
                            data: {
                                userId: players[i].userId,
                                title: `League Rank #${i + 1}! 🏆`,
                                message: `You placed #${i + 1}! ₦${actualPayout.toLocaleString()} credited.`,
                                type: 'SUCCESS'
                            }
                        });
                    } else {
                        await prisma.notification.create({
                            data: {
                                userId: players[i].userId,
                                title: 'League Complete',
                                message: `You placed #${i + 1}. Better luck next time!`,
                                type: 'INFO'
                            }
                        });
                    }
                }

                await prisma.quizGame.update({
                    where: { id: gameId },
                    data: { status: 'COMPLETED', platformFee, prizePool: remainingPool, endedAt: new Date() }
                });
            }

            return { allDone, score, totalQuestions: answers.length };
        });

        res.json({
            score,
            totalQuestions: result.totalQuestions,
            submitted: true,
            gameComplete: result.allDone,
            message: result.allDone ? 'League complete! Check results.' : 'Submitted! Waiting for other players.'
        });
    } catch (error: any) {
        if (error.message === 'Already submitted') return res.status(400).json({ error: error.message });
        next(error);
    }
});

// Get league status (for polling)
router.get('/league/:gameId/status', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const game = await prisma.quizGame.findUnique({
            where: { id: req.params.gameId },
            include: {
                participants: {
                    include: { user: { select: { id: true, username: true, name: true } } },
                    orderBy: [{ score: 'desc' }, { totalTime: 'asc' }]
                }
            }
        });
        if (!game) return res.status(404).json({ error: 'Game not found' });

        res.json({
            status: game.status,
            playerCount: game.participants.length,
            maxPlayers: game.maxPlayers,
            participants: game.participants.map((p, i) => ({
                userId: p.userId,
                username: p.user.username || p.user.name,
                rank: game.status === 'COMPLETED' ? i + 1 : undefined,
                score: game.status === 'COMPLETED' ? p.score : undefined,
                isWinner: game.status === 'COMPLETED' ? p.isWinner : undefined,
                payout: game.status === 'COMPLETED' ? p.payout : undefined,
                completed: !!p.completedAt
            }))
        });
    } catch (error) {
        next(error);
    }
});


// ═══════════════════════════════════════════════
//  GAME HISTORY
// ═══════════════════════════════════════════════

router.get('/history', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [games, total] = await Promise.all([
            prisma.quizParticipant.findMany({
                where: { userId: req.user!.id },
                include: {
                    game: {
                        include: {
                            level: {
                                include: {
                                    module: {
                                        include: { course: true }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.quizParticipant.count({ where: { userId: req.user!.id } })
        ]);

        res.json({
            data: games.map(p => ({
                id: p.id,
                gameId: p.gameId,
                mode: p.game.mode,
                course: p.game.level.module.course.name,
                module: p.game.level.module.name,
                level: p.game.level.name,
                entryAmount: p.game.entryAmount,
                score: p.score,
                isWinner: p.isWinner,
                payout: p.payout,
                status: p.game.status,
                playedAt: p.createdAt
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
