import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function main() {
    console.log('🚀 Starting Quiz Economy Smoke Test...');

    try {
        // 1. Setup Test User
        const email = `test_quiz_${Date.now()}@example.com`;
        const password = 'password123';
        const pin = '1234';
        const hashedPin = await bcrypt.hash(pin, 10);

        console.log(`👤 Creating test user: ${email}`);
        const user = await prisma.user.create({
            data: {
                email,
                password: await bcrypt.hash(password, 10),
                name: 'Test User',
                transactionPin: hashedPin,
                balance: 5000, // Fund wallet directly
                emailVerified: true
            }
        });

        // 2. Login to get Token
        console.log('🔑 Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        // 3. Get Courses & Level
        console.log('📚 Fetching courses...');
        const coursesRes = await axios.get(`${API_URL}/quiz/courses`, { headers });
        const levelId = coursesRes.data[0].modules[0].levels[0].id;
        console.log(`   Selected Level ID: ${levelId}`);

        // 4. Start Solo Game
        const entryAmount = 100;
        console.log(`🎮 Starting Solo Game (Entry: ₦${entryAmount})...`);
        const startRes = await axios.post(`${API_URL}/quiz/solo/start`, {
            levelId,
            entryAmount,
            pin
        }, { headers });

        const gameId = startRes.data.gameId;
        const questions = startRes.data.questions;
        console.log(`   Game Started! ID: ${gameId}`);
        console.log(`   Questions received: ${questions.length}`);

        // 5. Submit Perfect Score
        console.log('📝 Submitting perfect answers...');
        // We cheat by looking up correct answers in DB or just guessing if we can't? 
        // Actually, for the smoke test to pass 100%, we need to know the answers.
        // Since we have DB access, we can fetch them.

        const questionIds = questions.map((q: any) => q.id);
        const dbQuestions = await prisma.quizQuestion.findMany({
            where: { id: { in: questionIds } }
        });
        const qMap = new Map(dbQuestions.map(q => [q.id, q.correctOption]));

        const answers = questions.map((q: any) => ({
            questionId: q.id,
            answer: qMap.get(q.id),
            timeTaken: 2
        }));

        const submitRes = await axios.post(`${API_URL}/quiz/solo/submit`, {
            gameId,
            answers,
            totalTime: 20
        }, { headers });

        console.log('🏆 Submission Result:', submitRes.data.message);
        console.log(`   Score: ${submitRes.data.score}/${submitRes.data.totalQuestions}`);
        console.log(`   Payout: ₦${submitRes.data.payout}`);

        // 6. Verify Wallet Balance
        const userAfter = await prisma.user.findUnique({ where: { id: user.id } });
        console.log(`💰 Final Balance: ₦${userAfter?.balance} (Started with 5000, paid 100, won 190. Expected: 5090)`);

        if (Math.abs((userAfter?.balance || 0) - 5090) < 0.01) {
            console.log('✅ TEST PASSED: Balance calculation is correct.');
        } else {
            console.error('❌ TEST FAILED: Balance incorrect.');
        }

    } catch (error: any) {
        console.error('❌ Test Failed:', error.response?.data || error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
