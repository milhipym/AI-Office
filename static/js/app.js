/**
 * AI Office - Virtual AI Office Web Application
 * Pixel-art themed interactive office with AI agent employees
 */

// ===== STATE =====
const state = {
    agents: [],
    chatMessages: [],
    furniture: [],
    orgData: null,
    selectedAgent: null,
    selectedFurniture: null,
    activeCategory: '전체',
    placedItems: {},  // grid position -> furniture item
    entries: [],
    brainMeta: { categories: [], models: {} },
};

// ===== PIXEL ART CHARACTERS (CSS-based) =====
const AGENT_EMOJIS = {
    claude: '🟣',
    manus: '🔵',
    sonnet: '🟪',
    gemini: '🟡',
    chatgpt: '🟢',
    perplexity: '🔮',
    archivist: '🗂️',
    minutes: '📝',
    finder: '🔎',
    reporter: '📊',
    coach: '🧭',
    user: '👤',
};

const STATUS_TEXT = {
    working: '작업 중',
    meeting: '회의 중',
    idle: '대기 중',
};

const STATUS_ICONS = {
    working: '💻',
    meeting: '🤝',
    idle: '☕',
};

// ===== OFFICE LAYOUT =====
// 9x7 grid layout defining room types
const OFFICE_LAYOUT = [
    ['wall', 'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall'],
    ['main', 'main',  'main',  'main',  'wall',  'meet',  'meet',  'meet',  'wall'],
    ['main', 'main',  'main',  'main',  'wall',  'meet',  'meet',  'meet',  'wall'],
    ['main', 'main',  'main',  'main',  'hall',  'meet',  'meet',  'meet',  'wall'],
    ['wall', 'wall',  'hall',  'wall',  'hall',  'wall',  'hall',  'wall',  'wall'],
    ['cont', 'cont',  'cont',  'hall',  'dev',   'dev',   'dev',   'dev',   'wall'],
    ['cont', 'cont',  'cont',  'hall',  'dev',   'dev',   'dev',   'dev',   'wall'],
];

const ROOM_CLASSES = {
    wall: 'wall',
    main: 'room-main',
    meet: 'room-meeting',
    cont: 'room-content',
    dev:  'room-dev',
    hall: 'hallway',
};

const ROOM_NAMES = {
    main: '메인 오피스',
    meet: '회의실',
    cont: '콘텐츠 팀룸',
    dev:  '개발 팀룸',
};

// Furniture placements (col, row) -> type
const DEFAULT_FURNITURE = {
    '1,1': 'desk', '2,1': 'monitor', '3,1': 'bookshelf',
    '1,2': 'chair', '2,2': 'desk', '3,2': 'monitor',
    '1,3': 'plant', '3,3': 'plant',
    '5,1': 'sofa',  '7,1': 'plant',
    '6,2': 'desk',  // meeting table area
    '5,2': 'chair', '7,2': 'chair',
    '6,3': 'chair',
    '1,5': 'desk',  '2,5': 'monitor', '1,6': 'chair',
    '2,6': 'plant',
    '4,5': 'desk',  '5,5': 'monitor', '6,5': 'desk', '7,5': 'monitor',
    '4,6': 'chair', '5,6': 'chair',   '6,6': 'chair', '7,6': 'plant',
};

const FURNITURE_DISPLAY = {
    desk: { emoji: '🪑', label: '책상', cssClass: 'furniture-desk' },
    chair: { emoji: '💺', label: '의자', cssClass: 'furniture-chair' },
    plant: { emoji: '🌿', label: '화분', cssClass: 'furniture-plant' },
    cactus: { emoji: '🌵', label: '선인장', cssClass: '' },
    coffee: { emoji: '☕', label: '커피머신', cssClass: '' },
    bookshelf: { emoji: '📚', label: '책장', cssClass: 'furniture-bookshelf' },
    sofa: { emoji: '🛋️', label: '소파', cssClass: 'furniture-sofa' },
    monitor: { emoji: '🖥️', label: '모니터', cssClass: 'furniture-monitor' },
    bin: { emoji: '🗑️', label: '휴지통', cssClass: '' },
    lamp: { emoji: '💡', label: '스탠드', cssClass: '' },
    whiteboard: { emoji: '📋', label: '화이트보드', cssClass: '' },
    rug: { emoji: '🟫', label: '러그', cssClass: '' },
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initMarkdown();
    initTabs();
    loadData();
});

