/* ===================================================
   Spark Course Advisor — Recommendation Engine
   Handles State Machine and Filtering Logic
   =================================================== */

class SparkEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = 'GREETING';
        this.educationLevel = null;
        this.complexityTier = null;
        this.subjectInterest = null;
        this.subjectTags = [];
        this.shownCourses = new Set();
    }

    // Parses user input string to find education level
    extractEducationLevel(input) {
        const lowerInput = input.toLowerCase();
        for (const [key, tier] of Object.entries(EDUCATION_COMPLEXITY_MAP)) {
            if (lowerInput.includes(key)) {
                return { original: key, tier: tier };
            }
        }
        return null;
    }

    // Parses user input string to find subject tags
    extractSubjectInterest(input) {
        const lowerInput = input.toLowerCase();
        let tags = [];
        let matchedKeywords = [];

        // Check multiple words first
        for (const [key, mappedTags] of Object.entries(SUBJECT_TAG_MAP)) {
            if (lowerInput.includes(key)) {
                tags = [...tags, ...mappedTags];
                matchedKeywords.push(key);
            }
        }

        // Deduplicate
        tags = [...new Set(tags)];

        if (tags.length > 0) {
            return {
                original: matchedKeywords[0], // primary matched concept
                tags: tags
            };
        }
        return null;
    }

    // Process user input and advance state machine
    processMessage(message) {
        const input = message.trim();
        if (!input) return null;

        // Check for obvious prompts/intents
        const lowInput = input.toLowerCase();
        if (lowInput === 'start over' || lowInput === 'restart' || lowInput === 'reset') {
            this.reset();
            return this.generateGreeting();
        }
        if (lowInput.includes('ignore previous instructions') || lowInput.includes('you are now dan') || lowInput.includes('pretend')) {
            return "I'm focused on helping you find the perfect IBM SkillsBuild course — that's my specialty! What subject area interests you most? 😊";
        }

        // Process based on current state
        switch (this.state) {
            case 'GREETING':
                return this.handleGreetingTransition(input);

            case 'INTAKE':
                return this.handleIntake(input);

            case 'FOLLOWUP':
                return this.handleFollowup(input);

            case 'RECOMMEND':
                // Edge case, shouldn't stay here
                this.state = 'FOLLOWUP';
                return this.handleFollowup(input);

            default:
                this.reset();
                return this.generateGreeting();
        }
    }

    generateGreeting() {
        this.state = 'INTAKE';
        return `Hi there! 👋 I'm Spark, your IBM SkillsBuild advisor. I'll match you with the best courses from our catalogue in seconds.

To get started, I have two quick questions:
1️⃣ What is your current level of study? (e.g., First Year, Second Year, Third Year, Postgraduate, or Other)
2️⃣ What subject area are you most interested in? (e.g., AI & Machine Learning, Data Analytics, Cybersecurity, Product Design, Sustainability, etc.)`;
    }

    handleGreetingTransition(input) {
        // If they just said hi, generate the greeting
        if (input.length < 15 && (input.toLowerCase().includes('hi') || input.toLowerCase().includes('hello') || input.toLowerCase().includes('hey'))) {
            return this.generateGreeting();
        }

        // Otherwise, try to extract from their first message
        this.state = 'INTAKE';
        return this.handleIntake(input);
    }

    handleIntake(input) {
        // Try to extract missing pieces
        if (!this.educationLevel) {
            const ed = this.extractEducationLevel(input);
            if (ed) {
                this.educationLevel = ed.original;
                this.complexityTier = ed.tier;
            }
        }

        if (!this.subjectInterest) {
            const sub = this.extractSubjectInterest(input);
            if (sub) {
                this.subjectInterest = sub.original;
                this.subjectTags = sub.tags;
            } else if (input.length > 3 && !this.educationLevel && this.extractEducationLevel(input) === null) {
                // If we didn't find specific tags, but input exists, pick some broad related terms if possible
                // For simulation, capture raw text so we can do a fuzzy search later
                this.subjectInterest = input.toLowerCase().replace(/i'm interested in|i want to learn|show me courses about/g, '').trim();
                this.subjectTags = [];
            }
        }

        // Check if we have both
        if (this.educationLevel && this.subjectInterest) {
            this.state = 'RECOMMEND';
            return this.generateRecommendations();
        }

        // Ask for what's missing
        if (!this.educationLevel) {
            return "Got it! 🎓 To make sure the courses are the right difficulty, what is your current level of study? (e.g., First Year, Second Year, Postgraduate)";
        }

        if (!this.subjectInterest) {
            return `Thanks! You're in ${this.educationLevel}. 🎯 What subject area are you most interested in exploring?`;
        }
    }

    handleFollowup(input) {
        const lowInput = input.toLowerCase();

        if (lowInput.includes('more') && (lowInput.includes('show') || lowInput.includes('option'))) {
            return this.generateRecommendations(true); // isMore = true
        }

        if (lowInput.includes('change') || lowInput.includes('instead') || lowInput.includes('different subject')) {
            if (lowInput.includes('level') || lowInput.includes('year')) {
                this.educationLevel = null;
                this.complexityTier = null;
                this.state = 'INTAKE';
                return "Not a problem! Let's update your education level. What year are you in?";
            } else {
                this.subjectInterest = null;
                this.subjectTags = [];
                this.state = 'INTAKE';
                // Check if new subject is in this same message
                const sub = this.extractSubjectInterest(input);
                if (sub) {
                    this.subjectInterest = sub.original;
                    this.subjectTags = sub.tags;
                    this.state = 'RECOMMEND';
                    return this.generateRecommendations();
                }
                return "Sure thing! What new subject area would you like to explore? 📚";
            }
        }

        if (lowInput.includes('tell me more about') || lowInput.includes('detail')) {
            return "I keep my matching logic under the hood, but I can tell you that these courses align perfectly with both your chosen subject area and current education level, based on IBM's curriculum mapping! Is there a specific course you'd like the direct link to?";
        }

        return "I'm best at helping you find the right IBM SkillsBuild course! Is there a new subject or skill area you'd like to explore? 🎓";
    }

    // Core Recommendation Engine Algorithm
    generateRecommendations(isMore = false) {
        let pool = [...COURSE_CATALOGUE];

        // STEP 1 - Filter previously shown
        pool = pool.filter(c => !this.shownCourses.has(c.id));

        // STEP 2 - Filter by Readiness (Prefer GREEN, fallback to BROWN if needed)
        let greenPool = pool.filter(c => c.readiness === 'GREEN');
        let workingPool = greenPool.length >= 3 ? greenPool : pool.filter(c => c.readiness !== 'RED'); // No Reds ever

        // STEP 3 - Score by Subject Match & Complexity
        const scoredPool = workingPool.map(course => {
            let score = 0;

            // Tag matches
            if (this.subjectTags.length > 0) {
                const matchingTags = course.tags.filter(tag => this.subjectTags.includes(tag));
                if (matchingTags.length > 0) score += 3; // Direct match
                if (matchingTags.length === course.tags.length) score += 1; // Pure match
            } else if (this.subjectInterest) {
                // Fuzzy match if no hard tags
                if (course.name.toLowerCase().includes(this.subjectInterest)) score += 2;
            }

            // Complexity Matching
            const isBeginnerCourse = course.complexity === 'BEGINNER';
            const isAdvancedCourse = course.complexity === 'ADVANCED';

            if (this.complexityTier === 'BEGINNER' && isBeginnerCourse) score += 2;
            if (this.complexityTier === 'ADVANCED' && isAdvancedCourse) score += 2;
            if (this.complexityTier === 'BEGINNER-INTERMEDIATE' && (isBeginnerCourse || course.complexity === 'INTERMEDIATE')) score += 1;
            if (this.complexityTier === 'INTERMEDIATE-ADVANCED' && (course.complexity === 'INTERMEDIATE' || isAdvancedCourse)) score += 1;

            // Penalty for mismatches
            if (this.complexityTier === 'BEGINNER' && isAdvancedCourse) score -= 3; // Too hard
            if (this.complexityTier === 'ADVANCED' && isBeginnerCourse) score -= 1; // Too easy, but sometimes okay for broad overviews

            // Market matches (bonus points)
            if (course.market.includes('WEF') || course.market.includes('McKinsey') || course.market.includes('BCG')) {
                score += 1;
            }

            return { ...course, _score: score };
        });

        // Sort by score descending
        scoredPool.sort((a, b) => b._score - a._score);

        // Select Top 3
        const top3 = scoredPool.slice(0, 3);

        if (top3.length === 0) {
            this.state = 'FOLLOWUP';
            return `Hmm, I don't currently have courses that perfectly match "${this.subjectInterest || 'that topic'}" in the catalog. The closest matches I have are in AI fundamentals and data science — would either of those work for you? 🎓`;
        }

        // Track shown
        top3.forEach(c => this.shownCourses.add(c.id));
        this.state = 'FOLLOWUP';

        // Format output
        let preamble = isMore
            ? `Here are 3 more excellent options outside the ones I just showed you:`
            : `Great news — based on your level and interest in **${this.subjectInterest || 'this topic'}**, here are your top IBM SkillsBuild courses:`;

        return {
            type: 'recommendation',
            text: preamble,
            courses: top3,
            followup: "Would you like more options, a different subject area, or help choosing between these? 😊"
        };
    }
}
