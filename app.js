/* ===================================================
   Spark Course Advisor — UI Controller
   Handles interactions, typing indicators, and rendering
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new SparkEngine();

    // UI Elements
    const chatArea = document.getElementById('chat-area');
    const messagesEl = document.getElementById('messages');
    const inputField = document.getElementById('user-input');
    const sendBtn = document.getElementById('btn-send');
    const restartBtn = document.getElementById('btn-restart');
    const quickRepliesEl = document.getElementById('quick-replies');

    // Initial Greeting
    addBotMessage(engine.generateGreeting());

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);

    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize textarea
    inputField.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') this.style.height = 'auto';
    });

    restartBtn.addEventListener('click', () => {
        engine.reset();
        messagesEl.innerHTML = '';
        quickRepliesEl.innerHTML = '';
        quickRepliesEl.classList.add('hidden');
        addBotMessage(engine.generateGreeting());
    });

    // Core Send Logic
    async function handleSend(forcedQuery = null) {
        const text = forcedQuery || inputField.value.trim();
        if (!text) return;

        // Reset input
        if (!forcedQuery) {
            inputField.value = '';
            inputField.style.height = 'auto';
        }

        // Clear quick replies
        quickRepliesEl.innerHTML = '';
        quickRepliesEl.classList.add('hidden');

        // Add user message to UI
        addUserMessage(text);

        // Show typing indicator
        const typingId = showTypingIndicator();

        // Process through engine (simulated network delay for realism)
        const delay = Math.floor(Math.random() * 800) + 600;

        setTimeout(() => {
            removeTypingIndicator(typingId);

            let response = engine.processMessage(text);

            // Render response
            if (typeof response === 'string') {
                addBotMessage(response);

                // Contextual Quick Replies for Intake
                if (engine.state === 'INTAKE' && !engine.subjectInterest && engine.educationLevel) {
                    setQuickReplies(["AI", "Data", "Cybersecurity", "Product Design", "Sustainability"]);
                } else if (engine.state === 'INTAKE' && !engine.educationLevel) {
                    setQuickReplies(["First Year", "Second Year", "Third Year", "Postgraduate"]);
                }
            } else if (response && response.type === 'recommendation') {
                addRecommendationMessage(response);
                setQuickReplies(["Show me more options", "Change subject area", "Start over"]);
            }

        }, delay);
    }

    // UI Helpers
    function addUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'message user';
        msg.innerHTML = `
        <div class="msg-avatar">You</div>
        <div class="msg-bubble">${escapeHTML(text)}</div>
      `;
        messagesEl.appendChild(msg);
        scrollToBottom();
    }

    function addBotMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'message bot';

        // Parse markdown-lite (bold)
        const formattedText = escapeHTML(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        msg.innerHTML = `
        <div class="msg-avatar">⚡</div>
        <div class="msg-bubble">${formattedText}</div>
      `;
        messagesEl.appendChild(msg);
        scrollToBottom();
    }

    function addRecommendationMessage(data) {
        const msg = document.createElement('div');
        msg.className = 'message bot';

        let html = `
          <div class="msg-avatar">⚡</div>
          <div class="msg-bubble recommendations-container">
            <p>${data.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
            <div class="course-cards">
        `;

        const rankLabels = ["🥇 BEST MATCH", "🥈 STRONG MATCH", "🥉 ALSO RECOMMENDED"];

        function getCourseDuration(course) {
            if (course.name.includes("Pathway") || course.credentialLabel?.includes("microcredentials")) return "20-40 Hours";
            if (course.complexity === "ADVANCED") return "8-12 Hours";
            if (course.complexity === "INTERMEDIATE") return "4-6 Hours";
            return "2-3 Hours";
        }

        data.courses.forEach((course, index) => {
            html += `
            <div class="course-card rank-${Math.min(index + 1, 3)}">
                <div class="card-rank">${rankLabels[index] || "🏅 EXCELLENT OPTION"}</div>
                <h3 class="card-title">${course.name}</h3>
                
                <div class="card-meta">
                    <span class="card-tag">⏱️ Duration: ${getCourseDuration(course)}</span>
                    <span class="card-tag">📊 ${course.complexity}</span>
                    ${course.credential ? `<span class="card-tag credential">🏆 Credential: ${course.credentialLabel || 'Yes'}</span>` : ''}
                </div>
                
                <p class="card-reason">🎯 <strong>Why this fits you:</strong> Highly rated for <em>${course.market}</em>. It aligns well with your interest in ${engine.subjectInterest || 'this field'} and is suitable for your education level.</p>
            </div>
            `;
        });

        html += `
            </div>
            <p style="margin-top: 16px;">${data.followup}</p>
          </div>
        `;

        msg.innerHTML = html;
        messagesEl.appendChild(msg);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const msg = document.createElement('div');
        msg.id = id;
        msg.className = 'message bot typing-msg';
        msg.innerHTML = `
        <div class="msg-avatar">⚡</div>
        <div class="msg-bubble typing-indicator">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      `;
        messagesEl.appendChild(msg);
        scrollToBottom();
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function setQuickReplies(options) {
        quickRepliesEl.innerHTML = '';
        if (options && options.length > 0) {
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'quick-reply-btn';
                btn.textContent = opt;
                btn.addEventListener('click', () => {
                    handleSend(opt);
                });
                quickRepliesEl.appendChild(btn);
            });
            quickRepliesEl.classList.remove('hidden');
        } else {
            quickRepliesEl.classList.add('hidden');
        }
    }

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Security: basic HTML escape
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