function initMarkdown() {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {}
                }
                return code;
            },
        });
    }
}

async function loadData() {
    try {
        const [agentsRes, chatRes, furnitureRes, orgRes, statusRes, metaRes] = await Promise.all([
            fetch('/api/agents'),
            fetch('/api/chat'),
            fetch('/api/furniture'),
            fetch('/api/org'),
            fetch('/api/status'),
            fetch('/api/brain/meta'),
        ]);

        state.agents = await agentsRes.json();
        state.chatMessages = await chatRes.json();
        state.furniture = await furnitureRes.json();
        state.orgData = await orgRes.json();
        state.apiStatus = await statusRes.json();
        state.brainMeta = await metaRes.json();
        state.placedItems = { ...DEFAULT_FURNITURE };
        document.querySelectorAll('.agent-count').forEach(el => { el.textContent = state.agents.length; });

        renderApiBadge();
        renderOffice();
        renderAgentStatusBar();
        renderChat();
        renderOrgChart();
        renderCustomize();
        initChatInput();
        initBrain();
        loadEntries();
        startAgentAnimations();
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

function renderApiBadge() {
    const badge = document.getElementById('apiBadge');
    if (!badge) return;
    if (state.apiStatus?.openai_configured) {
        badge.textContent = '🟢 OpenAI 연결됨';
        badge.classList.add('connected');
    } else {
        badge.textContent = '⚠️ OPENAI_API_KEY 미설정';
        badge.classList.add('disconnected');
    }
}

// ===== TAB NAVIGATION =====
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(`tab-${tab.dataset.tab}`);
            if (target) target.classList.add('active');
        });
    });
}

