import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const CURRICULUM = [
    {
        name: 'Faculty of Law',
        description: 'Comprehensive study of legal systems, jurisprudence, and Nigerian Law.',
        icon: '⚖️',
        modules: [
            { name: 'Jurisprudence & Legal Theory', description: 'Theoretical study of law.' },
            { name: 'Criminal Law', description: 'Laws relating to crime and punishment.' },
            { name: 'Constitutional Law', description: 'The basic principles and laws of a state.' },
            { name: 'Commercial Law', description: 'Laws governing business transactions.' }
        ]
    },
    {
        name: 'Faculty of Health Sciences',
        description: 'Medicine, Pharmacy, Nursing, and Medical Laboratory Sciences.',
        icon: '🏥',
        modules: [
            { name: 'Human Anatomy', description: 'Study of the structure of the human body.' },
            { name: 'Medical Biochemistry', description: 'Chemical processes within and relating to living organisms.' },
            { name: 'Physiology', description: 'Biological study of the functions of living organisms.' },
            { name: 'Pharmacology', description: 'Study of drug action.' }
        ]
    },
    {
        name: 'Faculty of Engineering',
        description: 'Civil, Mechanical, Electrical, and Computer Engineering.',
        icon: '⚙️',
        modules: [
            { name: 'Civil Engineering', description: 'Designing and building infrastructure.' },
            { name: 'Mechanical Engineering', description: 'Design, analysis, and manufacturing of mechanical systems.' },
            { name: 'Electrical/Electronic Engineering', description: 'Electricity, electronics, and electromagnetism.' },
            { name: 'Chemical Engineering', description: 'Converting raw materials into useful products.' }
        ]
    },
    {
        name: 'Faculty of Arts',
        description: 'Languages, Linguistics, History, and Creative Arts.',
        icon: '🎭',
        modules: [
            { name: 'History & International Studies', description: 'World history and diplomatic relations.' },
            { name: 'English & Literary Studies', description: 'Language and literature analysis.' },
            { name: 'Linguistics', description: 'Scientific study of language.' },
            { name: 'Philosophy', description: 'Fundamental nature of knowledge, reality, and existence.' }
        ]
    },
    {
        name: 'Faculty of Social Sciences',
        description: 'Economics, Political Science, Sociology, and Geography.',
        icon: '🌍',
        modules: [
            { name: 'Economics', description: 'Production, distribution, and consumption of goods and services.' },
            { name: 'Political Science', description: 'Systems of government and analysis of political activities.' },
            { name: 'Sociology & Anthropology', description: 'Study of society and human behavior.' },
            { name: 'Geography', description: 'Study of places and the relationships between people and their environments.' }
        ]
    },
    {
        name: 'Faculty of Science',
        description: 'Biological Sciences, Chemistry, Physics, and Mathematics.',
        icon: '🧪',
        modules: [
            { name: 'Computer Science', description: 'Theory, experimentation, and engineering that form the basis for the design and use of computers.' },
            { name: 'Microbiology', description: 'Study of microscopic organisms.' },
            { name: 'Biochemistry', description: 'Chemical processes within and relating to living organisms.' },
            { name: 'Mathematics & Statistics', description: 'Logic of shape, quantity, and arrangement.' }
        ]
    }
];

async function main() {
    console.log('🌱 Starting Nigerian Tertiary Curriculum seeding...');

    for (const facultyData of CURRICULUM) {
        const course = await prisma.quizCourse.upsert({
            where: { name: facultyData.name },
            update: {
                description: facultyData.description,
                icon: facultyData.icon,
                isActive: true
            },
            create: {
                name: facultyData.name,
                description: facultyData.description,
                icon: facultyData.icon,
                isActive: true
            }
        });

        console.log(`  - Faculty: ${course.name}`);

        for (const moduleData of facultyData.modules) {
            const module = await prisma.quizModule.upsert({
                where: {
                    courseId_name: {
                        courseId: course.id,
                        name: moduleData.name
                    }
                },
                update: {
                    description: moduleData.description,
                    isActive: true
                },
                create: {
                    courseId: course.id,
                    name: moduleData.name,
                    description: moduleData.description,
                    isActive: true
                }
            });

            console.log(`    - Department: ${module.name}`);

            // Create 3 levels for each module
            const levels = [
                { level: 1, name: '100 Level' },
                { level: 2, name: '200 Level' },
                { level: 3, name: '300-400 Level' }
            ];

            for (const levelData of levels) {
                await prisma.quizLevel.upsert({
                    where: {
                        moduleId_level: {
                            moduleId: module.id,
                            level: levelData.level
                        }
                    },
                    update: {
                        name: levelData.name
                    },
                    create: {
                        moduleId: module.id,
                        level: levelData.level,
                        name: levelData.name
                    }
                });
            }
        }
    }

    console.log('✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
