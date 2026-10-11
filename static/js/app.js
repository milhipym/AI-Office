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
    office: { grid: { cols: 9, rows: 6 }, rooms: [], furniture: {}, teams: [] },
    activity: {},  // agent id -> latest speech bubble text
    events: [],
    calMonth: null,     // Date: first day of the month on screen
    calSelected: null,  // 'YYYY-MM-DD' or null for "upcoming"
};

const STATUS_TEXT = {
    working: '작업 중',
    meeting: '회의 중',
    idle: '대기 중',
};

// Stroke icons (no emoji anywhere in the UI). Decorative: aria-hidden.
const ICON_PATHS = {
    send: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    trend: '<path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    code: '<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/>',
    link: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.5"/>',
};

function icon(name, size = 16) {
    return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
        + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// Light fill in the staff color with dark text: readable on the bright theme
// whatever the staff color is.
function avatarStyle(color) {
    const c = color || '#94a3b8';
    return `background: color-mix(in srgb, ${c} 28%, #ffffff); border: 2px solid ${c}; color: #1f2430;`;
}

// Initial-letter badge in the staff member's color (replaces emoji icons).
function agentBadge(agent, size = 28) {
    const letter = escapeHtml((agent?.short_name || agent?.name || '?').charAt(0));
    return `<span class="agent-badge" style="width:${size}px;height:${size}px;${avatarStyle(agent?.avatar_color)}">${letter}</span>`;
}

// Furniture chips use the same colors as the 3D models.
const FURNITURE_DISPLAY = {
    desk: { label: '책상', color: '#b07a4a' },
    chair: { label: '의자', color: '#3b5bdb' },
    plant: { label: '화분', color: '#2f9e44' },
    cactus: { label: '선인장', color: '#37b24d' },
    coffee: { label: '커피머신', color: '#8d6e63' },
    bookshelf: { label: '책장', color: '#8b5a2b' },
    sofa: { label: '소파', color: '#1c7c7d' },
    monitor: { label: '모니터', color: '#4a7fd9' },
    bin: { label: '휴지통', color: '#868e96' },
    lamp: { label: '스탠드', color: '#e0a800' },
    whiteboard: { label: '화이트보드', color: '#adb5bd' },
    rug: { label: '러그', color: '#b5651d' },
};

function furnitureChip(fData) {
    return `<span class="furniture-chip"><i style="background:${fData.color}"></i>${escapeHtml(fData.label)}</span>`;
}

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
        const [agentsRes, chatRes, furnitureRes, orgRes, statusRes, metaRes, officeRes] = await Promise.all([
            fetch('/api/agents'),
            fetch('/api/chat'),
            fetch('/api/furniture'),
            fetch('/api/org'),
            fetch('/api/status'),
            fetch('/api/brain/meta'),
            fetch('/api/office'),
        ]);

        state.agents = await agentsRes.json();
        state.chatMessages = await chatRes.json();
        state.furniture = await furnitureRes.json();
        state.orgData = await orgRes.json();
        state.apiStatus = await statusRes.json();
        state.brainMeta = await metaRes.json();
        state.office = await officeRes.json();
        state.placedItems = { ...state.office.furniture };
        document.querySelectorAll('.agent-count').forEach(el => { el.textContent = state.agents.length; });

        renderApiBadge();
        renderOffice();
        renderAgentStatusBar();
        renderChat();
        renderOrgChart();
        renderCustomize();
        initChatInput();
        initOfficeView();
        initBrain();
        loadEntries();
        initCalendar();
        loadEvents();
        startAgentAnimations();
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

function renderApiBadge() {
    const badge = document.getElementById('apiBadge');
    if (!badge) return;
    if (state.apiStatus?.openai_configured) {
        badge.textContent = 'OpenAI 연결됨';
        badge.classList.add('connected');
    } else {
        badge.textContent = 'OPENAI_API_KEY 미설정';
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
function roomAt(col, row) {
    return state.office.rooms.find(r =>
        col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) || null;
}

function cellClass(room) {
    if (!room) return 'hallway';
    return `room-${room.theme}${room.planned ? ' planned' : ''}`;
}

function sizeGrid(grid) {
    const { cols, rows } = state.office.grid;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.setProperty('--grid-cols', cols);
    grid.style.setProperty('--grid-rows', rows);
}

function renderOffice() {
    if (state.officeView === '3d' && state.office3d) {
        state.office3d.update();
        return;
    }
    const grid = document.getElementById('officeGrid');
    grid.innerHTML = '';
    sizeGrid(grid);
    const { cols, rows } = state.office.grid;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const room = roomAt(col, row);
            const cell = document.createElement('div');
            cell.className = `grid-cell ${cellClass(room)}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (room && room.x === col && room.y === row) {
                const label = document.createElement('span');
                label.className = 'room-label';
                label.textContent = room.name;
                cell.appendChild(label);
            }

            const fData = FURNITURE_DISPLAY[state.placedItems[`${col},${row}`]];
            if (fData) {
                cell.insertAdjacentHTML('beforeend', furnitureChip(fData));
            }

            grid.appendChild(cell);
        }
    }

    renderAgentsOnGrid(grid);
}

function renderAgentsOnGrid(grid) {
    const cols = state.office.grid.cols;
    const cells = grid.querySelectorAll('.grid-cell');
    state.agents.forEach(agent => {
        const pos = agent.position;
        const cell = pos && cells[pos.y * cols + pos.x];
        if (!cell) return;

        const bubble = state.activity[agent.id];
        const agentEl = document.createElement('div');
        agentEl.className = `pixel-agent ${agent.status === 'working' ? 'working-anim' : 'idle-anim'}`;
        agentEl.dataset.agentId = agent.id;
        agentEl.innerHTML = `
            ${bubble ? `<div class="speech-bubble"><span>${escapeHtml(bubble)}</span></div>` : ''}
            <div class="agent-body">
                <div class="head" style="background: ${agent.avatar_color}"></div>
                <div class="body-part" style="background: ${agent.avatar_color}; opacity: 0.8"></div>
                <div class="legs">
                    <div class="leg"></div>
                    <div class="leg"></div>
                </div>
                <div class="agent-status-badge ${agent.status}"></div>
            </div>
            <div class="name-tag">${escapeHtml(agent.short_name || agent.name)}</div>
        `;

        agentEl.addEventListener('click', () => showAgentInfo(agent));
        cell.appendChild(agentEl);
        cell.classList.add('has-agent');
        cell.style.overflow = 'visible';
        cell.style.zIndex = '10';
    });
}

// ===== OFFICE VIEW MODE (3D / 2D) =====
// 3D is the default; the 2D grid stays as the fallback when WebGL or the
// three.js CDN is unavailable, and as a lighter option.
function preferredView() {
    try {
        return localStorage.getItem('officeView') || '3d';
    } catch (e) {
        return '3d';
    }
}

function whenOffice3D(timeoutMs = 8000) {
    return new Promise(resolve => {
        if (window.Office3D) return resolve(window.Office3D);
        if (window.office3dFailed) return resolve(null);
        const done = value => {
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => done(null), timeoutMs);
        window.addEventListener('office3d-ready', () => done(window.Office3D), { once: true });
        // Fired by the module script tag when three.js can't be fetched.
        window.addEventListener('office3d-failed', () => done(null), { once: true });
    });
}

async function setOfficeView(mode) {
    const grid = document.getElementById('officeGrid');
    const stage = document.getElementById('office3d');

    if (mode === '3d') {
        const lib = await whenOffice3D();
        if (!lib || !lib.supported) {
            showToast('3D 화면을 불러오지 못해 2D로 표시합니다');
            mode = '2d';
        } else if (!state.office3d) {
            stage.hidden = false;
            try {
                state.office3d = lib.mount(stage, {
                    getState: () => state,
                    onAgentClick: id => showAgentInfo(state.agents.find(a => a.id === id)),
                    escapeHtml,
                });
            } catch (err) {
                console.error('3D office failed:', err);
                showToast('3D 화면 오류로 2D로 표시합니다');
                mode = '2d';
            }
        }
    }

    stage.hidden = mode !== '3d';
    grid.hidden = mode === '3d';
    state.officeView = mode;
    renderOffice();
    document.getElementById('viewToggle').textContent = mode === '3d' ? '2D로 보기' : '3D로 보기';
    document.getElementById('resetView').hidden = mode !== '3d';
    document.getElementById('officeHint').textContent = mode === '3d'
        ? '드래그: 회전 · 휠/핀치: 확대 · 직원 클릭: 정보'
        : '직원 클릭: 정보';
}

function initOfficeView() {
    document.getElementById('viewToggle').addEventListener('click', () => {
        const next = state.officeView === '3d' ? '2d' : '3d';
        try {
            localStorage.setItem('officeView', next);
        } catch (e) { /* preference is optional */ }
        setOfficeView(next);
    });
    document.getElementById('resetView').addEventListener('click', () => state.office3d?.resetView());
    setOfficeView(preferredView());
}

// Show what an agent is doing in the office, the status bar and the chat sidebar.
function setAgentActivity(agentId, status, text) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;
    agent.status = status;
    if (text) state.activity[agentId] = text;
    renderOffice();
    renderAgentStatusBar();
    renderChatSidebar();
}

// First meaningful line of a markdown reply, short enough for a speech bubble.
function bubbleSummary(markdown) {
    const line = (markdown || '').split('\n')
        .map(l => l.replace(/[#*_`>|]/g, '').replace(/\[#?\d+\]/g, '').trim())
        .find(l => l && !/^[-\s]+$/.test(l)) || '완료';
    return line.length > 26 ? line.slice(0, 25) + '…' : line;
}

function showAgentInfo(agent) {
    const panel = document.getElementById('agentInfoPanel');
    const body = document.getElementById('panelBody');
    const team = state.office.teams.find(t => t.id === agent.team);
    const command = (agent.commands || [])[0];

    state.selectedAgent = agent;

    body.innerHTML = `
        <div class="agent-detail">
            <div class="agent-detail-header">
                <div class="agent-avatar-lg" style="${avatarStyle(agent.avatar_color)}">
                    ${escapeHtml(agent.name.charAt(0))}
                </div>
                <div>
                    <div class="agent-detail-name">${escapeHtml(agent.name)}</div>
                    <div class="agent-detail-role">${escapeHtml(team ? team.name + ' · ' : '')}${escapeHtml(agent.role)}</div>
                </div>
            </div>
            <div class="agent-status-label ${agent.status}">
                <i class="status-dot-inline ${agent.status}"></i>${STATUS_TEXT[agent.status]}
            </div>
            <div class="agent-detail-desc">${escapeHtml(agent.description)}</div>
            <div class="agent-detail-meta">
                <div>모델 <code>${escapeHtml(agent.model)}</code></div>
                ${command
                    ? `<div>호출 <code>/${escapeHtml(command)}</code></div>`
                    : '<div>명령 없이 보낸 메시지를 자동으로 받습니다</div>'}
                ${agent.example ? `<div class="agent-detail-example">예) ${escapeHtml(agent.example)}</div>` : ''}
            </div>
            <div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">스킬</div>
                <div class="agent-skills">
                    ${agent.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
                </div>
            </div>
            ${command ? `<button class="brain-btn assign-btn" data-command="/${escapeAttr(command)} ">업무 지시하기</button>` : ''}
        </div>
    `;

    const assign = body.querySelector('.assign-btn');
    if (assign) {
        assign.addEventListener('click', () => {
            document.querySelector('.nav-tab[data-tab="chat"]').click();
            const input = document.getElementById('chatInput');
            input.value = assign.dataset.command;
            input.focus();
        });
    }

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
            <div class="agent-avatar-sm" style="${avatarStyle(agent.avatar_color)}">
                ${escapeHtml(agent.name.charAt(0))}
            </div>
            <div class="agent-card-info">
                <div class="agent-card-name">${escapeHtml(agent.name)}</div>
                <div class="agent-card-role">${escapeHtml(agent.role)}</div>
                <div class="agent-card-status">
                    <span class="status-dot ${agent.status === 'working' ? 'online' : ''}"></span>
                    <i class="status-dot-inline ${agent.status}"></i>${STATUS_TEXT[agent.status]}
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
            <div class="chat-agent-avatar" style="${avatarStyle(agent.avatar_color)}">
                ${escapeHtml(agent.name.charAt(0))}
                <span class="mini-dot" style="background: ${agent.status === 'working' ? 'var(--accent-green)' : 'var(--text-secondary)'}"></span>
            </div>
            <div>
                <div class="chat-agent-name">${escapeHtml(agent.name)}</div>
                <div class="chat-agent-role">${escapeHtml(agent.role)}</div>
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
    avatar.style.cssText = avatarStyle(isUser ? '#5b4bc4' : agent?.avatar_color);
    avatar.textContent = isUser ? '나' : (agent?.name?.charAt(0) || '?');

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'chat-msg-content';

    // Header
    const header = document.createElement('div');
    header.className = 'chat-msg-header';
    header.innerHTML = `
        <span class="chat-msg-name">${isUser ? '대표 (나)' : escapeHtml(agent?.name || msg.agent || 'Unknown')}</span>
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
                    <a href="${escapeAttr(img.url)}" target="_blank" rel="noopener" class="chat-image-download">원본 열기 ${icon('link', 12)}</a>
                </figcaption>
            `;
            imgWrap.appendChild(fig);
        });
        content.appendChild(imgWrap);
    }

    // Citations (web search results)
    if (msg.citations && msg.citations.length > 0) {
        const citWrap = document.createElement('div');
        citWrap.className = 'citation-list';
        citWrap.innerHTML = `<div class="citation-title">${icon('book', 14)} 출처</div>`;
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
                ${meta.filename ? icon('file', 13) + ' ' + escapeHtml(meta.filename) : icon('code', 13) + ' ' + escapeHtml(meta.language || 'code')}
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
                btn.textContent = '복사됨';
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

    const COMMAND_LIST = state.agents
        .filter(a => (a.commands || []).length)
        .map(a => ({ id: a.commands[0], name: a.name, role: a.role, icon: agentBadge(a, 30) }));

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

    const updateCommandDropdown = () => {
        const value = input.value;
        const slashMatch = value.match(/^\/(\S*)$/);
        if (slashMatch) {
            const filtered = COMMAND_LIST.filter(c => c.id.startsWith(slashMatch[1]));
            if (filtered.length) showDropdown(filtered, '/');
            else dropdown.classList.remove('open');
            return;
        }
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
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
        const guessed = guessAgent(message);
        setAgentActivity(guessed, 'working', guessed === 'dispatcher' ? '담당자 찾는 중…' : '작업 중…');
        const loadingMsg = {
            agent: guessed,
            message: '_작업 중..._',
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

            const ai = data.ai_response;
            const agentName = state.agents.find(a => a.id === ai.agent)?.name || ai.agent;
            if (guessed !== ai.agent) setAgentActivity(guessed, 'idle');
            if (ai.metadata?.routed_by === 'classifier') {
                setAgentActivity('dispatcher', 'idle', `${agentName}에게 배정`);
            }
            setAgentActivity(ai.agent, 'idle', bubbleSummary(ai.message));
            showToast(`${agentName} 응답 완료`);
            if (ai.metadata?.brain_refresh) loadEntries();
            if (ai.metadata?.calendar_refresh) loadEvents();
        } catch (err) {
            console.error('Send failed:', err);
            state.chatMessages = state.chatMessages.filter(m => !m._loading);
            setAgentActivity(guessed, 'idle', '전송 실패');
            state.chatMessages.push({
                agent: 'dispatcher',
                message: `메시지 전송 실패: ${err.message}`,
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
    input.addEventListener('input', updateCommandDropdown);
}

// Which staff member will most likely answer, so the office shows them working.
function guessAgent(message) {
    const command = message.trim().match(/^\/(\S+)/);
    if (command) {
        const name = command[1].toLowerCase();
        const agent = state.agents.find(a => (a.commands || []).some(c => c.toLowerCase() === name));
        if (agent) return agent.id;
    }
    return 'dispatcher';
}

// ===== SECOND BRAIN =====
async function loadEntries() {
    try {
        const [entriesRes, metaRes] = await Promise.all([fetch('/api/entries'), fetch('/api/brain/meta')]);
        state.entries = await entriesRes.json();
        state.brainMeta = await metaRes.json();
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
    document.getElementById('brainStats').addEventListener('click', async (e) => {
        const btn = e.target.closest('#reembedBtn');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = '검색 인덱스 갱신 중…';
        try {
            const res = await fetch('/api/brain/reembed', { method: 'POST' });
            const data = await res.json();
            showToast(res.ok ? `${data.updated}건 갱신 완료` : `갱신 실패: ${data.error}`);
        } catch (err) {
            showToast(`갱신 실패: ${err.message}`);
        }
        loadEntries();
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
        <span>성과 후보 <b>${achievements}</b>건</span>
        <span>표시 중 <b>${filtered.length}</b>건</span>
        ${state.brainMeta.stale_embeddings > 0 ? `
            <button class="brain-btn warn" id="reembedBtn"
                    title="임베딩이 없거나 다른 임베딩 모델로 만든 기록입니다. 갱신 전까지는 키워드로만 검색됩니다.">
                ${icon('alert', 14)} 검색 인덱스 갱신 필요 ${state.brainMeta.stale_embeddings}건 · 갱신
            </button>` : ''}
        <span class="brain-models" title="에이전트별 모델 (.env에서 변경)">
            모델: 기록 ${escapeHtml(models.archivist || '')} · 검색 ${escapeHtml(models.finder || '')} · 보고 ${escapeHtml(models.reporter || '')} · 성과 ${escapeHtml(models.coach || '')} · 임베딩 ${escapeHtml(models.embedding || '')}
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
                    <span class="entry-kind ${e.kind}">${e.kind === 'meeting' ? '회의록' : '기록'}</span>
                    <span class="entry-category">${escapeHtml(e.category)}</span>
                    <span class="entry-title">${escapeHtml(e.title)}${d.achievement ? ' <span class="achievement-tag">성과</span>' : ''}</span>
                    <span class="entry-id">#${e.id}</span>
                    <button class="entry-delete" data-id="${e.id}" title="삭제" aria-label="삭제">${icon('close', 14)}</button>
                </div>
                ${e.summary ? `<div class="entry-summary">${escapeHtml(e.summary)}</div>` : ''}
                ${d.impact ? `<div class="entry-impact">${icon('trend', 14)} ${escapeHtml(d.impact)}</div>` : ''}
                ${decisions ? `<div class="entry-section"><b>결정사항</b><ul>${decisions}</ul></div>` : ''}
                ${actions ? `<div class="entry-section"><b>액션 아이템</b><ul>${actions}</ul></div>` : ''}
                ${(e.tags || []).length ? `<div class="entry-tags">${e.tags.map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                <details class="entry-raw"><summary>원문</summary><pre>${escapeHtml(e.content)}</pre></details>
            </article>`;
    }).join('');
}

// ===== CALENDAR =====
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const UPCOMING_DAYS = 14;

// Local-date ISO string. toISOString() would shift dates across the UTC line.
function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

async function loadEvents() {
    try {
        const res = await fetch('/api/events');
        state.events = await res.json();
        renderCalendar();
    } catch (err) {
        console.error('Failed to load events:', err);
    }
}

function initCalendar() {
    const now = new Date();
    state.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const shift = n => {
        state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + n, 1);
        renderCalendar();
    };
    document.getElementById('calPrev').addEventListener('click', () => shift(-1));
    document.getElementById('calNext').addEventListener('click', () => shift(1));
    document.getElementById('calToday').addEventListener('click', () => {
        const t = new Date();
        state.calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
        state.calSelected = null;
        renderCalendar();
    });
    document.getElementById('calShowUpcoming').addEventListener('click', () => {
        state.calSelected = null;
        renderCalendar();
    });
    document.getElementById('calAdd').addEventListener('click', () => {
        document.querySelector('.nav-tab[data-tab="chat"]').click();
        const input = document.getElementById('chatInput');
        input.value = '/일정 ';
        input.focus();
    });
    document.getElementById('calGrid').addEventListener('click', (e) => {
        const cell = e.target.closest('.cal-cell');
        if (!cell) return;
        state.calSelected = cell.dataset.date;
        renderCalendar();
    });
    document.getElementById('calSideList').addEventListener('click', async (e) => {
        const btn = e.target.closest('.cal-delete');
        if (!btn) return;
        if (!confirm('이 일정을 삭제할까요?')) return;
        const res = await fetch(`/api/events/${btn.dataset.id}`, { method: 'DELETE' });
        if (res.ok) {
            state.events = state.events.filter(ev => String(ev.id) !== btn.dataset.id);
            renderCalendar();
            showToast('일정 삭제됨');
        }
    });
}

function eventsByDate() {
    const map = {};
    state.events.forEach(ev => { (map[ev.event_date] ||= []).push(ev); });
    return map;
}

function eventTime(ev) {
    if (!ev.start_time) return ev.kind === 'deadline' ? '마감' : '종일';
    return ev.end_time ? `${ev.start_time}~${ev.end_time}` : ev.start_time;
}

function renderCalendar() {
    const grid = document.getElementById('calGrid');
    if (!grid || !state.calMonth) return;

    const month = state.calMonth;
    document.getElementById('calTitle').textContent = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

    const today = isoDate(new Date());
    const byDate = eventsByDate();
    // Monday-first grid, 6 weeks.
    const offset = (month.getDay() + 6) % 7;
    const start = addDays(month, -offset);

    let html = '';
    for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const iso = isoDate(d);
        const events = byDate[iso] || [];
        const classes = ['cal-cell'];
        if (d.getMonth() !== month.getMonth()) classes.push('other');
        if (iso === today) classes.push('today');
        if (iso === state.calSelected) classes.push('selected');
        if (d.getDay() === 0) classes.push('sun');
        if (d.getDay() === 6) classes.push('sat');
        const chips = events.slice(0, 3).map(ev => `
            <div class="cal-chip ${ev.kind}" title="${escapeAttr(eventTime(ev) + ' ' + ev.title)}">
                ${ev.start_time ? `<b>${escapeHtml(ev.start_time)}</b> ` : ''}${escapeHtml(ev.title)}
            </div>`).join('');
        const more = events.length > 3 ? `<div class="cal-more">+${events.length - 3}</div>` : '';
        html += `<div class="${classes.join(' ')}" data-date="${iso}">
            <span class="cal-day">${d.getDate()}</span>${chips}${more}</div>`;
    }
    grid.innerHTML = html;
    renderCalendarSide(byDate, today);
}

function renderCalendarSide(byDate, today) {
    const title = document.getElementById('calSideTitle');
    const list = document.getElementById('calSideList');
    const upcomingBtn = document.getElementById('calShowUpcoming');

    let events;
    if (state.calSelected) {
        const d = new Date(state.calSelected + 'T00:00:00');
        title.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`;
        events = byDate[state.calSelected] || [];
        upcomingBtn.hidden = false;
    } else {
        const until = isoDate(addDays(new Date(), UPCOMING_DAYS - 1));
        title.textContent = `다가오는 일정 · ${UPCOMING_DAYS}일`;
        events = state.events.filter(ev => ev.event_date >= today && ev.event_date <= until);
        upcomingBtn.hidden = true;
    }

    if (!events.length) {
        list.innerHTML = `<div class="brain-empty">일정이 없습니다.<br><code>/일정 다음주 화요일 15시 보안 점검</code><br>또는 기록·회의록에 앞으로의 일정을 적으면 자동으로 올라옵니다.</div>`;
        return;
    }

    let lastDate = null;
    list.innerHTML = events.map(ev => {
        const d = new Date(ev.event_date + 'T00:00:00');
        const header = !state.calSelected && ev.event_date !== lastDate
            ? `<div class="cal-side-date ${ev.event_date === today ? 'today' : ''}">${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_KO[d.getDay()]})${ev.event_date === today ? ' · 오늘' : ''}</div>`
            : '';
        lastDate = ev.event_date;
        return `${header}
            <div class="cal-item ${ev.kind}">
                <div class="cal-item-time">${escapeHtml(eventTime(ev))}</div>
                <div class="cal-item-body">
                    <div class="cal-item-title">${escapeHtml(ev.title)}</div>
                    ${ev.location ? `<div class="cal-item-loc">${icon('pin', 12)} ${escapeHtml(ev.location)}</div>` : ''}
                </div>
                <a class="cal-ics" href="/api/events/${ev.id}.ics" download title="이 일정만 .ics로 받기" aria-label="이 일정 .ics 받기">${icon('download', 15)}</a>
                <button class="cal-delete entry-delete" data-id="${ev.id}" title="삭제" aria-label="삭제">${icon('close', 14)}</button>
            </div>`;
    }).join('');
}

// ===== ORG CHART =====
function renderOrgChart() {
    const chart = document.getElementById('orgChart');
    if (!state.orgData) return;

    const { ceo, direct, teams } = state.orgData;

    chart.innerHTML = `
        <div class="org-level">
            <div class="org-card ceo" style="border-color: ${ceo.color}">
                <div class="org-card-title">${escapeHtml(ceo.title)}</div>
                <div class="org-card-name">${escapeHtml(ceo.name)}</div>
            </div>
        </div>

        <div class="org-connector"></div>

        <div class="org-level">
            ${direct.map(d => `
                <div class="org-card direct" style="border-left-color: ${d.color}">
                    <div class="org-card-title">${escapeHtml(d.title)}</div>
                    <div class="org-card-name">${escapeHtml(d.name)}</div>
                    <div class="org-card-desc">${escapeHtml(d.desc)}</div>
                </div>
            `).join('')}
        </div>

        <div class="org-connector"></div>

        <div class="org-teams">
            ${teams.map(team => `
                <div class="org-team-card ${team.planned ? 'planned' : ''}">
                    <div class="org-team-header" style="background: ${team.color}10; border-bottom-color: ${team.color}40">
                        <span class="org-team-name">${escapeHtml(team.name)}${team.planned ? ' <span class="planned-badge">준비 중</span>' : ''}</span>
                        <span class="org-team-code" style="background: ${team.color}">${escapeHtml(team.code)}</span>
                    </div>
                    <div class="org-team-desc">${escapeHtml(team.desc)}</div>
                    <div class="org-team-agents">
                        ${team.agents.map(a => `<span class="org-agent-badge">${escapeHtml(a)}</span>`).join('')}
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
        const display = FURNITURE_DISPLAY[item.icon] || { color: '#adb5bd', label: item.name };
        return `
            <div class="furniture-item ${state.selectedFurniture === item.id ? 'selected' : ''}" data-id="${item.id}">
                <div class="furniture-icon"><i style="background:${display.color}"></i></div>
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
    sizeGrid(grid);
    const { cols, rows } = state.office.grid;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const room = roomAt(col, row);
            const cell = document.createElement('div');
            const key = `${col},${row}`;
            const hasItem = state.placedItems[key];

            cell.className = `customize-cell ${cellClass(room)} ${hasItem ? 'has-item' : ''}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            const fData = FURNITURE_DISPLAY[hasItem];
            if (fData) {
                cell.innerHTML = furnitureChip(fData);
            }

            cell.addEventListener('click', () => {
                if (state.selectedFurniture) {
                    state.placedItems[key] = state.selectedFurniture;
                    renderCustomizeGrid();
                    showToast(`${FURNITURE_DISPLAY[state.selectedFurniture]?.label || '아이템'} 배치 완료!`);
                } else if (hasItem) {
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
// Idle staff occasionally stretch their legs; status only changes on real work.
function startAgentAnimations() {
    setInterval(() => {
        const agents = document.querySelectorAll('.pixel-agent.idle-anim');
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