// ===== OFFICE RENDERING =====
function renderOffice() {
    const grid = document.getElementById('officeGrid');
    grid.innerHTML = '';

    const labelPlaced = {};

    for (let row = 0; row < OFFICE_LAYOUT.length; row++) {
        for (let col = 0; col < OFFICE_LAYOUT[row].length; col++) {
            const cellType = OFFICE_LAYOUT[row][col];
            const cell = document.createElement('div');
            cell.className = `grid-cell ${ROOM_CLASSES[cellType] || ''}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Room labels (only first cell of each room)
            if (ROOM_NAMES[cellType] && !labelPlaced[cellType]) {
                const label = document.createElement('span');
                label.className = 'room-label';
                label.textContent = ROOM_NAMES[cellType];
                cell.appendChild(label);
                labelPlaced[cellType] = true;
            }

            // Furniture
            const furnitureKey = `${col},${row}`;
            if (state.placedItems[furnitureKey] && cellType !== 'wall') {
                const fType = state.placedItems[furnitureKey];
                const fData = FURNITURE_DISPLAY[fType];
                if (fData) {
                    const fEl = document.createElement('span');
                    fEl.className = 'furniture';
                    fEl.textContent = fData.emoji;
                    fEl.style.fontSize = '20px';
                    cell.appendChild(fEl);
                }
            }

            grid.appendChild(cell);
        }
    }

    // Place agents
    renderAgentsOnGrid(grid);
}

function renderAgentsOnGrid(grid) {
    state.agents.forEach(agent => {
        const pos = agent.position;
        if (!pos) return;

        const cellIndex = pos.y * 9 + pos.x;
        const cells = grid.querySelectorAll('.grid-cell');
        if (!cells[cellIndex]) return;

        const agentEl = document.createElement('div');
        agentEl.className = `pixel-agent idle-anim`;
        agentEl.dataset.agentId = agent.id;
        agentEl.innerHTML = `
            <div class="agent-body">
                <div class="head" style="background: ${agent.avatar_color}"></div>
                <div class="body-part" style="background: ${agent.avatar_color}; opacity: 0.8"></div>
                <div class="legs">
                    <div class="leg"></div>
                    <div class="leg"></div>
                </div>
                <div class="agent-status-badge ${agent.status}"></div>
            </div>
            <div class="name-tag">${escapeHtml(agent.short_name || agent.name.split(' ')[0])}</div>
        `;

        agentEl.addEventListener('click', () => showAgentInfo(agent));
        cells[cellIndex].appendChild(agentEl);
        cells[cellIndex].style.overflow = 'visible';
        cells[cellIndex].style.zIndex = '10';
    });
}

function showAgentInfo(agent) {
    const panel = document.getElementById('agentInfoPanel');
    const body = document.getElementById('panelBody');

    state.selectedAgent = agent;

    body.innerHTML = `
        <div class="agent-detail">
            <div class="agent-detail-header">
                <div class="agent-avatar-lg" style="background: ${agent.avatar_color}">
                    ${agent.name.charAt(0)}
                </div>
                <div>
                    <div class="agent-detail-name">${agent.name}</div>
                    <div class="agent-detail-role">${agent.role}</div>
                </div>
            </div>
            <div class="agent-status-label ${agent.status}">
                ${STATUS_ICONS[agent.status]} ${STATUS_TEXT[agent.status]}
            </div>
            <div class="agent-detail-desc">${agent.description}</div>
            <div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">스킬</div>
                <div class="agent-skills">
                    ${agent.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                </div>
            </div>
        </div>
    `;

    panel.classList.add('open');

    document.getElementById('closePanel').onclick = () => {
        panel.classList.remove('open');
    };
}

// ===== AGENT STATUS BAR =====
function renderAgentStatusBar() {
    const bar = document.getElementById('agentStatusBar');
    bar.innerHTML = '';

    state.agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.innerHTML = `
            <div class="agent-avatar-sm" style="background: ${agent.avatar_color}">
                ${agent.name.charAt(0)}
            </div>
            <div class="agent-card-info">
                <div class="agent-card-name">${agent.name}</div>
                <div class="agent-card-role">${agent.role}</div>
                <div class="agent-card-status">
                    <span class="status-dot ${agent.status === 'working' ? 'online' : ''}"></span>
                    ${STATUS_ICONS[agent.status]} ${STATUS_TEXT[agent.status]}
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            showAgentInfo(agent);
            // Switch to office tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="office"]').classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-office').classList.add('active');
        });
        bar.appendChild(card);
    });
}

// ===== CHAT =====
function renderChat() {
    renderChatSidebar();
    renderChatMessages();
}

function renderChatSidebar() {
    const sidebar = document.getElementById('chatAgents');
    sidebar.innerHTML = '';

    state.agents.forEach(agent => {
        const item = document.createElement('div');
        item.className = 'chat-agent-item';
        item.innerHTML = `
            <div class="chat-agent-avatar" style="background: ${agent.avatar_color}">
                ${agent.name.charAt(0)}
                <span class="mini-dot" style="background: ${agent.status === 'working' ? 'var(--accent-green)' : agent.status === 'meeting' ? 'var(--accent-blue)' : 'var(--accent-orange)'}"></span>
            </div>
            <div>
                <div class="chat-agent-name">${agent.name}</div>
                <div class="chat-agent-role">${agent.role}</div>
            </div>
        `;
        sidebar.appendChild(item);
    });
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    state.chatMessages.forEach(msg => {
        container.appendChild(buildMessageElement(msg));
    });

    // Apply syntax highlighting after DOM insertion
    if (typeof hljs !== 'undefined') {
        container.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }

    container.scrollTop = container.scrollHeight;
}

