import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QuestionSeed {
    question: string;
    optionA: string;
    optionB: string;
    correctOption: string;
}

interface LevelSeed {
    level: number;
    name: string;
    questions: QuestionSeed[];
}

interface ModuleSeed {
    name: string;
    description: string;
    levels: LevelSeed[];
}

interface CourseSeed {
    name: string;
    description: string;
    icon: string;
    modules: ModuleSeed[];
}

const QUIZ_DATA: CourseSeed[] = [
    {
        name: 'General Knowledge',
        description: 'Test your knowledge on various topics',
        icon: '🧠',
        modules: [
            {
                name: 'Nigerian Facts',
                description: 'Facts about Nigeria',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'Nigeria is the most populous country in Africa.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The capital of Nigeria is Lagos.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Nigeria gained independence in 1960.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Nigerian flag has three colors.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Nigeria has 36 states and 1 FCT.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Naira is Nigeria\'s official currency.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria is located in East Africa.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Nigeria is a member of OPEC.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'What is the largest city in Nigeria?', optionA: 'Lagos', optionB: 'Abuja', correctOption: 'A' },
                            { question: 'Nigeria shares a border with Cameroon.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Niger River is the longest river in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria has more than 500 ethnic groups.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                        ]
                    },
                    {
                        level: 2,
                        name: 'Intermediate',
                        questions: [
                            { question: 'Who designed the Nigerian flag?', optionA: 'Michael Taiwo Akinkunmi', optionB: 'Nnamdi Azikiwe', correctOption: 'A' },
                            { question: 'Nigeria\'s first president was Nnamdi Azikiwe.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Nigerian Civil War lasted from 1967 to?', optionA: '1970', optionB: '1972', correctOption: 'A' },
                            { question: 'Which state is known as the "Centre of Excellence"?', optionA: 'Lagos', optionB: 'Abuja', correctOption: 'A' },
                            { question: 'The National Assembly is located in Abuja.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Yankari Game Reserve is in which state?', optionA: 'Bauchi', optionB: 'Plateau', correctOption: 'A' },
                            { question: 'Nigeria is the largest oil producer in Africa.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The first Nigerian Nobel laureate is Chinua Achebe.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Zuma Rock is located near which city?', optionA: 'Abuja', optionB: 'Lagos', correctOption: 'A' },
                            { question: 'The longest bridge in Nigeria is the Third Mainland Bridge.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    },
                    {
                        level: 3,
                        name: 'Advanced',
                        questions: [
                            { question: 'Nigeria\'s GDP makes it the largest economy in Africa.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Benin Bronze sculptures originated from Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nollywood produces more films annually than Hollywood.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The first university in Nigeria was established in 1948.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria\'s constitution was last amended in 2011.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The Central Bank of Nigeria was established in 1958.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Nigeria is the 7th most populous country in the world.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The Ogoni people are primarily found in Rivers State.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria has hosted the FIFA U-17 World Cup.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Lake Chad borders Nigeria to the northeast.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            },
            {
                name: 'World Geography',
                description: 'Countries, capitals, and landmarks',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'The Earth has 7 continents.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Australia is both a country and a continent.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Amazon River is in Africa.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Mount Everest is the tallest mountain on Earth.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Sahara is the largest desert in the world.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Russia is the largest country by area.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Pacific Ocean is the largest ocean.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Japan is in which continent?', optionA: 'Asia', optionB: 'Europe', correctOption: 'A' },
                            { question: 'Brazil is the largest country in South America.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Nile is the longest river in the world.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'Science & Technology',
        description: 'Explore scientific facts and tech knowledge',
        icon: '🔬',
        modules: [
            {
                name: 'Basic Science',
                description: 'Fundamental scientific concepts',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'Water boils at 100°C at sea level.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The chemical symbol for Gold is Au.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Humans have 206 bones in their body.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Sun is a planet.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Sound travels faster than light.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'DNA stands for Deoxyribonucleic Acid.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Oxygen is the most abundant element in Earth\'s crust.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The heart has 4 chambers.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Electrons are larger than atoms.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Plants produce oxygen through photosynthesis.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    },
                    {
                        level: 2,
                        name: 'Intermediate',
                        questions: [
                            { question: 'The speed of light is approximately 300,000 km/s.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Mitochondria is known as the powerhouse of the cell.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Newton\'s first law is about acceleration.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The periodic table has 118 elements.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Gravity is stronger on Jupiter than on Earth.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Light year is a unit of time.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The pH of pure water is 7.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Neptune is the farthest planet from the Sun.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Iron is represented by \'Fe\' in the periodic table.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'An atom is the smallest particle of matter.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                        ]
                    }
                ]
            },
            {
                name: 'Technology',
                description: 'Modern technology and computing',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'HTML stands for HyperText Markup Language.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The first computer was invented in the 20th century.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'RAM stands for Random Access Memory.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Google was founded in 1998.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Android is developed by Apple.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'CPU stands for Central Processing Unit.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Wi-Fi stands for Wireless Fidelity.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'JavaScript was created by Brendan Eich.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The first iPhone was released in 2007.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '1 GB equals 1024 MB.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'Mathematics',
        description: 'Numbers, logic, and problem solving',
        icon: '📐',
        modules: [
            {
                name: 'Basic Arithmetic',
                description: 'Addition, subtraction, multiplication, division',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: '15 + 27 = 42', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '8 × 7 = 54', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: '100 ÷ 4 = 25', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The square root of 144 is 12.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '2³ = 6', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'A triangle has 180 degrees.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Pi is approximately 3.14.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '0.5 is equal to 1/2.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'A hexagon has 5 sides.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: '17 × 3 = 51', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The sum of angles in a quadrilateral is 360°.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '25% of 200 is 50.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    },
                    {
                        level: 2,
                        name: 'Intermediate',
                        questions: [
                            { question: 'The factorial of 5 (5!) is 120.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Log₁₀(100) = 2', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'An odd number multiplied by an even number is always odd.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The area of a circle is πr².', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'In a right triangle, a² + b² = c².', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '√(64) + √(36) = 14', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The derivative of x² is 2x.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The GCD of 12 and 18 is 6.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: '-3 × -4 = -12', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: '3/8 is greater than 1/3.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'History & Culture',
        description: 'Nigerian and world history',
        icon: '📜',
        modules: [
            {
                name: 'Nigerian History',
                description: 'Key events in Nigerian history',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'Nigeria gained independence from Britain.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Lord Lugard amalgamated Northern and Southern Nigeria in 1914.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The first military coup in Nigeria was in 1966.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Chief Obafemi Awolowo was the first Prime Minister of Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The name "Nigeria" was coined by Flora Shaw.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Lagos was Nigeria\'s capital before Abuja.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Nigerian Civil War is also known as the Biafran War.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria became a republic in 1963.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Abuja became the capital in 1991.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'June 12 is now celebrated as Democracy Day in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            },
            {
                name: 'Nigerian Culture',
                description: 'Traditions, languages, and customs',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'Yoruba, Hausa, and Igbo are the three major ethnic groups in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The official language of Nigeria is French.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'Jollof Rice is a popular Nigerian dish.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Durbar festival is celebrated in Northern Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nok culture is one of the oldest civilizations in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Igbo people celebrate the New Yam Festival.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria has more than 250 ethnic groups.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Eyo Festival is associated with Lagos.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Pidgin English is widely spoken across Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Aso Oke is a traditional fabric from Northern Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'Current Affairs',
        description: 'Stay updated with recent events',
        icon: '📰',
        modules: [
            {
                name: 'Nigerian Politics',
                description: 'Government and political structure',
                levels: [
                    {
                        level: 1,
                        name: 'Beginner',
                        questions: [
                            { question: 'Nigeria practices a presidential system of government.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The Nigerian Senate has 109 members.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The House of Representatives has 360 members.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'INEC is responsible for conducting elections in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria\'s president serves a maximum of two terms.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Each presidential term in Nigeria is 4 years.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'The EFCC fights corruption in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'CBN stands for Central Bank of Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                            { question: 'Nigeria has a unicameral legislature.', optionA: 'True', optionB: 'False', correctOption: 'B' },
                            { question: 'The Chief Justice heads the Judiciary in Nigeria.', optionA: 'True', optionB: 'False', correctOption: 'A' },
                        ]
                    }
                ]
            }
        ]
    }
];

async function seedQuizData() {
    console.log('🎯 Seeding Quiz Data...');

    for (const courseData of QUIZ_DATA) {
        const course = await prisma.quizCourse.upsert({
            where: { name: courseData.name },
            update: { description: courseData.description, icon: courseData.icon },
            create: { name: courseData.name, description: courseData.description, icon: courseData.icon }
        });
        console.log(`  📚 Course: ${course.name}`);

        for (const moduleData of courseData.modules) {
            const mod = await prisma.quizModule.upsert({
                where: { courseId_name: { courseId: course.id, name: moduleData.name } },
                update: { description: moduleData.description },
                create: { courseId: course.id, name: moduleData.name, description: moduleData.description }
            });
            console.log(`    📖 Module: ${mod.name}`);

            for (const levelData of moduleData.levels) {
                const level = await prisma.quizLevel.upsert({
                    where: { moduleId_level: { moduleId: mod.id, level: levelData.level } },
                    update: { name: levelData.name },
                    create: { moduleId: mod.id, level: levelData.level, name: levelData.name }
                });
                console.log(`      📊 Level: ${level.name} (${levelData.questions.length} questions)`);

                // Clear existing questions for this level and re-seed
                await prisma.quizQuestion.deleteMany({ where: { levelId: level.id } });

                for (const q of levelData.questions) {
                    await prisma.quizQuestion.create({
                        data: {
                            levelId: level.id,
                            question: q.question,
                            optionA: q.optionA,
                            optionB: q.optionB,
                            correctOption: q.correctOption
                        }
                    });
                }
            }
        }
    }

    console.log('✅ Quiz data seeded successfully!');
}

seedQuizData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
