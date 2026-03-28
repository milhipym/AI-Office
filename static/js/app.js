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
};

// ===== PIXEL ART CHARACTERS (CSS-based) =====
const AGENT_EMOJIS = {
    claude: '🟣',
    manus: '🔵',
    sonnet: '🟪',
    gemini: '🟡',
    chatgpt: '🟢',
    perplexity: '🔮',
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
    initTabs();
    loadData();
});

async function loadData() {
    try {
        const [agentsRes, chatRes, furnitureRes, orgRes] = await Promise.all([
            fetch('/api/agents'),
            fetch('/api/chat'),
            fetch('/api/furniture'),
            fetch('/api/org'),
        ]);

        state.agents = await agentsRes.json();
        state.chatMessages = await chatRes.json();
        state.furniture = await furnitureRes.json();
        state.orgData = await orgRes.json();
        state.placedItems = { ...DEFAULT_FURNITURE };

        renderOffice();
        renderAgentStatusBar();
        renderChat();
        renderOrgChart();
        renderCustomize();
        initChatInput();
        startAgentAnimations();
    } catch (err) {
        console.error('Failed to load data:', err);
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
            <div class="name-tag">${agent.name.split(' ')[0]}</div>
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
        const agent = state.agents.find(a => a.id === msg.agent);
        const isUser = msg.agent === 'user';

        const el = document.createElement('div');
        el.className = `chat-message ${isUser ? 'user' : ''}`;
        el.innerHTML = `
            <div class="chat-msg-avatar" style="background: ${isUser ? '#ef4444' : (agent?.avatar_color || '#666')}">
                ${isUser ? '나' : (agent?.name.charAt(0) || '?')}
            </div>
            <div class="chat-msg-content">
                <div class="chat-msg-header">
                    <span class="chat-msg-name">${isUser ? '대표 (나)' : (agent?.name || 'Unknown')}</span>
                    <span class="chat-msg-time">${msg.time}</span>
                    <span class="chat-msg-type ${msg.type}">${getTypeLabel(msg.type)}</span>
                </div>
                <div class="chat-msg-text">${msg.message}</div>
            </div>
        `;

        container.appendChild(el);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
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

    const send = async () => {
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await res.json();

            state.chatMessages.push(data.user_message);
            renderChatMessages();

            // Simulate typing delay for AI response
            setTimeout(() => {
                state.chatMessages.push(data.ai_response);
                renderChatMessages();
                showToast('AI 직원이 응답했습니다');
            }, 800 + Math.random() * 1200);
        } catch (err) {
            console.error('Send failed:', err);
            showToast('메시지 전송에 실패했습니다');
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send();
    });
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