function buildMessageElement(msg) {
    const agent = state.agents.find(a => a.id === msg.agent);
    const isUser = msg.agent === 'user';

    const el = document.createElement('div');
    el.className = `chat-message ${isUser ? 'user' : ''}`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';
    avatar.style.background = isUser ? '#ef4444' : (agent?.avatar_color || '#666');
    avatar.textContent = isUser ? '나' : (agent?.name?.charAt(0) || '?');

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'chat-msg-content';

    // Header
    const header = document.createElement('div');
    header.className = 'chat-msg-header';
    header.innerHTML = `
        <span class="chat-msg-name">${isUser ? '대표 (나)' : (agent?.name || 'Unknown')}</span>
        <span class="chat-msg-time">${escapeHtml(msg.time || '')}</span>
        <span class="chat-msg-type ${msg.type || 'report'}">${getTypeLabel(msg.type)}</span>
        ${msg.metadata?.model ? `<span class="chat-msg-meta">${escapeHtml(msg.metadata.model)}${msg.metadata.latency_ms ? ' · ' + msg.metadata.latency_ms + 'ms' : ''}</span>` : ''}
    `;
    content.appendChild(header);

    // Body: markdown text
    const body = document.createElement('div');
    body.className = 'chat-msg-text';
    body.innerHTML = renderMarkdown(msg.message || '');
    content.appendChild(body);

    // Dedicated code blocks (structured)
    if (msg.code_blocks && msg.code_blocks.length > 0) {
        // If the markdown already contains the same fenced blocks, the body
        // will render them. We additionally render a "file tree" header for
        // multi-file outputs and ensure every block has a copy button.
        enhanceCodeBlocks(body, msg.code_blocks);
    }

    // Images (DALL-E)
    if (msg.images && msg.images.length > 0) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'chat-msg-images';
        msg.images.forEach(img => {
            const fig = document.createElement('figure');
            fig.className = 'chat-image-figure';
            fig.innerHTML = `
                <img src="${escapeAttr(img.url)}" alt="${escapeAttr(img.prompt || 'Generated image')}" loading="lazy" class="chat-image">
                <figcaption>
                    <span class="chat-image-prompt">${escapeHtml(img.prompt || '')}</span>
                    <a href="${escapeAttr(img.url)}" target="_blank" rel="noopener" class="chat-image-download">원본 열기 ↗</a>
                </figcaption>
            `;
            imgWrap.appendChild(fig);
        });
        content.appendChild(imgWrap);
    }

    // Citations (Perplexity)
    if (msg.citations && msg.citations.length > 0) {
        const citWrap = document.createElement('div');
        citWrap.className = 'citation-list';
        citWrap.innerHTML = `<div class="citation-title">📚 출처</div>`;
        msg.citations.forEach(c => {
            const item = document.createElement('a');
            item.className = 'citation-item';
            // Search results are untrusted: only allow web links, never javascript: etc.
            item.href = /^https?:\/\//i.test(c.url || '') ? c.url : '#';
            item.target = '_blank';
            item.rel = 'noopener';
            item.innerHTML = `
                <span class="citation-index">[${c.index}]</span>
                <span class="citation-text">${escapeHtml(c.title || c.url)}</span>
            `;
            citWrap.appendChild(item);
        });
        content.appendChild(citWrap);
    }

    el.appendChild(avatar);
    el.appendChild(content);
    return el;
}

function renderMarkdown(text) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }
    try {
        // marked.parse supports ```lang:filename — we handle this via post-processing
        const raw = marked.parse(text);
        return DOMPurify.sanitize(raw, {
            ADD_ATTR: ['target', 'rel'],
        });
    } catch (e) {
        console.error('Markdown render failed:', e);
        return escapeHtml(text);
    }
}

function enhanceCodeBlocks(container, codeBlocks) {
    // Find all <pre><code> elements and attach copy buttons + filename headers.
    const pres = container.querySelectorAll('pre');
    pres.forEach((pre, idx) => {
        const meta = codeBlocks[idx] || {};
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
            <span class="code-block-filename">
                ${meta.filename ? '📄 ' + escapeHtml(meta.filename) : '💻 ' + (meta.language || 'code')}
            </span>
            <div class="code-block-actions">
                <span class="code-block-lang">${escapeHtml(meta.language || '')}</span>
                <button class="code-copy-btn" data-code-idx="${idx}">복사</button>
            </div>
        `;

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });

    // Wire up copy buttons
    container.querySelectorAll('.code-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = parseInt(btn.dataset.codeIdx, 10);
            const code = codeBlocks[idx]?.code || '';
            navigator.clipboard.writeText(code).then(() => {
                btn.textContent = '복사됨 ✓';
                setTimeout(() => { btn.textContent = '복사'; }, 1500);
            }).catch(() => {
                btn.textContent = '실패';
            });
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

function getTypeLabel(type) {
    const labels = {
        task: '업무',
        report: '보고',
        system: '시스템',
        command: '지시',
    };
    return labels[type] || type;
}

function initChatInput() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const dropdown = document.getElementById('mentionDropdown');

    const MENTION_LIST = [
        { id: 'sonnet', name: 'Claude Sonnet', role: '개발자', icon: '💻' },
        { id: 'opus', name: 'Claude Opus', role: 'CTO / 아키텍처', icon: '🏛️' },
        { id: 'manus', name: 'Manus', role: 'PM / 기획', icon: '📋' },
        { id: 'gemini', name: 'Gemini', role: '디자이너 / 이미지', icon: '🎨' },
        { id: 'chatgpt', name: 'ChatGPT', role: '분석가', icon: '📊' },
        { id: 'perplexity', name: 'Perplexity', role: '리서처 / 검색', icon: '🔎' },
    ];

    const COMMAND_LIST = [
        { id: '기록', name: '아카이브', role: '오늘 한 일 기록', icon: '🗂️' },
        { id: '회의', name: '회의록 서기', role: '회의 메모 → 회의록', icon: '📝' },
        { id: '찾기', name: '파인더', role: '과거 기록 검색', icon: '🔎' },
        { id: '주간', name: '리포터', role: '주간 보고 (지난주 가능)', icon: '📊' },
        { id: '성과', name: '커리어 코치', role: '기간별 성과 정리', icon: '🧭' },
    ];

    const showDropdown = (items, prefixChar) => {
        dropdown.innerHTML = items.map(m => `
            <div class="mention-item" data-id="${m.id}">
                <span class="mention-icon">${m.icon}</span>
                <div class="mention-info">
                    <div class="mention-name">${prefixChar}${m.id}</div>
                    <div class="mention-role">${m.name} · ${m.role}</div>
                </div>
            </div>
        `).join('');
        dropdown.classList.add('open');
        dropdown.querySelectorAll('.mention-item').forEach(item => {
            item.addEventListener('click', () => {
                input.value = `${prefixChar}${item.dataset.id} `;
                dropdown.classList.remove('open');
                input.focus();
            });
        });
    };

    const updateMentionDropdown = () => {
        const value = input.value;
        const slashMatch = value.match(/^\/(\S*)$/);
        if (slashMatch) {
            const filtered = COMMAND_LIST.filter(c => c.id.startsWith(slashMatch[1]));
            if (filtered.length) showDropdown(filtered, '/');
            else dropdown.classList.remove('open');
            return;
        }
        const atMatch = value.match(/^@(\w*)$/);
        if (!atMatch) {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            return;
        }
        const prefix = atMatch[1].toLowerCase();
        const filtered = MENTION_LIST.filter(m => m.id.startsWith(prefix));
        if (filtered.length === 0) {
            dropdown.classList.remove('open');
            return;
        }
        showDropdown(filtered, '@');
    };

    const send = async () => {
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        dropdown.classList.remove('open');
        input.disabled = true;
        sendBtn.disabled = true;

        // Optimistic user message
        const tempUser = {
            agent: 'user',
            message,
            time: new Date().toTimeString().slice(0, 5),
            type: 'command',
        };
        state.chatMessages.push(tempUser);

        // Loading placeholder
        const loadingMsg = {
            agent: guessAgent(message),
            message: '_🤔 생각 중..._',
            time: new Date().toTimeString().slice(0, 5),
            type: 'system',
            _loading: true,
        };
        state.chatMessages.push(loadingMsg);
        renderChatMessages();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // Replace optimistic + loading with real messages
            state.chatMessages = state.chatMessages.filter(m => !m._loading);
            // Replace last user msg (in case server normalized)
            state.chatMessages[state.chatMessages.length - 1] = data.user_message;
            state.chatMessages.push(data.ai_response);
            renderChatMessages();

            const agentName = state.agents.find(a => a.id === data.ai_response.agent)?.name || data.ai_response.agent;
            showToast(`${agentName} 응답 완료`);
            if (data.ai_response.metadata?.brain_refresh) loadEntries();
        } catch (err) {
            console.error('Send failed:', err);
            state.chatMessages = state.chatMessages.filter(m => !m._loading);
            state.chatMessages.push({
                agent: 'manus',
                message: `⚠️ 메시지 전송 실패: ${err.message}`,
                time: new Date().toTimeString().slice(0, 5),
                type: 'system',
            });
            renderChatMessages();
            showToast('전송 실패');
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });
    input.addEventListener('input', updateMentionDropdown);
}

// Very rough client-side guess so the loading placeholder shows the right avatar
function guessAgent(message) {
    const m = message.trim();
    const command = m.match(/^\/(\S+)/);
    if (command) {
        const map = { '기록': 'archivist', '회의': 'minutes', '회의록': 'minutes', '찾기': 'finder',
                      '검색': 'finder', '주간': 'reporter', '주간보고': 'reporter', '성과': 'coach', '커리어': 'coach' };
        if (map[command[1]]) return map[command[1]];
    }
    const mention = m.match(/^@(\w+)/);
    if (mention) {
        const id = mention[1].toLowerCase();
        const map = { opus: 'claude', claude: 'claude', sonnet: 'sonnet',
                      manus: 'manus', gemini: 'gemini', chatgpt: 'chatgpt',
                      gpt: 'chatgpt', perplexity: 'perplexity', ppl: 'perplexity' };
        if (map[id]) return map[id];
    }
    const lower = m.toLowerCase();
    if (/코드|구현|버그|함수|api 만들|code|implement/.test(lower)) return 'sonnet';
    if (/아키텍처|설계|기술 스택|architecture/.test(lower)) return 'claude';
    if (/검색|최신|트렌드|뉴스|search|latest/.test(lower)) return 'perplexity';
    if (/이미지|로고|디자인|image|logo/.test(lower)) return 'gemini';
    if (/분석|보고서|커리큘럼|analysis|report/.test(lower)) return 'chatgpt';
    return 'manus';
}

// ===== SECOND BRAIN =====
async function loadEntries() {
    try {
        const res = await fetch('/api/entries');
        state.entries = await res.json();
        renderBrain();
    } catch (err) {
        console.error('Failed to load entries:', err);
    }
}

function initBrain() {
    const select = document.getElementById('brainCategory');
    (state.brainMeta.categories || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    ['brainSearch', 'brainCategory', 'brainKind'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderBrain);
    });
    document.querySelectorAll('.brain-btn[data-command]').forEach(btn => {
        btn.addEventListener('click', () => runCommandInChat(btn.dataset.command));
    });
    document.getElementById('brainList').addEventListener('click', async (e) => {
        const btn = e.target.closest('.entry-delete');
        if (!btn) return;
        if (!confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
        const res = await fetch(`/api/entries/${btn.dataset.id}`, { method: 'DELETE' });
        if (res.ok) {
            state.entries = state.entries.filter(x => String(x.id) !== btn.dataset.id);
            renderBrain();
            showToast('기록 삭제됨');
        }
    });
}

function runCommandInChat(command) {
    document.querySelector('.nav-tab[data-tab="chat"]').click();
    const input = document.getElementById('chatInput');
    input.value = command;
    document.getElementById('sendBtn').click();
}

function renderBrain() {
    const list = document.getElementById('brainList');
    const stats = document.getElementById('brainStats');
    if (!list) return;

    const q = document.getElementById('brainSearch').value.trim().toLowerCase();
    const category = document.getElementById('brainCategory').value;
    const kind = document.getElementById('brainKind').value;

    const filtered = state.entries.filter(e =>
        (!category || e.category === category) &&
        (!kind || e.kind === kind) &&
        (!q || [e.title, e.summary, e.content, (e.tags || []).join(' ')].join(' ').toLowerCase().includes(q))
    );

    const achievements = state.entries.filter(e => e.details?.achievement).length;
    const meetings = state.entries.filter(e => e.kind === 'meeting').length;
    const models = state.brainMeta.models || {};
    stats.innerHTML = `
        <span>전체 <b>${state.entries.length}</b>건</span>
        <span>회의록 <b>${meetings}</b>건</span>
        <span>🏆 성과 후보 <b>${achievements}</b>건</span>
        <span>표시 중 <b>${filtered.length}</b>건</span>
        <span class="brain-models" title="에이전트별 모델 (.env에서 변경)">
            모델: 기록 ${escapeHtml(models.archivist || '')} · 검색 ${escapeHtml(models.finder || '')} · 보고 ${escapeHtml(models.reporter || '')} · 성과 ${escapeHtml(models.coach || '')}
        </span>
    `;

    if (filtered.length === 0) {
        list.innerHTML = state.entries.length === 0
            ? `<div class="brain-empty">아직 기록이 없습니다.<br>팀 채팅에서 <code>/기록 오늘 한 일</code> 또는 <code>/회의 회의 메모</code>로 시작하세요.</div>`
            : `<div class="brain-empty">조건에 맞는 기록이 없습니다.</div>`;
        return;
    }

    let lastDate = null;
    list.innerHTML = filtered.map(e => {
        const dateHeader = e.entry_date !== lastDate ? `<div class="brain-date">${escapeHtml(e.entry_date)}</div>` : '';
        lastDate = e.entry_date;
        const d = e.details || {};
        const actions = (d.action_items || []).map(i =>
            `<li>${escapeHtml(i.task)} <span class="muted">— ${escapeHtml(i.owner || '미정')}${i.due ? ' · ' + escapeHtml(i.due) : ''}</span></li>`
        ).join('');
        const decisions = (d.decisions || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
        return `${dateHeader}
            <article class="entry-card ${e.kind}">
                <div class="entry-head">
                    <span class="entry-kind">${e.kind === 'meeting' ? '📝 회의' : '🗂️ 기록'}</span>
                    <span class="entry-category">${escapeHtml(e.category)}</span>
                    <span class="entry-title">${escapeHtml(e.title)}${d.achievement ? ' 🏆' : ''}</span>
                    <span class="entry-id">#${e.id}</span>
                    <button class="entry-delete" data-id="${e.id}" title="삭제">✕</button>
                </div>
                ${e.summary ? `<div class="entry-summary">${escapeHtml(e.summary)}</div>` : ''}
                ${d.impact ? `<div class="entry-impact">📈 ${escapeHtml(d.impact)}</div>` : ''}
                ${decisions ? `<div class="entry-section"><b>결정사항</b><ul>${decisions}</ul></div>` : ''}
                ${actions ? `<div class="entry-section"><b>액션 아이템</b><ul>${actions}</ul></div>` : ''}
                ${(e.tags || []).length ? `<div class="entry-tags">${e.tags.map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                <details class="entry-raw"><summary>원문</summary><pre>${escapeHtml(e.content)}</pre></details>
            </article>`;
    }).join('');
}

// ===== ORG CHART =====
function renderOrgChart() {
    const chart = document.getElementById('orgChart');
    if (!state.orgData) return;

    const { ceo, direct, teams } = state.orgData;

    chart.innerHTML = `
        <!-- CEO -->
        <div class="org-level">
            <div class="org-card ceo" style="border-color: ${ceo.color}">
                <div class="org-card-title">${ceo.title}</div>
                <div class="org-card-name">${ceo.name}</div>
            </div>
        </div>

        <div class="org-connector"></div>

        <!-- Direct Reports -->
        <div class="org-level">
            ${direct.map(d => `
                <div class="org-card direct" style="border-left-color: ${d.color}">
                    <div class="org-card-title">${d.title}</div>
                    <div class="org-card-name">${d.name}</div>
                    <div class="org-card-desc">${d.desc}</div>
                </div>
            `).join('')}
        </div>

        <div class="org-connector"></div>

        <!-- Teams -->
        <div class="org-teams">
            ${teams.map(team => `
                <div class="org-team-card">
                    <div class="org-team-header" style="background: ${team.color}10; border-bottom-color: ${team.color}40">
                        <span class="org-team-name">${team.name}</span>
                        <span class="org-team-code" style="background: ${team.color}">${team.code}</span>
                    </div>
                    <div class="org-team-desc">${team.desc}</div>
                    <div class="org-team-agents">
                        ${team.agents.map(a => `<span class="org-agent-badge">${a}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== CUSTOMIZE =====
function renderCustomize() {
    renderFurnitureCategories();
    renderFurnitureItems('전체');
    renderCustomizeGrid();
}

function renderFurnitureCategories() {
    const container = document.getElementById('furnitureCategories');
    const categories = ['전체', '책상', '의자', '소품', '전자기기', '벽 장식'];

    container.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat === '전체' ? 'active' : ''}" data-cat="${cat}">
            ${cat}
        </button>
    `).join('');

    container.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeCategory = btn.dataset.cat;
            renderFurnitureItems(btn.dataset.cat);
        });
    });
}

function renderFurnitureItems(category) {
    const container = document.getElementById('furnitureItems');
    const items = state.furniture.filter(f => category === '전체' || f.category === category);

    container.innerHTML = items.map(item => {
        const display = FURNITURE_DISPLAY[item.icon] || { emoji: '📦', label: item.name };
        return `
            <div class="furniture-item ${state.selectedFurniture === item.id ? 'selected' : ''}" data-id="${item.id}">
                <div class="furniture-icon">${display.emoji}</div>
                <div class="furniture-name">${item.name}</div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.furniture-item').forEach(el => {
        el.addEventListener('click', () => {
            container.querySelectorAll('.furniture-item').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            state.selectedFurniture = el.dataset.id;
        });
    });
}

function renderCustomizeGrid() {
    const grid = document.getElementById('customizeGrid');
    grid.innerHTML = '';

    for (let row = 0; row < OFFICE_LAYOUT.length; row++) {
        for (let col = 0; col < OFFICE_LAYOUT[row].length; col++) {
            const cellType = OFFICE_LAYOUT[row][col];
            const cell = document.createElement('div');
            const key = `${col},${row}`;
            const hasItem = state.placedItems[key];

            cell.className = `customize-cell ${ROOM_CLASSES[cellType] || ''} ${hasItem ? 'has-item' : ''}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (cellType === 'wall') {
                cell.style.cursor = 'not-allowed';
            }

            if (hasItem) {
                const fData = FURNITURE_DISPLAY[hasItem];
                if (fData) {
                    cell.innerHTML = `<span class="placed-item">${fData.emoji}</span>`;
                }
            }

            cell.addEventListener('click', () => {
                if (cellType === 'wall') return;

                if (state.selectedFurniture) {
                    // Place furniture
                    state.placedItems[key] = state.selectedFurniture;
                    renderCustomizeGrid();
                    showToast(`${FURNITURE_DISPLAY[state.selectedFurniture]?.label || '아이템'} 배치 완료!`);
                } else if (hasItem) {
                    // Remove furniture
                    delete state.placedItems[key];
                    renderCustomizeGrid();
                    showToast('아이템 제거됨');
                }
            });

            grid.appendChild(cell);
        }
    }

    // Save button
    document.getElementById('saveOffice').onclick = () => {
        renderOffice();
        showToast('사무실 저장 완료! 사무실 탭에서 확인하세요.');
    };
}

// ===== AGENT ANIMATIONS =====
function startAgentAnimations() {
    // Randomly move agents occasionally
    setInterval(() => {
        const agents = document.querySelectorAll('.pixel-agent');
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        if (randomAgent) {
            randomAgent.classList.remove('idle-anim');
            randomAgent.classList.add('walking');
            setTimeout(() => {
                randomAgent.classList.remove('walking');
                randomAgent.classList.add('idle-anim');
            }, 2000);
        }
    }, 4000);

    // Randomly update agent status
    setInterval(() => {
        const statuses = ['working', 'meeting', 'idle'];
        const randomIdx = Math.floor(Math.random() * state.agents.length);
        const agent = state.agents[randomIdx];
        if (agent) {
            agent.status = statuses[Math.floor(Math.random() * statuses.length)];
            // Update badge in grid
            const el = document.querySelector(`[data-agent-id="${agent.id}"] .agent-status-badge`);
            if (el) {
                el.className = `agent-status-badge ${agent.status}`;
            }
        }
    }, 8000);
}

// ===== TOAST NOTIFICATION =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}
