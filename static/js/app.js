/**
 * AI Office - Pixel Art RPG Style Virtual Office
 * Canvas-based isometric office with animated AI agent characters
 * All AI powered by OpenAI API
 */

// ===== CONSTANTS =====
const TILE_SIZE = 48;
const COLS = 14;
const ROWS = 10;
const CANVAS_W = COLS * TILE_SIZE;  // 672
const CANVAS_H = ROWS * TILE_SIZE;  // 480
const DPR = window.devicePixelRatio || 1;

// ===== STATE =====
const state = {
    agents: [],
    chatMessages: [],
    furniture: [],
    orgData: null,
    tasks: [],
    selectedAgent: null,
    selectedFurniture: null,
    activeCategory: '전체',
    activeTaskFilter: 'all',
    placedItems: {},
    layout: [],           // loaded from backend — replaces hardcoded OFFICE_LAYOUT
    editMode: 'furniture', // 'furniture' | 'room'
    selectedRoomType: 'main',
    lastMsgId: 0,
};

const STATUS_TEXT = { working: '작업 중', meeting: '회의 중', idle: '대기 중' };
const STATUS_ICONS = { working: '💻', meeting: '🤝', idle: '☕' };

// ===== OFFICE LAYOUT =====
// 14 cols × 10 rows — room for up to ~50 employees
const OFFICE_LAYOUT = [
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','hall','meet','meet','meet','hall','exec','exec','exec','wall'],
    ['wall','wall','hall','wall','wall','hall','wall','hall','wall','hall','wall','hall','wall','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
];

const ROOM_CLASSES = {
    wall: 'wall', main: 'room-main', meet: 'room-meeting',
    cont: 'room-content', dev: 'room-dev', hall: 'hallway',
    exec: 'room-exec', acad: 'room-acad',
};

const ROOM_NAMES = {
    main: '메인 오피스', meet: '회의실', cont: '콘텐츠 팀룸',
    dev: '개발 팀룸', exec: '임원실', acad: '교육 팀룸',
};

// Tile colors for canvas
const TILE_COLORS = {
    wall: '#7a7a8a',
    main: '#d8d0c0',
    meet: '#c8c0d8',
    cont: '#c0d8c8',
    dev:  '#c8d8e0',
    hall: '#b0b0c0',
    exec: '#d8c0a0',
    acad: '#d0c8d8',
};

const WALL_TOP_COLOR = '#5a5a6a';
const WALL_SHADOW = '#4a4a5a';
const GRID_LINE = 'rgba(0,0,0,0.08)';

// Default furniture placements (col,row) — new 14×10 grid
const DEFAULT_FURNITURE = {
    // Main office (cols 1-4, rows 1-3)
    '1,1': 'desk',  '2,1': 'monitor',    '3,1': 'bookshelf', '4,1': 'plant',
    '1,2': 'chair', '2,2': 'desk',       '3,2': 'monitor',
    '1,3': 'plant', '2,3': 'chair',      '3,3': 'desk',      '4,3': 'monitor',
    // Meeting room (cols 6-8, rows 1-3)
    '6,1': 'whiteboard', '8,1': 'plant',
    '6,2': 'sofa',       '7,2': 'sofa',
    '7,3': 'chair',      '8,3': 'chair',
    // Exec room (cols 10-12, rows 1-3)
    '10,1': 'desk',  '11,1': 'monitor',  '12,1': 'plant',
    '10,2': 'chair', '11,2': 'bookshelf','12,2': 'lamp',
    '10,3': 'sofa',  '12,3': 'plant',
    // Dev team (cols 1-4, rows 5-8)
    '1,5': 'desk',  '2,5': 'monitor',    '3,5': 'desk',  '4,5': 'monitor',
    '1,6': 'chair', '3,6': 'chair',      '4,6': 'plant',
    '1,7': 'desk',  '2,7': 'monitor',    '3,7': 'desk',  '4,7': 'monitor',
    '1,8': 'chair', '2,8': 'plant',      '3,8': 'chair', '4,8': 'coffee',
    // Content team (cols 6-8, rows 5-8)
    '6,5': 'desk',  '7,5': 'monitor',    '8,5': 'plant',
    '6,6': 'chair', '7,6': 'desk',       '8,6': 'monitor',
    '6,7': 'chair', '7,7': 'plant',
    '6,8': 'desk',  '7,8': 'monitor',    '8,8': 'chair',
    // Academy (cols 10-12, rows 5-8)
    '10,5': 'desk',  '11,5': 'monitor',  '12,5': 'plant',
    '10,6': 'chair', '11,6': 'bookshelf','12,6': 'lamp',
    '10,7': 'desk',  '11,7': 'monitor',
    '10,8': 'chair', '11,8': 'plant',    '12,8': 'coffee',
};

const FURNITURE_DISPLAY = {
    desk: { emoji: '🪑', label: '책상' },
    chair: { emoji: '💺', label: '의자' },
    plant: { emoji: '🌿', label: '화분' },
    cactus: { emoji: '🌵', label: '선인장' },
    coffee: { emoji: '☕', label: '커피머신' },
    bookshelf: { emoji: '📚', label: '책장' },
    sofa: { emoji: '🛋️', label: '소파' },
    monitor: { emoji: '🖥️', label: '모니터' },
    bin: { emoji: '🗑️', label: '휴지통' },
    lamp: { emoji: '💡', label: '스탠드' },
    whiteboard: { emoji: '📋', label: '화이트보드' },
    rug: { emoji: '🟫', label: '러그' },
    clock: { emoji: '🕐', label: '벽시계' },
    picture: { emoji: '🖼️', label: '액자' },
};

// Generate a small canvas thumbnail of a furniture item for the sidebar
function createFurnitureThumbnail(type) {
    const size = 40;
    const c = document.createElement('canvas');
    c.width = Math.round(size * DPR);
    c.height = Math.round(size * DPR);
    c.style.width = size + 'px';
    c.style.height = size + 'px';
    const tctx = c.getContext('2d');
    tctx.scale(DPR, DPR);
    tctx.imageSmoothingEnabled = false;
    // Temporarily override TILE_SIZE for thumbnail rendering
    const origTile = TILE_SIZE;
    // Draw centered in 40x40
    drawFurniturePixel(tctx, type, (size - origTile) / 2, (size - origTile) / 2);
    return c;
}

// ===== PIXEL ART CHARACTER SPRITES =====
// Each character is drawn procedurally on canvas as a pixel art sprite
// Colors define skin, hair, shirt for each agent

const AGENT_SPRITES = {};  // Will be populated after agents load

// Hair style index per agent (varies look)
const HAIR_STYLES = ['short', 'messy', 'long', 'ponytail', 'buzz', 'parted', 'wavy', 'spiky'];

function createAgentColors(agent) {
    const colorMap = {
        '#8B5CF6': { hair: '#4a2d8a', shirt: '#8B5CF6', pants: '#3a3a5a', skin: '#f5d0a9', hairStyle: 'messy' },
        '#3B82F6': { hair: '#1e3a6a', shirt: '#3B82F6', pants: '#2a3a5a', skin: '#f5d0a9', hairStyle: 'short' },
        '#A78BFA': { hair: '#6a4aa0', shirt: '#A78BFA', pants: '#4a3a6a', skin: '#f0c8a0', hairStyle: 'long' },
        '#F59E0B': { hair: '#5a3a00', shirt: '#F59E0B', pants: '#5a4a3a', skin: '#e8c0a0', hairStyle: 'ponytail' },
        '#10B981': { hair: '#1a3a1a', shirt: '#10B981', pants: '#3a4a3a', skin: '#d8b898', hairStyle: 'buzz' },
        '#6366F1': { hair: '#2a2a6a', shirt: '#6366F1', pants: '#3a3a6a', skin: '#f0c8a0', hairStyle: 'parted' },
        '#06B6D4': { hair: '#2a3a4a', shirt: '#06B6D4', pants: '#3a4050', skin: '#f5d0a9', hairStyle: 'spiky' },
        '#EF4444': { hair: '#5a2020', shirt: '#EF4444', pants: '#4a3a3a', skin: '#f0c8a0', hairStyle: 'wavy' },
        '#EC4899': { hair: '#4a1a3a', shirt: '#EC4899', pants: '#4a3a4a', skin: '#f5d0a9', hairStyle: 'long' },
    };
    return colorMap[agent.avatar_color] || {
        hair: '#333', shirt: agent.avatar_color, pants: '#444', skin: '#f5d0a9',
        hairStyle: HAIR_STYLES[Math.abs(hashCode(agent.id)) % HAIR_STYLES.length]
    };
}

function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
}

// Draw a pixel art character frame on a given offscreen canvas context
function drawCharacterSprite(ctx, colors, direction, frame, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const cx = Math.floor(w / 2);
    const legOff = frame % 2 === 0 ? 0 : 1;
    const armOff = frame % 2 === 0 ? -1 : 1;
    const hs = colors.hairStyle || 'short';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, h - 2, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // === LEGS & SHOES ===
    const legY = h - 11;
    ctx.fillStyle = colors.pants;
    ctx.fillRect(cx - 4, legY - legOff, 3, 9 + legOff);
    ctx.fillRect(cx + 1, legY + legOff, 3, 9 - legOff);
    // Shoes
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 5, h - 3 - legOff, 4, 3);
    ctx.fillRect(cx + 1, h - 3 + legOff, 4, 3);
    // Shoe highlight
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 5, h - 3 - legOff, 4, 1);
    ctx.fillRect(cx + 1, h - 3 + legOff, 4, 1);

    // === BODY / SHIRT ===
    const bodyY = legY - 10;
    ctx.fillStyle = colors.shirt;
    ctx.fillRect(cx - 6, bodyY, 12, 12);
    // Shirt shade (right side)
    const shirtShade = darken(colors.shirt, 20);
    ctx.fillStyle = shirtShade;
    ctx.fillRect(cx + 3, bodyY + 1, 3, 10);
    // Shirt highlight (left)
    const shirtHi = lighten(colors.shirt, 20);
    ctx.fillStyle = shirtHi;
    ctx.fillRect(cx - 5, bodyY + 1, 2, 6);
    // Collar
    ctx.fillStyle = lighten(colors.shirt, 40);
    ctx.fillRect(cx - 3, bodyY, 6, 2);

    // === ARMS ===
    ctx.fillStyle = colors.shirt;
    ctx.fillRect(cx - 9, bodyY + 1 + armOff, 4, 8);
    ctx.fillRect(cx + 5, bodyY + 1 - armOff, 4, 8);
    // Arm shade
    ctx.fillStyle = shirtShade;
    ctx.fillRect(cx + 7, bodyY + 2 - armOff, 2, 6);
    // Hands
    ctx.fillStyle = colors.skin;
    ctx.fillRect(cx - 9, bodyY + 8 + armOff, 3, 3);
    ctx.fillRect(cx + 6, bodyY + 8 - armOff, 3, 3);

    // === HEAD ===
    const headY = bodyY - 12;
    ctx.fillStyle = colors.skin;
    ctx.fillRect(cx - 6, headY, 12, 12);
    // Face shadow (right)
    const skinShade = darken(colors.skin, 15);
    ctx.fillStyle = skinShade;
    ctx.fillRect(cx + 3, headY + 2, 3, 8);
    // Cheek blush
    ctx.fillStyle = 'rgba(220,120,100,0.2)';
    ctx.fillRect(cx - 5, headY + 7, 2, 2);
    ctx.fillRect(cx + 3, headY + 7, 2, 2);

    // === HAIR ===
    ctx.fillStyle = colors.hair;
    const hairHi = lighten(colors.hair, 30);

    switch (hs) {
        case 'short':
            ctx.fillRect(cx - 7, headY - 2, 14, 6);
            ctx.fillRect(cx - 7, headY + 2, 2, 4);
            ctx.fillRect(cx + 5, headY + 2, 2, 4);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 5, headY - 1, 6, 2);
            break;
        case 'messy':
            ctx.fillRect(cx - 7, headY - 3, 15, 7);
            ctx.fillRect(cx - 8, headY - 1, 2, 4);
            ctx.fillRect(cx + 6, headY, 2, 3);
            ctx.fillRect(cx + 5, headY - 4, 3, 3);
            ctx.fillRect(cx - 6, headY - 4, 3, 2);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 4, headY - 2, 4, 2);
            break;
        case 'long':
            ctx.fillRect(cx - 7, headY - 2, 14, 6);
            ctx.fillRect(cx - 8, headY + 2, 3, 10);
            ctx.fillRect(cx + 5, headY + 2, 3, 10);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 5, headY - 1, 6, 2);
            break;
        case 'ponytail':
            ctx.fillRect(cx - 7, headY - 2, 14, 6);
            ctx.fillRect(cx + 4, headY - 4, 4, 4);
            ctx.fillRect(cx + 6, headY - 2, 3, 12);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 4, headY - 1, 5, 2);
            break;
        case 'buzz':
            ctx.fillRect(cx - 6, headY - 1, 12, 4);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 4, headY, 8, 1);
            break;
        case 'parted':
            ctx.fillRect(cx - 7, headY - 2, 6, 6);
            ctx.fillRect(cx + 1, headY - 2, 6, 5);
            ctx.fillRect(cx - 7, headY + 2, 2, 4);
            ctx.fillRect(cx + 5, headY + 2, 2, 4);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 5, headY - 1, 4, 2);
            break;
        case 'wavy':
            ctx.fillRect(cx - 8, headY - 2, 16, 6);
            ctx.fillRect(cx - 8, headY + 2, 3, 8);
            ctx.fillRect(cx + 5, headY + 2, 3, 7);
            ctx.fillRect(cx - 7, headY + 8, 2, 4);
            ctx.fillRect(cx + 6, headY + 7, 2, 4);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 5, headY - 1, 5, 2);
            break;
        case 'spiky':
            ctx.fillRect(cx - 7, headY - 2, 14, 5);
            ctx.fillRect(cx - 5, headY - 5, 3, 4);
            ctx.fillRect(cx, headY - 6, 3, 5);
            ctx.fillRect(cx + 4, headY - 4, 3, 3);
            ctx.fillStyle = hairHi;
            ctx.fillRect(cx - 4, headY - 4, 2, 2);
            ctx.fillRect(cx + 1, headY - 5, 2, 2);
            break;
        default:
            ctx.fillRect(cx - 7, headY - 2, 14, 6);
    }

    // === FACE ===
    if (direction === 'down' || direction === undefined) {
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 4, headY + 4, 3, 3);
        ctx.fillRect(cx + 1, headY + 4, 3, 3);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 3, headY + 5, 2, 2);
        ctx.fillRect(cx + 2, headY + 5, 2, 2);
        // Pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 3, headY + 5, 1, 1);
        ctx.fillRect(cx + 2, headY + 5, 1, 1);
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 2, headY + 4, 1, 1);
        ctx.fillRect(cx + 3, headY + 4, 1, 1);
        // Mouth
        ctx.fillStyle = '#c07060';
        ctx.fillRect(cx - 1, headY + 9, 3, 1);
    } else if (direction === 'up') {
        ctx.fillStyle = colors.hair;
        ctx.fillRect(cx - 6, headY + 3, 12, 7);
        ctx.fillStyle = lighten(colors.hair, 15);
        ctx.fillRect(cx - 4, headY + 4, 8, 3);
    } else if (direction === 'left') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 4, headY + 4, 3, 3);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 4, headY + 5, 2, 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 4, headY + 5, 1, 1);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 2, headY + 4, 1, 1);
        ctx.fillStyle = '#c07060';
        ctx.fillRect(cx - 3, headY + 9, 2, 1);
        // Side hair
        ctx.fillStyle = colors.hair;
        ctx.fillRect(cx + 3, headY + 2, 3, 6);
    } else if (direction === 'right') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + 1, headY + 4, 3, 3);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 2, headY + 5, 2, 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx + 3, headY + 5, 1, 1);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + 1, headY + 4, 1, 1);
        ctx.fillStyle = '#c07060';
        ctx.fillRect(cx + 1, headY + 9, 2, 1);
        ctx.fillStyle = colors.hair;
        ctx.fillRect(cx - 6, headY + 2, 3, 6);
    }
}

// Color utility helpers for sprite shading
function darken(hex, amt) {
    const c = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (c >> 16) - amt);
    const g = Math.max(0, ((c >> 8) & 0xff) - amt);
    const b = Math.max(0, (c & 0xff) - amt);
    return `rgb(${r},${g},${b})`;
}
function lighten(hex, amt) {
    const c = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (c >> 16) + amt);
    const g = Math.min(255, ((c >> 8) & 0xff) + amt);
    const b = Math.min(255, (c & 0xff) + amt);
    return `rgb(${r},${g},${b})`;
}

// Pre-render all sprite frames for each agent
// Sprites are created at physical pixel resolution (DPR-aware) for crisp rendering
function preRenderAgentSprites() {
    const directions = ['down', 'left', 'right', 'up'];
    const frames = [0, 1, 2, 3];  // 4 animation frames
    const sprW = 26;  // logical width  (fits 48px tile)
    const sprH = 38;  // logical height

    state.agents.forEach(agent => {
        const colors = createAgentColors(agent);
        AGENT_SPRITES[agent.id] = { _w: sprW, _h: sprH };

        directions.forEach(dir => {
            AGENT_SPRITES[agent.id][dir] = [];
            frames.forEach(f => {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = Math.round(sprW * DPR);
                offCanvas.height = Math.round(sprH * DPR);
                const offCtx = offCanvas.getContext('2d');
                offCtx.scale(DPR, DPR);
                offCtx.imageSmoothingEnabled = false;
                drawCharacterSprite(offCtx, colors, dir, f, sprW, sprH);
                AGENT_SPRITES[agent.id][dir].push(offCanvas);
            });
        });

        // Pre-render seated poses (one per direction)
        directions.forEach(dir => {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = Math.round(sprW * DPR);
            offCanvas.height = Math.round(sprH * DPR);
            const offCtx = offCanvas.getContext('2d');
            offCtx.scale(DPR, DPR);
            offCtx.imageSmoothingEnabled = false;
            drawCharacterSitting(offCtx, colors, dir, sprW, sprH);
            AGENT_SPRITES[agent.id]['sit_' + dir] = offCanvas;
        });
    });
}

// Draw a character in sitting pose (shorter legs, no arm swing)
function drawCharacterSitting(ctx, colors, direction, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const cx = Math.floor(w / 2);
    const hs = colors.hairStyle || 'short';

    // No shadow (sitting on chair)
    // === LEGS (bent, shorter) ===
    const legY = h - 6;
    ctx.fillStyle = colors.pants;
    ctx.fillRect(cx - 4, legY - 3, 3, 6);
    ctx.fillRect(cx + 1, legY - 3, 3, 6);
    // Shoes
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 5, h - 2, 4, 2);
    ctx.fillRect(cx + 1, h - 2, 4, 2);

    // === BODY (slightly lower since seated) ===
    const bodyY = legY - 12;
    ctx.fillStyle = colors.shirt;
    ctx.fillRect(cx - 6, bodyY, 12, 11);
    const shirtShade = darken(colors.shirt, 20);
    ctx.fillStyle = shirtShade;
    ctx.fillRect(cx + 3, bodyY + 1, 3, 9);
    const shirtHi = lighten(colors.shirt, 20);
    ctx.fillStyle = shirtHi;
    ctx.fillRect(cx - 5, bodyY + 1, 2, 5);
    // Collar
    ctx.fillStyle = lighten(colors.shirt, 40);
    ctx.fillRect(cx - 3, bodyY, 6, 2);

    // === ARMS (forward, typing pose) ===
    ctx.fillStyle = colors.shirt;
    if (direction === 'down' || direction === 'up') {
        // Arms forward
        ctx.fillRect(cx - 9, bodyY + 3, 4, 6);
        ctx.fillRect(cx + 5, bodyY + 3, 4, 6);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(cx - 9, bodyY + 8, 3, 3);
        ctx.fillRect(cx + 6, bodyY + 8, 3, 3);
    } else {
        // Side view — one arm visible, extended forward
        ctx.fillRect(cx - 7, bodyY + 2, 4, 7);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(cx - 7, bodyY + 8, 3, 3);
    }

    // === HEAD ===
    const headY = bodyY - 11;
    ctx.fillStyle = colors.skin;
    ctx.fillRect(cx - 6, headY, 12, 11);
    const skinShade = darken(colors.skin, 15);
    ctx.fillStyle = skinShade;
    ctx.fillRect(cx + 3, headY + 2, 3, 7);

    // === HAIR (reuse same hair drawing logic) ===
    ctx.fillStyle = colors.hair;
    const hairHi = lighten(colors.hair, 30);
    // Simplified hair for sitting (just top)
    ctx.fillRect(cx - 7, headY - 2, 14, 5);
    if (hs === 'long' || hs === 'wavy') {
        ctx.fillRect(cx - 8, headY + 1, 3, 8);
        ctx.fillRect(cx + 5, headY + 1, 3, 8);
    } else if (hs === 'ponytail') {
        ctx.fillRect(cx + 5, headY - 3, 3, 3);
        ctx.fillRect(cx + 6, headY - 1, 3, 8);
    } else if (hs === 'spiky') {
        ctx.fillRect(cx - 4, headY - 5, 3, 4);
        ctx.fillRect(cx + 1, headY - 4, 3, 3);
    }
    ctx.fillStyle = hairHi;
    ctx.fillRect(cx - 5, headY - 1, 6, 2);

    // === FACE ===
    if (direction === 'down' || direction === undefined) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 4, headY + 3, 3, 3);
        ctx.fillRect(cx + 1, headY + 3, 3, 3);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 3, headY + 4, 2, 2);
        ctx.fillRect(cx + 2, headY + 4, 2, 2);
        ctx.fillStyle = '#c07060';
        ctx.fillRect(cx - 1, headY + 8, 3, 1);
    } else if (direction === 'up') {
        ctx.fillStyle = colors.hair;
        ctx.fillRect(cx - 6, headY + 2, 12, 7);
    } else {
        // Left or right profile
        const ex = direction === 'left' ? cx - 4 : cx + 1;
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex, headY + 3, 3, 3);
        ctx.fillStyle = '#222';
        ctx.fillRect(ex + (direction === 'left' ? 0 : 1), headY + 4, 2, 2);
        ctx.fillStyle = '#c07060';
        ctx.fillRect(ex, headY + 8, 2, 1);
    }
}

// ===== CANVAS DRAWING ENGINE =====
let canvas, ctx;
let animFrame = 0;
let lastTime = 0;
let animTimer = 0;

// Agent animation state
const agentAnims = {};

// Drag-paint flag for room-edit mode (set once at module level)
let _roomPainting = false;
document.addEventListener('mousedown', () => { _roomPainting = true; });
document.addEventListener('mouseup',   () => { _roomPainting = false; });

function initCanvas() {
    canvas = document.getElementById('officeCanvas');
    if (!canvas) return;

    // HiDPI fix: buffer at physical pixel density, CSS fills container
    canvas.style.width = '100%';
    canvas.style.maxWidth = '960px';
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = `${CANVAS_W} / ${CANVAS_H}`;

    canvas.width  = Math.round(CANVAS_W * DPR);
    canvas.height = Math.round(CANVAS_H * DPR);

    ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    ctx.imageSmoothingEnabled = false;

    canvas.addEventListener('click', handleCanvasClick);

    // Start render loop
    requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
    const dt = time - lastTime;
    lastTime = time;
    animTimer += dt;

    // Update animation frame every 300ms
    if (animTimer > 300) {
        animTimer = 0;
        animFrame = (animFrame + 1) % 4;
    }

    // Update agent positions (smooth movement)
    updateAgentPositions(dt);

    // Draw everything
    drawOffice();

    requestAnimationFrame(gameLoop);
}

function drawOffice() {
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw tiles
    for (let row = 0; row < state.layout.length; row++) {
        for (let col = 0; col < state.layout[row].length; col++) {
            const type = state.layout[row][col];
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;

            // Floor tile
            ctx.fillStyle = TILE_COLORS[type] || '#999';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

            if (type === 'wall') {
                // === Wall — clean panel grid like reference ===
                ctx.fillStyle = '#909098';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                // Subtle panel grid (3×3)
                const p = TILE_SIZE / 3;
                ctx.strokeStyle = 'rgba(200,200,210,0.25)';
                ctx.lineWidth = 1;
                for (let gx = 1; gx < 3; gx++) {
                    ctx.beginPath();
                    ctx.moveTo(x + gx * p, y);
                    ctx.lineTo(x + gx * p, y + TILE_SIZE);
                    ctx.stroke();
                }
                for (let gy = 1; gy < 3; gy++) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + gy * p);
                    ctx.lineTo(x + TILE_SIZE, y + gy * p);
                    ctx.stroke();
                }
                // Bottom dark edge (wall base shadow)
                ctx.fillStyle = '#6A6A78';
                ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
                // Top bright edge
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.fillRect(x, y, TILE_SIZE, 1);
            } else {
                // === Floor with subtle tile pattern ===
                const half = TILE_SIZE / 2;
                // Two-tone subtle checkerboard
                ctx.fillStyle = 'rgba(0,0,0,0.018)';
                ctx.fillRect(x, y, half, half);
                ctx.fillRect(x + half, y + half, half, half);
                // Light checkerboard
                ctx.fillStyle = 'rgba(255,255,255,0.015)';
                ctx.fillRect(x + half, y, half, half);
                ctx.fillRect(x, y + half, half, half);
                // Grid lines
                ctx.strokeStyle = 'rgba(0,0,0,0.04)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                // Subtle inner highlight on tile
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 1);
                ctx.fillRect(x + 1, y + 1, 1, TILE_SIZE - 2);
            }
        }
    }

    // Draw room labels (small badge style)
    const labelDrawn = {};
    ctx.font = 'bold 8px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let row = 0; row < state.layout.length; row++) {
        for (let col = 0; col < state.layout[row].length; col++) {
            const type = state.layout[row][col];
            if (ROOM_NAMES[type] && !labelDrawn[type]) {
                const lx = col * TILE_SIZE + 4;
                const ly = row * TILE_SIZE + 3;
                const txt = ROOM_NAMES[type];
                const tw = ctx.measureText(txt).width;
                // Background pill
                ctx.fillStyle = 'rgba(30,30,50,0.55)';
                const bw = tw + 8, bh = 13;
                ctx.fillRect(lx - 2, ly - 1, bw, bh);
                // Text
                ctx.fillStyle = '#e8e8e8';
                ctx.fillText(txt, lx + 2, ly + 2);
                labelDrawn[type] = true;
            }
        }
    }

    // Draw furniture
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '24px serif';

    Object.entries(state.placedItems).forEach(([key, type]) => {
        const [col, row] = key.split(',').map(Number);
        const cellType = state.layout[row]?.[col];
        if (cellType === 'wall') return;

        const fData = FURNITURE_DISPLAY[type];
        if (fData) {
            const x = col * TILE_SIZE + TILE_SIZE / 2;
            const y = row * TILE_SIZE + TILE_SIZE / 2;

            // Draw pixel art furniture
            drawFurniturePixel(ctx, type, col * TILE_SIZE, row * TILE_SIZE);
        }
    });

    // Draw agents (sorted by Y for depth)
    const sortedAgents = [...state.agents].sort((a, b) => {
        const ay = agentAnims[a.id]?.y ?? a.position.y;
        const by = agentAnims[b.id]?.y ?? b.position.y;
        return ay - by;
    });

    sortedAgents.forEach(agent => {
        const anim = agentAnims[agent.id];
        if (!anim) return;

        const sprites = AGENT_SPRITES[agent.id];
        const sprW = sprites?._w ?? 26;
        const sprH = sprites?._h ?? 38;

        // Center horizontally, bottom-align in tile
        const px = anim.x * TILE_SIZE + (TILE_SIZE - sprW) / 2;
        const py = anim.y * TILE_SIZE + TILE_SIZE - sprH - 2;

        // Draw character sprite — seated or walking
        if (sprites) {
            let sprite;
            if (anim.sitting) {
                // Use seated pose
                sprite = sprites['sit_' + anim.direction] || sprites['sit_down'];
            } else {
                const dirSprites = sprites[anim.direction] || sprites['down'];
                const frameIdx = anim.walking ? animFrame : 0;
                sprite = dirSprites[frameIdx];
            }
            if (sprite) {
                ctx.drawImage(sprite, px, py, sprW, sprH);
            }
        }

        // Status badge (top-right of sprite)
        const badgeColors = { working: '#10b981', meeting: '#4a90d9', idle: '#f59e0b' };
        const badgeColor = badgeColors[agent.status] || '#666';
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.arc(px + sprW - 2, py + 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Name tag below sprite
        ctx.font = 'bold 8px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const name = agent.name;
        const nameW = ctx.measureText(name).width;
        const nameX = px + sprW / 2;
        const nameY = py + sprH + 1;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(nameX - nameW / 2 - 3, nameY, nameW + 6, 12);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(nameX - nameW / 2 - 3, nameY, nameW + 6, 12);
        ctx.fillStyle = '#222';
        ctx.fillText(name, nameX, nameY + 2);
    });
}

// Helper: draw an ellipse leaf shape
function _leaf(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawFurniturePixel(ctx, type, x, y) {
    const S = TILE_SIZE;
    const cx = x + S / 2;
    const cy = y + S / 2;
    // Scale factor: furniture overflows tile for realistic proportions
    const F = S / 48; // normalize to design at 48px base

    switch (type) {
        /* ====== DESK — large isometric wooden desk ====== */
        case 'desk': {
            const dw = 42*F, dh = 14*F; // desk top dimensions
            const dx = cx - dw/2, dy = cy - 4*F;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.fillRect(dx - 2*F, dy + dh + 10*F, dw + 4*F, 4*F);
            // Back legs
            ctx.fillStyle = '#5A3A10';
            ctx.fillRect(dx + 2*F, dy + dh + 6*F, 3*F, 8*F);
            ctx.fillRect(dx + dw - 5*F, dy + dh + 6*F, 3*F, 8*F);
            // Front panel (face)
            ctx.fillStyle = '#7A5A25';
            ctx.fillRect(dx, dy + dh, dw, 12*F);
            // Panel detail — two drawers
            ctx.fillStyle = '#6A4A18';
            ctx.fillRect(dx + 2*F, dy + dh + 1*F, dw/2 - 3*F, 10*F);
            ctx.fillRect(dx + dw/2 + 1*F, dy + dh + 1*F, dw/2 - 3*F, 10*F);
            // Drawer inset
            ctx.fillStyle = '#8A6A35';
            ctx.fillRect(dx + 3*F, dy + dh + 2*F, dw/2 - 5*F, 8*F);
            ctx.fillRect(dx + dw/2 + 2*F, dy + dh + 2*F, dw/2 - 5*F, 8*F);
            // Drawer handles (brass)
            ctx.fillStyle = '#D4B060';
            ctx.fillRect(dx + 8*F, dy + dh + 5*F, 5*F, 2*F);
            ctx.fillRect(dx + dw/2 + 6*F, dy + dh + 5*F, 5*F, 2*F);
            // Table top surface
            ctx.fillStyle = '#A88545';
            ctx.fillRect(dx - 2*F, dy, dw + 4*F, dh);
            // Wood grain highlight lines
            ctx.fillStyle = '#BEA060';
            ctx.fillRect(dx, dy + 1*F, dw, 2*F);
            ctx.fillStyle = '#C8AA68';
            ctx.fillRect(dx, dy + 5*F, dw, 1*F);
            ctx.fillStyle = '#BEA060';
            ctx.fillRect(dx, dy + 9*F, dw, 1*F);
            // Top bevel (light edge)
            ctx.fillStyle = '#D0B878';
            ctx.fillRect(dx - 2*F, dy, dw + 4*F, 2*F);
            // Left/right side bevel
            ctx.fillStyle = '#907030';
            ctx.fillRect(dx - 2*F, dy + 2*F, 2*F, dh - 2*F);
            ctx.fillRect(dx + dw + 2*F - 2*F, dy + 2*F, 2*F, dh - 2*F);
            // Desktop items — papers
            ctx.fillStyle = '#F0ECE0';
            ctx.fillRect(cx - 12*F, dy + 3*F, 8*F, 6*F);
            ctx.fillStyle = '#C0B8A0';
            ctx.fillRect(cx - 11*F, dy + 4*F, 5*F, 1*F);
            ctx.fillRect(cx - 11*F, dy + 6*F, 6*F, 1*F);
            // Desktop item — mug
            ctx.fillStyle = '#E0E0D8';
            ctx.fillRect(cx + 8*F, dy + 3*F, 5*F, 5*F);
            ctx.fillStyle = '#D0D0C0';
            ctx.fillRect(cx + 9*F, dy + 4*F, 3*F, 3*F);
            // Coffee in mug
            ctx.fillStyle = '#6A4020';
            ctx.fillRect(cx + 9*F, dy + 4*F, 3*F, 2*F);
            break;
        }

        /* ====== MONITOR — large screen with code content + keyboard ====== */
        case 'monitor': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fillRect(cx - 8*F, cy + 14*F, 16*F, 3*F);
            // Base plate
            ctx.fillStyle = '#555';
            ctx.fillRect(cx - 8*F, cy + 10*F, 16*F, 4*F);
            ctx.fillStyle = '#666';
            ctx.fillRect(cx - 6*F, cy + 9*F, 12*F, 2*F);
            // Stand neck
            ctx.fillStyle = '#777';
            ctx.fillRect(cx - 2*F, cy + 3*F, 4*F, 7*F);
            // Monitor housing
            ctx.fillStyle = '#222';
            ctx.fillRect(cx - 16*F, cy - 16*F, 32*F, 22*F);
            // Inner bezel
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(cx - 15*F, cy - 15*F, 30*F, 20*F);
            // Screen
            const t = Date.now() * 0.001;
            const gb = 0.7 + Math.sin(t * 1.5) * 0.3;
            ctx.fillStyle = '#0D1A14';
            ctx.fillRect(cx - 14*F, cy - 14*F, 28*F, 18*F);
            // Screen content — code lines
            const codeColors = [
                [`rgba(60,200,100,${gb*0.9})`, 12*F],
                [`rgba(100,180,220,${gb*0.7})`, 20*F],
                [`rgba(60,180,120,${gb*0.8})`, 14*F],
                [`rgba(220,180,80,${gb*0.6})`, 10*F],
                [`rgba(70,200,130,${gb*0.7})`, 18*F],
                [`rgba(180,120,200,${gb*0.5})`, 12*F],
                [`rgba(100,220,150,${gb*0.6})`, 16*F],
                [`rgba(80,180,220,${gb*0.8})`, 8*F],
            ];
            for (let li = 0; li < codeColors.length; li++) {
                ctx.fillStyle = codeColors[li][0];
                const indent = (li % 3) * 3*F;
                ctx.fillRect(cx - 12*F + indent, cy - 12*F + li * 2*F, codeColors[li][1], 1*F);
            }
            // Screen reflection
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(cx - 14*F, cy - 14*F, 28*F, 9*F);
            // Top bezel highlight
            ctx.fillStyle = '#333';
            ctx.fillRect(cx - 16*F, cy - 16*F, 32*F, 1*F);
            // Power LED
            ctx.fillStyle = '#0f0';
            ctx.fillRect(cx + 12*F, cy + 5*F, 2*F, 1*F);
            // Keyboard
            ctx.fillStyle = '#3A3A3A';
            ctx.fillRect(cx - 14*F, cy + 15*F, 28*F, 7*F);
            ctx.fillStyle = '#4A4A4A';
            for (let kr = 0; kr < 3; kr++) {
                for (let kc = 0; kc < 8; kc++) {
                    ctx.fillRect(cx - 12*F + kc * 3.2*F, cy + 16*F + kr * 2*F, 2.5*F, 1.3*F);
                }
            }
            // Spacebar
            ctx.fillRect(cx - 6*F, cy + 21*F, 12*F, 1.5*F);
            break;
        }

        /* ====== CHAIR — wooden chair with backrest ====== */
        case 'chair': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 16*F, 9*F, 3*F, 0, 0, Math.PI * 2);
            ctx.fill();
            // Back legs
            ctx.fillStyle = '#5A3A10';
            ctx.fillRect(cx - 9*F, cy + 8*F, 3*F, 10*F);
            ctx.fillRect(cx + 6*F, cy + 8*F, 3*F, 10*F);
            // Front legs
            ctx.fillStyle = '#6A4A1A';
            ctx.fillRect(cx - 8*F, cy + 12*F, 2*F, 6*F);
            ctx.fillRect(cx + 6*F, cy + 12*F, 2*F, 6*F);
            // Seat (top-down view — wooden plank)
            ctx.fillStyle = '#8B6A30';
            ctx.fillRect(cx - 10*F, cy + 2*F, 20*F, 10*F);
            ctx.fillStyle = '#A07A3A';
            ctx.fillRect(cx - 9*F, cy + 3*F, 18*F, 8*F);
            // Seat wood grain
            ctx.fillStyle = '#B08A48';
            ctx.fillRect(cx - 7*F, cy + 4*F, 14*F, 1*F);
            ctx.fillRect(cx - 7*F, cy + 7*F, 14*F, 1*F);
            // Backrest (vertical slats)
            ctx.fillStyle = '#6A4A1A';
            ctx.fillRect(cx - 10*F, cy - 14*F, 20*F, 17*F);
            // Slats
            ctx.fillStyle = '#7A5A28';
            ctx.fillRect(cx - 8*F, cy - 12*F, 5*F, 13*F);
            ctx.fillRect(cx - 1*F, cy - 12*F, 5*F, 13*F);
            ctx.fillRect(cx + 5*F, cy - 12*F, 4*F, 13*F);
            // Top rail
            ctx.fillStyle = '#8A6A38';
            ctx.fillRect(cx - 10*F, cy - 14*F, 20*F, 3*F);
            // Top rail highlight
            ctx.fillStyle = '#A0804A';
            ctx.fillRect(cx - 9*F, cy - 14*F, 18*F, 1*F);
            break;
        }

        /* ====== PLANT — large lush potted plant ====== */
        case 'plant': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 20*F, 12*F, 4*F, 0, 0, Math.PI * 2);
            ctx.fill();
            // Pot body (terracotta)
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(cx - 10*F, cy + 6*F, 20*F, 14*F);
            ctx.fillStyle = '#8B4220';
            ctx.fillRect(cx + 4*F, cy + 6*F, 6*F, 14*F);
            ctx.fillStyle = '#B86840';
            ctx.fillRect(cx - 8*F, cy + 7*F, 4*F, 12*F);
            // Pot rim
            ctx.fillStyle = '#C07848';
            ctx.fillRect(cx - 12*F, cy + 3*F, 24*F, 5*F);
            ctx.fillStyle = '#D89060';
            ctx.fillRect(cx - 11*F, cy + 3*F, 22*F, 2*F);
            // Soil
            ctx.fillStyle = '#3A2510';
            ctx.fillRect(cx - 9*F, cy + 2*F, 18*F, 3*F);
            // Stems
            ctx.fillStyle = '#2B6B1A';
            ctx.fillRect(cx - 1*F, cy - 8*F, 3*F, 12*F);
            ctx.fillRect(cx - 5*F, cy - 4*F, 2*F, 8*F);
            ctx.fillRect(cx + 4*F, cy - 6*F, 2*F, 10*F);
            // Leaves — large and lush, overflowing tile
            ctx.fillStyle = '#1A7030';
            _leaf(ctx, cx - 12*F, cy - 6*F, 10*F, 7*F);
            ctx.fillStyle = '#209040';
            _leaf(ctx, cx + 10*F, cy - 10*F, 9*F, 6*F);
            ctx.fillStyle = '#188038';
            _leaf(ctx, cx - 6*F, cy - 18*F, 9*F, 7*F);
            ctx.fillStyle = '#22A048';
            _leaf(ctx, cx + 4*F, cy - 16*F, 10*F, 6*F);
            ctx.fillStyle = '#28B050';
            _leaf(ctx, cx - 10*F, cy - 12*F, 8*F, 6*F);
            ctx.fillStyle = '#30C060';
            _leaf(ctx, cx + 12*F, cy - 4*F, 7*F, 5*F);
            ctx.fillStyle = '#18A040';
            _leaf(ctx, cx, cy - 22*F, 8*F, 6*F);
            ctx.fillStyle = '#25B848';
            _leaf(ctx, cx - 14*F, cy - 2*F, 6*F, 5*F);
            ctx.fillStyle = '#20A845';
            _leaf(ctx, cx + 8*F, cy - 20*F, 7*F, 5*F);
            // Leaf highlights
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(cx - 10*F, cy - 7*F, 7*F, 1*F);
            ctx.fillRect(cx + 6*F, cy - 11*F, 6*F, 1*F);
            ctx.fillRect(cx - 4*F, cy - 19*F, 5*F, 1*F);
            ctx.fillRect(cx + 2*F, cy - 17*F, 6*F, 1*F);
            ctx.fillRect(cx - 1*F, cy - 23*F, 5*F, 1*F);
            break;
        }

        /* ====== BOOKSHELF — tall with 3 shelves of colored books ====== */
        case 'bookshelf': {
            const bw = 38*F, bh = 48*F; // taller than tile
            const bx = cx - bw/2, by = cy - bh/2 - 4*F;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.fillRect(bx - 1*F, by + bh, bw + 3*F, 4*F);
            // Main body
            ctx.fillStyle = '#5A3A0C';
            ctx.fillRect(bx, by, bw, bh);
            // Inner back wall
            ctx.fillStyle = '#42280A';
            ctx.fillRect(bx + 3*F, by + 3*F, bw - 6*F, bh - 4*F);
            // Side panels
            ctx.fillStyle = '#7A5A2A';
            ctx.fillRect(bx, by, 3*F, bh);
            ctx.fillStyle = '#5A3A0C';
            ctx.fillRect(bx + bw - 3*F, by, 3*F, bh);
            // Top crown
            ctx.fillStyle = '#8A6A38';
            ctx.fillRect(bx - 1*F, by, bw + 2*F, 4*F);
            ctx.fillStyle = '#A0804A';
            ctx.fillRect(bx, by, bw, 2*F);
            // Shelf boards
            const shelfY = [by + 4*F, by + 17*F, by + 30*F, by + bh - 2*F];
            for (const sy of shelfY) {
                ctx.fillStyle = '#6A4A1A';
                ctx.fillRect(bx + 2*F, sy, bw - 4*F, 2*F);
                ctx.fillStyle = '#8A6A38';
                ctx.fillRect(bx + 3*F, sy, bw - 6*F, 1*F);
            }
            // Books — top shelf
            const colors1 = ['#C83030','#2878C0','#D8A020','#28A048','#8838A8','#D06830','#2060A0'];
            for (let i = 0; i < 7; i++) {
                const h = 9*F + (i % 3) * 2*F;
                ctx.fillStyle = colors1[i];
                ctx.fillRect(bx + 4*F + i * 4*F, shelfY[1] - h, 3*F, h);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(bx + 4*F + i * 4*F, shelfY[1] - h, 3*F, 1*F);
            }
            // Books — middle shelf
            const colors2 = ['#E07030','#1AAA5A','#7030A0','#2050A0','#C8B030','#A02060'];
            for (let i = 0; i < 6; i++) {
                const h = 8*F + (i % 2) * 3*F;
                ctx.fillStyle = colors2[i];
                ctx.fillRect(bx + 4*F + i * 5*F, shelfY[2] - h, 4*F, h);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(bx + 4*F + i * 5*F, shelfY[2] - h, 4*F, 1*F);
            }
            // Books — bottom shelf (some horizontal)
            ctx.fillStyle = '#B84040';
            ctx.fillRect(bx + 4*F, shelfY[3] - 5*F, 14*F, 4*F);
            ctx.fillStyle = '#3070B0';
            ctx.fillRect(bx + 4*F, shelfY[3] - 9*F, 12*F, 3*F);
            ctx.fillStyle = '#C0A030';
            ctx.fillRect(bx + 18*F, shelfY[3] - 8*F, 4*F, 7*F);
            ctx.fillStyle = '#408040';
            ctx.fillRect(bx + 23*F, shelfY[3] - 10*F, 3*F, 9*F);
            ctx.fillStyle = '#8030A0';
            ctx.fillRect(bx + 27*F, shelfY[3] - 7*F, 4*F, 6*F);
            break;
        }

        /* ====== SOFA — large pink/salmon sofa ====== */
        case 'sofa': {
            const sw = 44*F, sh = 28*F;
            const sx = cx - sw/2, sy = cy - sh/2 + 2*F;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.fillRect(sx - 2*F, sy + sh, sw + 4*F, 4*F);
            // Legs
            ctx.fillStyle = '#5A2A18';
            ctx.fillRect(sx + 2*F, sy + sh - 2*F, 4*F, 5*F);
            ctx.fillRect(sx + sw - 6*F, sy + sh - 2*F, 4*F, 5*F);
            // Armrests (sides)
            ctx.fillStyle = '#B85868';
            ctx.fillRect(sx - 4*F, sy + 2*F, 6*F, sh - 4*F);
            ctx.fillRect(sx + sw - 2*F, sy + 2*F, 6*F, sh - 4*F);
            // Armrest tops
            ctx.fillStyle = '#D07080';
            ctx.fillRect(sx - 4*F, sy + 2*F, 6*F, 4*F);
            ctx.fillRect(sx + sw - 2*F, sy + 2*F, 6*F, 4*F);
            // Back rest
            ctx.fillStyle = '#A85060';
            ctx.fillRect(sx, sy, sw, 10*F);
            // Back highlight
            ctx.fillStyle = '#C06878';
            ctx.fillRect(sx + 2*F, sy + 1*F, sw - 4*F, 3*F);
            // Seat base
            ctx.fillStyle = '#C86878';
            ctx.fillRect(sx, sy + 8*F, sw, sh - 8*F);
            // Left cushion
            ctx.fillStyle = '#E08090';
            ctx.fillRect(sx + 2*F, sy + 10*F, sw/2 - 3*F, sh - 12*F);
            // Right cushion
            ctx.fillStyle = '#D87888';
            ctx.fillRect(sx + sw/2 + 1*F, sy + 10*F, sw/2 - 3*F, sh - 12*F);
            // Cushion highlights
            ctx.fillStyle = '#F0A0A8';
            ctx.fillRect(sx + 4*F, sy + 12*F, sw/2 - 7*F, 2*F);
            ctx.fillRect(sx + sw/2 + 3*F, sy + 12*F, sw/2 - 7*F, 2*F);
            // Divider
            ctx.fillStyle = '#B06068';
            ctx.fillRect(sx + sw/2 - 1*F, sy + 10*F, 2*F, sh - 12*F);
            // Decorative pillows
            ctx.fillStyle = '#E8A8B0';
            ctx.fillRect(sx + 4*F, sy + 3*F, 8*F, 6*F);
            ctx.fillRect(sx + sw - 12*F, sy + 3*F, 8*F, 6*F);
            ctx.fillStyle = '#F0B8C0';
            ctx.fillRect(sx + 5*F, sy + 4*F, 6*F, 4*F);
            ctx.fillRect(sx + sw - 11*F, sy + 4*F, 6*F, 4*F);
            break;
        }

        /* ====== COFFEE MACHINE ====== */
        case 'coffee': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(cx - 8, cy + 14, 16, 2);
            // Base
            ctx.fillStyle = '#555';
            ctx.fillRect(cx - 9, cy + 10, 18, 4);
            // Body
            ctx.fillStyle = '#666';
            ctx.fillRect(cx - 8, cy - 10, 16, 22);
            // Body side shade
            ctx.fillStyle = '#555';
            ctx.fillRect(cx + 4, cy - 10, 4, 22);
            // Body highlight
            ctx.fillStyle = '#777';
            ctx.fillRect(cx - 6, cy - 9, 3, 20);
            // Top
            ctx.fillStyle = '#888';
            ctx.fillRect(cx - 9, cy - 12, 18, 4);
            // Dispenser area
            ctx.fillStyle = '#444';
            ctx.fillRect(cx - 5, cy - 2, 10, 8);
            // Drip tray
            ctx.fillStyle = '#555';
            ctx.fillRect(cx - 6, cy + 5, 12, 3);
            // Cup
            ctx.fillStyle = '#ddd';
            ctx.fillRect(cx - 3, cy, 6, 5);
            ctx.fillStyle = '#ccc';
            ctx.fillRect(cx - 2, cy + 1, 4, 3);
            // Buttons
            ctx.fillStyle = '#c03030';
            ctx.fillRect(cx - 6, cy - 8, 3, 3);
            ctx.fillStyle = '#30c030';
            ctx.fillRect(cx - 1, cy - 8, 3, 3);
            // Display
            ctx.fillStyle = '#204040';
            ctx.fillRect(cx + 3, cy - 8, 4, 3);
            break;
        }

        /* ====== WHITEBOARD ====== */
        case 'whiteboard': {
            // Wall mount shadow
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(cx - 17, cy - 14, 36, 32);
            // Frame
            ctx.fillStyle = '#888';
            ctx.fillRect(cx - 19, cy - 16, 38, 32);
            // White surface
            ctx.fillStyle = '#f0ece8';
            ctx.fillRect(cx - 17, cy - 14, 34, 28);
            // Surface sheen
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(cx - 17, cy - 14, 34, 12);
            // Writings — multicolor
            ctx.fillStyle = '#2060C0';
            ctx.fillRect(cx - 12, cy - 11, 16, 2);
            ctx.fillRect(cx - 12, cy - 7, 22, 1);
            ctx.fillStyle = '#C03030';
            ctx.fillRect(cx - 12, cy - 3, 12, 1);
            ctx.fillRect(cx + 4, cy - 3, 8, 1);
            ctx.fillStyle = '#208030';
            ctx.fillRect(cx - 12, cy + 1, 18, 1);
            // Diagram box
            ctx.strokeStyle = '#4060C0';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 8, cy + 4, 10, 7);
            ctx.strokeRect(cx + 6, cy + 4, 8, 7);
            // Arrow
            ctx.fillStyle = '#C03030';
            ctx.fillRect(cx + 2, cy + 6, 4, 2);
            // Marker tray
            ctx.fillStyle = '#999';
            ctx.fillRect(cx - 16, cy + 14, 32, 3);
            // Markers
            ctx.fillStyle = '#2060C0';
            ctx.fillRect(cx - 12, cy + 14, 6, 2);
            ctx.fillStyle = '#C03030';
            ctx.fillRect(cx - 4, cy + 14, 6, 2);
            ctx.fillStyle = '#333';
            ctx.fillRect(cx + 4, cy + 14, 6, 2);
            break;
        }

        /* ====== LAMP ====== */
        case 'lamp': {
            // Glow on floor
            ctx.fillStyle = 'rgba(255,220,100,0.08)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 6, 14, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            // Base
            ctx.fillStyle = '#444';
            ctx.fillRect(cx - 6, cy + 12, 12, 3);
            ctx.fillStyle = '#555';
            ctx.fillRect(cx - 4, cy + 11, 8, 2);
            // Pole
            ctx.fillStyle = '#777';
            ctx.fillRect(cx - 1, cy - 6, 3, 18);
            // Shade
            ctx.fillStyle = '#D0A030';
            ctx.fillRect(cx - 8, cy - 14, 16, 10);
            ctx.fillStyle = '#E0B040';
            ctx.fillRect(cx - 6, cy - 13, 12, 8);
            // Inner glow
            ctx.fillStyle = '#FFE880';
            ctx.fillRect(cx - 4, cy - 11, 8, 4);
            // Top cap
            ctx.fillStyle = '#C09020';
            ctx.fillRect(cx - 9, cy - 14, 18, 2);
            break;
        }

        /* ====== CACTUS ====== */
        case 'cactus': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 17, 8, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            // Pot
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(cx - 6, cy + 8, 12, 8);
            ctx.fillStyle = '#B86840';
            ctx.fillRect(cx - 7, cy + 6, 14, 4);
            ctx.fillStyle = '#4A3020';
            ctx.fillRect(cx - 5, cy + 6, 10, 2);
            // Main cactus body
            ctx.fillStyle = '#2A8A3A';
            ctx.fillRect(cx - 4, cy - 10, 9, 18);
            ctx.fillStyle = '#309044';
            ctx.fillRect(cx - 3, cy - 9, 7, 16);
            // Left arm
            ctx.fillStyle = '#2A8A3A';
            ctx.fillRect(cx - 9, cy - 4, 6, 5);
            ctx.fillRect(cx - 9, cy - 8, 4, 6);
            ctx.fillStyle = '#309044';
            ctx.fillRect(cx - 8, cy - 3, 4, 3);
            // Right arm
            ctx.fillStyle = '#2A8A3A';
            ctx.fillRect(cx + 4, cy - 2, 6, 5);
            ctx.fillRect(cx + 6, cy - 6, 4, 6);
            ctx.fillStyle = '#309044';
            ctx.fillRect(cx + 5, cy - 1, 4, 3);
            // Spines
            ctx.fillStyle = '#90C070';
            for (let sy = -8; sy < 6; sy += 3) {
                ctx.fillRect(cx - 5, cy + sy, 1, 1);
                ctx.fillRect(cx + 4, cy + sy + 1, 1, 1);
            }
            // Flower
            ctx.fillStyle = '#F04080';
            ctx.fillRect(cx - 1, cy - 12, 3, 3);
            ctx.fillStyle = '#F87098';
            ctx.fillRect(cx, cy - 11, 1, 1);
            break;
        }

        /* ====== BIN ====== */
        case 'bin': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 14, 7, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillStyle = '#888';
            ctx.fillRect(cx - 7, cy - 2, 14, 16);
            // Side shade
            ctx.fillStyle = '#777';
            ctx.fillRect(cx + 3, cy - 2, 4, 16);
            // Highlight
            ctx.fillStyle = '#999';
            ctx.fillRect(cx - 5, cy - 1, 3, 14);
            // Rim
            ctx.fillStyle = '#aaa';
            ctx.fillRect(cx - 8, cy - 4, 16, 3);
            // Rim highlight
            ctx.fillStyle = '#bbb';
            ctx.fillRect(cx - 7, cy - 4, 14, 1);
            // Trash
            ctx.fillStyle = '#ccc';
            ctx.fillRect(cx - 4, cy - 3, 5, 2);
            ctx.fillStyle = '#ddd';
            ctx.fillRect(cx + 1, cy - 2, 3, 1);
            break;
        }

        /* ====== CLOCK (wall decoration) ====== */
        case 'clock': {
            // Wall shadow
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.beginPath();
            ctx.arc(cx + 1, cy + 1, 10, 0, Math.PI * 2);
            ctx.fill();
            // Frame
            ctx.fillStyle = '#6A4A1A';
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fill();
            // Face
            ctx.fillStyle = '#F8F4E8';
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fill();
            // Hour markers
            ctx.fillStyle = '#333';
            for (let h = 0; h < 12; h++) {
                const angle = (h / 12) * Math.PI * 2 - Math.PI / 2;
                const mx = cx + Math.cos(angle) * 6;
                const my = cy + Math.sin(angle) * 6;
                ctx.fillRect(mx, my, 1, 1);
            }
            // Hour hand
            const hour = (Date.now() / 60000) % 12;
            const ha = (hour / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.fillStyle = '#333';
            ctx.fillRect(cx, cy, 1, 1);
            ctx.fillRect(cx + Math.cos(ha) * 3, cy + Math.sin(ha) * 3, 1, 1);
            ctx.fillRect(cx + Math.cos(ha) * 5, cy + Math.sin(ha) * 5, 1, 1);
            // Minute hand
            const min = (Date.now() / 5000) % 60;
            const ma = (min / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.fillStyle = '#555';
            ctx.fillRect(cx + Math.cos(ma) * 3, cy + Math.sin(ma) * 3, 1, 1);
            ctx.fillRect(cx + Math.cos(ma) * 5, cy + Math.sin(ma) * 5, 1, 1);
            ctx.fillRect(cx + Math.cos(ma) * 7, cy + Math.sin(ma) * 7, 1, 1);
            // Center dot
            ctx.fillStyle = '#C03030';
            ctx.fillRect(cx, cy, 2, 2);
            break;
        }

        /* ====== PICTURE FRAME ====== */
        case 'picture': {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(cx - 10, cy - 8, 22, 18);
            // Outer frame
            ctx.fillStyle = '#8A6A30';
            ctx.fillRect(cx - 12, cy - 10, 24, 20);
            // Inner frame
            ctx.fillStyle = '#A88040';
            ctx.fillRect(cx - 11, cy - 9, 22, 18);
            // Painting canvas
            ctx.fillStyle = '#486898';
            ctx.fillRect(cx - 9, cy - 7, 18, 14);
            // Painting: landscape
            // Sky
            ctx.fillStyle = '#6088B8';
            ctx.fillRect(cx - 9, cy - 7, 18, 7);
            // Mountains
            ctx.fillStyle = '#406080';
            ctx.fillRect(cx - 6, cy - 3, 6, 3);
            ctx.fillRect(cx + 2, cy - 4, 5, 4);
            // Ground
            ctx.fillStyle = '#408040';
            ctx.fillRect(cx - 9, cy, 18, 7);
            ctx.fillStyle = '#509050';
            ctx.fillRect(cx - 9, cy, 18, 3);
            // Sunset
            ctx.fillStyle = '#E0A040';
            ctx.fillRect(cx + 2, cy - 6, 3, 2);
            // Frame bevel
            ctx.fillStyle = '#C0A060';
            ctx.fillRect(cx - 12, cy - 10, 24, 1);
            ctx.fillRect(cx - 12, cy - 10, 1, 20);
            break;
        }

        /* ====== RUG ====== */
        case 'rug': {
            // Main rug
            ctx.fillStyle = '#A0584A';
            ctx.fillRect(cx - 18, cy - 12, 36, 24);
            // Border
            ctx.fillStyle = '#C07860';
            ctx.fillRect(cx - 18, cy - 12, 36, 2);
            ctx.fillRect(cx - 18, cy + 10, 36, 2);
            ctx.fillRect(cx - 18, cy - 12, 2, 24);
            ctx.fillRect(cx + 16, cy - 12, 2, 24);
            // Inner pattern
            ctx.fillStyle = '#B06858';
            ctx.fillRect(cx - 14, cy - 8, 28, 16);
            // Center diamond pattern
            ctx.fillStyle = '#D09878';
            ctx.fillRect(cx - 4, cy - 4, 8, 8);
            ctx.fillStyle = '#C08868';
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
            // Corner motifs
            ctx.fillStyle = '#D09878';
            ctx.fillRect(cx - 12, cy - 6, 4, 4);
            ctx.fillRect(cx + 8, cy - 6, 4, 4);
            ctx.fillRect(cx - 12, cy + 2, 4, 4);
            ctx.fillRect(cx + 8, cy + 2, 4, 4);
            break;
        }

        default: {
            // Fallback: draw emoji
            ctx.font = `${Math.round(S * 0.5)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fData = FURNITURE_DISPLAY[type];
            if (fData) {
                ctx.fillText(fData.emoji, cx, cy);
            }
        }
    }
}

// ===== AGENT MOVEMENT SYSTEM =====
// ===== BEHAVIOR-DRIVEN AGENT SYSTEM =====
// Agents have behaviors: 'idle' (wander/coffee), 'working' (sit at desk), 'meeting' (go to meeting room)

// BFS pathfinding — returns array of {x,y} waypoints (1 tile per step)
function calculatePath(fromX, fromY, toX, toY) {
    fromX = Math.round(fromX); fromY = Math.round(fromY);
    toX = Math.round(toX); toY = Math.round(toY);
    if (fromX === toX && fromY === toY) return [];

    const rows = state.layout.length;
    const cols = state.layout[0]?.length || COLS;
    const visited = new Set();
    const queue = [[{x: fromX, y: fromY}]]; // each item is a path
    visited.add(`${fromX},${fromY}`);

    const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];

    while (queue.length > 0) {
        const path = queue.shift();
        const {x, y} = path[path.length - 1];

        for (const d of dirs) {
            const nx = x + d.dx, ny = y + d.dy;
            const key = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            if (visited.has(key)) continue;
            const tile = state.layout[ny]?.[nx];
            if (!tile || tile === 'wall') continue;

            visited.add(key);
            const newPath = [...path, {x: nx, y: ny}];

            if (nx === toX && ny === toY) {
                return newPath.slice(1); // exclude starting position
            }
            queue.push(newPath);
        }

        // Safety: don't search too many tiles
        if (visited.size > 200) break;
    }

    // No path found — return empty
    return [];
}

function initAgentAnims() {
    state.agents.forEach(agent => {
        agentAnims[agent.id] = {
            x: agent.position.x,
            y: agent.position.y,
            targetX: agent.position.x,
            targetY: agent.position.y,
            direction: agent.direction || 'down',
            walking: false,
            sitting: false,       // true when seated at desk
            behavior: 'idle',     // 'idle' | 'working' | 'meeting' | 'coffee'
            behaviorTimer: 3000 + Math.random() * 5000,
            deskTile: null,       // {x,y} of assigned desk when working
            idleTimer: 2000 + Math.random() * 6000,
            waypoints: [],        // BFS path — array of {x,y} tiles to visit in order
        };
    });
}

// Find tiles with a specific furniture type
function findFurnitureTiles(furnitureType) {
    const tiles = [];
    Object.entries(state.placedItems).forEach(([key, type]) => {
        if (type === furnitureType) {
            const [col, row] = key.split(',').map(Number);
            tiles.push({ x: col, y: row });
        }
    });
    return tiles;
}

// Find tiles in a specific room type
function findRoomTiles(roomType) {
    const tiles = [];
    for (let row = 0; row < state.layout.length; row++) {
        for (let col = 0; col < (state.layout[row]?.length || 0); col++) {
            if (state.layout[row][col] === roomType) tiles.push({ x: col, y: row });
        }
    }
    return tiles;
}

// Find the nearest unoccupied tile from a list
function findNearestUnoccupied(tiles, fromX, fromY, agentId) {
    let best = null, bestDist = Infinity;
    for (const t of tiles) {
        const occupied = state.agents.some(other => {
            if (other.id === agentId) return false;
            const oa = agentAnims[other.id];
            return oa && Math.round(oa.targetX) === t.x && Math.round(oa.targetY) === t.y;
        });
        if (occupied) continue;
        const d = Math.abs(t.x - fromX) + Math.abs(t.y - fromY);
        if (d < bestDist) { bestDist = d; best = t; }
    }
    return best;
}

// Find adjacent walkable tile next to a furniture tile (for sitting near desk)
function findAdjacentWalkable(fx, fy, agentId) {
    const dirs = [{dx:0,dy:1},{dx:0,dy:-1},{dx:-1,dy:0},{dx:1,dy:0}];
    for (const d of dirs) {
        const nx = fx + d.dx, ny = fy + d.dy;
        const cell = state.layout[ny]?.[nx];
        if (!cell || cell === 'wall') continue;
        // Check not occupied by another agent
        const occupied = state.agents.some(other => {
            if (other.id === agentId) return false;
            const oa = agentAnims[other.id];
            return oa && Math.round(oa.targetX) === nx && Math.round(oa.targetY) === ny;
        });
        if (!occupied) return { x: nx, y: ny, faceX: fx, faceY: fy };
    }
    return null;
}

function updateAgentPositions(dt) {
    state.agents.forEach(agent => {
        const anim = agentAnims[agent.id];
        if (!anim) return;

        // Sync behavior with status
        const newBehavior = agent.status === 'working' ? 'working'
            : agent.status === 'meeting' ? 'meeting' : 'idle';

        if (anim.behavior !== newBehavior) {
            anim.behavior = newBehavior;
            anim.sitting = false;
            anim.deskTile = null;
            anim.waypoints = [];
            assignBehaviorTarget(agent, anim);
        }

        const speed = 0.012; // slower, more natural walk
        const dx = anim.targetX - anim.x;
        const dy = anim.targetY - anim.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.05) {
            anim.walking = true;
            anim.sitting = false;
            const move = Math.min(speed * dt, dist);
            anim.x += (dx / dist) * move;
            anim.y += (dy / dist) * move;
            if (Math.abs(dx) > Math.abs(dy)) {
                anim.direction = dx > 0 ? 'right' : 'left';
            } else {
                anim.direction = dy > 0 ? 'down' : 'up';
            }
        } else {
            // Arrived at current target tile
            anim.x = anim.targetX;
            anim.y = anim.targetY;

            // If more waypoints, move to next one
            if (anim.waypoints.length > 0) {
                const next = anim.waypoints.shift();
                anim.targetX = next.x;
                anim.targetY = next.y;
                anim.walking = true;
            } else {
                anim.walking = false;

                if (anim.behavior === 'working' && anim.deskTile) {
                    anim.sitting = true;
                    const dxD = anim.deskTile.x - anim.x;
                    const dyD = anim.deskTile.y - anim.y;
                    if (Math.abs(dxD) > Math.abs(dyD)) {
                        anim.direction = dxD > 0 ? 'right' : 'left';
                    } else {
                        anim.direction = dyD > 0 ? 'down' : 'up';
                    }
                } else if (anim.behavior === 'meeting') {
                    anim.sitting = true;
                } else {
                    anim.idleTimer -= dt;
                    if (anim.idleTimer <= 0) {
                        anim.idleTimer = 4000 + Math.random() * 8000;
                        if (Math.random() < 0.3) {
                            assignIdleTarget(agent, anim);
                        } else {
                            randomWalk(agent, anim);
                        }
                    }
                }
            }
        }
    });
}

function assignBehaviorTarget(agent, anim) {
    const fromX = Math.round(anim.x), fromY = Math.round(anim.y);

    if (anim.behavior === 'working') {
        const desks = findFurnitureTiles('desk');
        const monitors = findFurnitureTiles('monitor');
        const workstations = [...desks, ...monitors];
        const teamRoom = agent.team === 'build' ? 'dev'
            : agent.team === 'content' ? 'cont'
            : agent.team === 'academy' ? 'acad'
            : agent.team === 'management' ? 'exec' : 'main';
        const teamDesks = workstations.filter(t => state.layout[t.y]?.[t.x] === teamRoom);
        const pool = teamDesks.length > 0 ? teamDesks : workstations;

        for (const desk of pool.sort(() => Math.random() - 0.5)) {
            const spot = findAdjacentWalkable(desk.x, desk.y, agent.id);
            if (spot) {
                const path = calculatePath(fromX, fromY, spot.x, spot.y);
                if (path.length > 0) {
                    anim.waypoints = path;
                    anim.targetX = path[0].x;
                    anim.targetY = path[0].y;
                    anim.waypoints.shift();
                    anim.deskTile = { x: spot.faceX, y: spot.faceY };
                    return;
                }
            }
        }
    } else if (anim.behavior === 'meeting') {
        const meetTiles = findRoomTiles('meet');
        const spot = findNearestUnoccupied(meetTiles, fromX, fromY, agent.id);
        if (spot) {
            const path = calculatePath(fromX, fromY, spot.x, spot.y);
            if (path.length > 0) {
                anim.waypoints = path;
                anim.targetX = path[0].x;
                anim.targetY = path[0].y;
                anim.waypoints.shift();
                return;
            }
        }
    } else {
        anim.idleTimer = 1000;
    }
}

function assignIdleTarget(agent, anim) {
    const fromX = Math.round(anim.x), fromY = Math.round(anim.y);
    const roll = Math.random();

    if (roll < 0.4) {
        const coffees = findFurnitureTiles('coffee');
        if (coffees.length > 0) {
            const coffee = coffees[Math.floor(Math.random() * coffees.length)];
            const spot = findAdjacentWalkable(coffee.x, coffee.y, agent.id);
            if (spot) {
                const path = calculatePath(fromX, fromY, spot.x, spot.y);
                if (path.length > 0) {
                    anim.waypoints = path;
                    anim.targetX = path[0].x;
                    anim.targetY = path[0].y;
                    anim.waypoints.shift();
                    return;
                }
            }
        }
    } else if (roll < 0.6) {
        const idleAgents = state.agents.filter(a =>
            a.id !== agent.id && a.status === 'idle' && agentAnims[a.id]
        );
        if (idleAgents.length > 0) {
            const buddy = idleAgents[Math.floor(Math.random() * idleAgents.length)];
            const ba = agentAnims[buddy.id];
            const spot = findAdjacentWalkable(Math.round(ba.x), Math.round(ba.y), agent.id);
            if (spot) {
                const path = calculatePath(fromX, fromY, spot.x, spot.y);
                if (path.length > 0) {
                    anim.waypoints = path;
                    anim.targetX = path[0].x;
                    anim.targetY = path[0].y;
                    anim.waypoints.shift();
                    return;
                }
            }
        }
    }
    randomWalk(agent, anim);
}

function randomWalk(agent, anim) {
    const dirs = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const dir of shuffled) {
        const nx = Math.round(anim.x) + dir.dx;
        const ny = Math.round(anim.y) + dir.dy;
        const layoutRows = state.layout.length;
        const layoutCols = state.layout[0]?.length || COLS;
        if (ny >= 0 && ny < layoutRows && nx >= 0 && nx < layoutCols) {
            const tileType = state.layout[ny]?.[nx];
            if (tileType && tileType !== 'wall') {
                const occupied = state.agents.some(other => {
                    if (other.id === agent.id) return false;
                    const otherAnim = agentAnims[other.id];
                    return otherAnim && Math.round(otherAnim.targetX) === nx && Math.round(otherAnim.targetY) === ny;
                });
                if (!occupied) {
                    anim.targetX = nx;
                    anim.targetY = ny;
                    return;
                }
            }
        }
    }
}

// ===== CANVAS CLICK HANDLER =====
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check if clicked on any agent
    let clickedAgent = null;
    let minDist = Infinity;

    state.agents.forEach(agent => {
        const anim = agentAnims[agent.id];
        if (!anim) return;

        const ax = anim.x * TILE_SIZE + TILE_SIZE / 2;
        const ay = anim.y * TILE_SIZE + TILE_SIZE / 2 - 8;
        const dist = Math.sqrt((mx - ax) ** 2 + (my - ay) ** 2);

        if (dist < 30 && dist < minDist) {
            minDist = dist;
            clickedAgent = agent;
        }
    });

    if (clickedAgent) {
        showAgentInfo(clickedAgent);
    }
}

// ===== SPEECH BUBBLES =====
function showSpeechBubble(agentId, text) {
    const anim = agentAnims[agentId];
    if (!anim) return;

    const container = document.getElementById('speechBubbles');
    const canvasEl = document.getElementById('officeCanvas');
    if (!container || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const scaleY = rect.height / CANVAS_H;

    const px = (anim.x * TILE_SIZE + TILE_SIZE / 2) * scaleX + (canvasEl.offsetLeft || 0);
    const py = (anim.y * TILE_SIZE - 10) * scaleY + (canvasEl.offsetTop || 0);

    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.textContent = text;
    bubble.style.left = `${px - 40}px`;
    bubble.style.top = `${py - 50}px`;

    container.appendChild(bubble);

    setTimeout(() => {
        bubble.remove();
    }, 3000);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadData();
    checkApiStatus();
});

async function loadData() {
    try {
        const [agentsRes, chatRes, furnitureRes, orgRes, layoutRes] = await Promise.all([
            fetch('/api/agents'),
            fetch('/api/chat'),
            fetch('/api/furniture'),
            fetch('/api/org'),
            fetch('/api/layout'),
        ]);

        state.agents = await agentsRes.json();
        state.chatMessages = await chatRes.json();
        state.furniture = await furnitureRes.json();
        state.orgData = await orgRes.json();
        const layoutData = await layoutRes.json();
        state.layout = layoutData.layout;
        state.placedItems = layoutData.placed;

        // Pre-render sprites
        preRenderAgentSprites();
        initAgentAnims();

        // Initialize canvas
        initCanvas();

        // Render other views
        renderAgentStatusBar();
        renderChat();
        renderOrgChart();
        renderCustomize();
        initChatInput();
        initTaskBoard();
        initAgentModal();
        initServerModal();

        // Start ambient behaviors
        startAmbientBehaviors();

        // Start polling for new messages & tasks
        startPolling();

        // Draw logo
        drawLogoIcon();

    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

async function checkApiStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const dot = document.querySelector('#apiStatus .status-dot');
        const text = document.getElementById('apiStatusText');

        if (data.openai_configured) {
            dot.className = 'status-dot configured';
            text.textContent = 'OpenAI 연결됨';
        } else {
            dot.className = 'status-dot not-configured';
            text.textContent = 'API 키 미설정';
        }
    } catch (e) {
        console.error('Status check failed:', e);
    }
}

function drawLogoIcon() {
    const logoCanvas = document.getElementById('logoIcon');
    if (!logoCanvas) return;
    const lctx = logoCanvas.getContext('2d');
    lctx.imageSmoothingEnabled = false;

    // Draw tiny pixel art building
    lctx.fillStyle = '#4a90d9';
    lctx.fillRect(4, 6, 16, 16);
    lctx.fillStyle = '#6ab0ff';
    lctx.fillRect(6, 2, 12, 6);
    // Windows
    lctx.fillStyle = '#ffd700';
    lctx.fillRect(7, 10, 3, 3);
    lctx.fillRect(14, 10, 3, 3);
    lctx.fillRect(7, 16, 3, 3);
    lctx.fillRect(14, 16, 3, 3);
    // Door
    lctx.fillStyle = '#333';
    lctx.fillRect(10, 17, 4, 5);
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

            // Refresh task board when switching to it
            if (tab.dataset.tab === 'tasks') {
                loadTasks().then(() => {
                    renderTaskBoard();
                    updateTaskBadge();
                });
            }
            if (tab.dataset.tab === 'settings') {
                renderSettings();
            }
        });
    });
}

// ===== AGENT INFO PANEL =====
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
    document.getElementById('closePanel').onclick = () => panel.classList.remove('open');
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
        const isReport = msg.type === 'result';
        const isStageUpdate = msg.type === 'stage_update';
        const isProgress = msg.type === 'progress';
        const isReview = msg.type === 'review';

        const el = document.createElement('div');
        el.className = `chat-message ${isUser ? 'user' : ''} ${isReport ? 'result-message' : ''} ${isStageUpdate ? 'stage-message' : ''} ${isProgress ? 'progress-message' : ''} ${isReview ? 'review-message' : ''}`;

        // Format report text with line breaks
        const formattedMsg = msg.message.replace(/\n/g, '<br>');

        el.innerHTML = `
            <div class="chat-msg-avatar" style="background: ${isUser ? '#ef4444' : (agent?.avatar_color || '#666')}">
                ${isUser ? '나' : (agent?.name.charAt(0) || '?')}
            </div>
            <div class="chat-msg-content ${isReport ? 'report-content' : ''}">
                <div class="chat-msg-header">
                    <span class="chat-msg-name">${isUser ? '대표 (나)' : (agent?.name || 'Unknown')}</span>
                    <span class="chat-msg-time">${msg.time}</span>
                    <span class="chat-msg-type ${msg.type}">${getTypeLabel(msg.type)}</span>
                </div>
                <div class="chat-msg-text">${formattedMsg}</div>
            </div>
        `;
        container.appendChild(el);

        // Track last msg_id
        if (msg.msg_id && msg.msg_id > state.lastMsgId) {
            state.lastMsgId = msg.msg_id;
        }
    });

    container.scrollTop = container.scrollHeight;
}

function getTypeLabel(type) {
    return {
        task: '업무', report: '보고', system: '시스템', command: '지시',
        result: '📋 최종보고', stage_update: '📌 단계완료', progress: '⏳ 진행중', review: '👔 상위검토',
    }[type] || type;
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

            // Show typing indicator
            showTypingIndicator(data.ai_response.agent);

            // Show AI response after delay
            setTimeout(() => {
                removeTypingIndicator();
                state.chatMessages.push(data.ai_response);
                if (data.ai_response.msg_id) state.lastMsgId = data.ai_response.msg_id;
                renderChatMessages();

                const agentName = state.agents.find(a => a.id === data.ai_response.agent)?.name || 'AI';
                showToast(`${agentName} 직원이 접수. 보고서 작성 중...`);

                // Show speech bubble on canvas
                showSpeechBubble(data.ai_response.agent, '보고서 작성 중...');

                // Update task badge
                updateTaskBadge();
            }, 1200);
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

function showTypingIndicator(agentId) {
    const container = document.getElementById('chatMessages');
    const agent = state.agents.find(a => a.id === agentId);
    const indicator = document.createElement('div');
    indicator.className = 'chat-message typing-msg';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="chat-msg-avatar" style="background: ${agent?.avatar_color || '#666'}">
            ${agent?.name.charAt(0) || '?'}
        </div>
        <div class="chat-msg-content">
            <div class="typing-indicator">
                <span>${agent?.name || 'AI'}이(가) 입력 중</span>
                <div class="typing-dots"><i></i><i></i><i></i></div>
            </div>
        </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

// ===== ORG CHART =====
function renderOrgChart() {
    const chart = document.getElementById('orgChart');
    if (!state.orgData) return;
    const { ceo, direct, teams } = state.orgData;

    chart.innerHTML = `
        <div class="org-actions">
            <button class="org-add-btn" id="addAgentBtn">+ 직원 추가</button>
        </div>
        <div class="org-level">
            <div class="org-card ceo" style="border-color: ${ceo.color}">
                <div class="org-card-title">${ceo.title}</div>
                <div class="org-card-name">${ceo.name}</div>
                <div class="org-level-badge">Lv.1 대표</div>
            </div>
        </div>
        <div class="org-connector"></div>
        <div class="org-level">
            ${direct.map(d => `
                <div class="org-card direct clickable" style="border-left-color: ${d.color}" data-agent-id="${d.id}">
                    <div class="org-card-title">${d.title}</div>
                    <div class="org-card-name">${d.name}</div>
                    <div class="org-card-desc">${d.desc}</div>
                    <div class="org-level-badge">Lv.${d.level} ${state.orgData.level_names?.[d.level] || ''}</div>
                    <div class="org-card-actions">
                        <button class="org-edit-btn" data-edit-id="${d.id}">편집</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="org-connector"></div>
        <div class="org-teams">
            ${teams.map(team => `
                <div class="org-team-card">
                    <div class="org-team-header" style="background: ${team.color}10; border-bottom-color: ${team.color}40">
                        <span class="org-team-name">${team.name}</span>
                        <span class="org-team-code" style="background: ${team.color}">${team.code}</span>
                    </div>
                    <div class="org-team-desc">${team.desc}</div>
                    <div class="org-team-agents">
                        ${team.agents.map(a => `
                            <span class="org-agent-badge clickable" data-agent-id="${a.id}" style="border-left: 3px solid ${a.color}">
                                ${a.name} <small>(Lv.${a.level})</small>
                                <button class="org-edit-mini" data-edit-id="${a.id}">&#9998;</button>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Attach event listeners
    document.getElementById('addAgentBtn')?.addEventListener('click', () => openAgentModal(null));

    chart.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAgentModal(btn.dataset.editId);
        });
    });
}

// ===== AGENT MODAL =====
async function populateModelServerDropdown(selectedServerId, selectedModel) {
    const serverSelect = document.getElementById('modalModelServer');
    const modelSelect = document.getElementById('modalModel');
    if (!serverSelect || !modelSelect) return;

    let servers = [];
    try {
        const res = await fetch('/api/model-servers');
        const data = await res.json();
        servers = Array.isArray(data) ? data : Object.values(data);
    } catch (e) {}

    serverSelect.innerHTML = servers.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('') || '<option value="default">기본 (OpenAI)</option>';

    // Cache server data on the select element for cascading
    serverSelect._servers = servers;

    serverSelect.onchange = () => {
        const sid = serverSelect.value;
        const srv = (serverSelect._servers || []).find(s => s.id === sid);
        const models = srv?.models || ['gpt-4o-mini'];
        modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
    };
}

function setModalModelServer(serverId, model) {
    const serverSelect = document.getElementById('modalModelServer');
    const modelSelect = document.getElementById('modalModel');
    if (!serverSelect || !modelSelect) return;

    serverSelect.value = serverId;
    // Trigger cascading update
    serverSelect.dispatchEvent(new Event('change'));
    // Set model after models are populated
    setTimeout(() => { modelSelect.value = model; }, 0);
}

async function openAgentModal(agentId) {
    const modal = document.getElementById('agentModal');
    const title = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('modalDelete');

    // Populate supervisor dropdown
    const supSelect = document.getElementById('modalSupervisor');
    supSelect.innerHTML = '<option value="">없음 (대표 직속)</option>';
    state.agents.forEach(a => {
        if (a.id !== agentId && (a.level === 2 || a.level === 3)) {
            supSelect.innerHTML += `<option value="${a.id}">${a.name} (${a.role})</option>`;
        }
    });

    // Populate model server dropdown
    await populateModelServerDropdown();

    if (agentId) {
        // Edit mode
        title.textContent = '직원 정보 편집';
        deleteBtn.style.display = 'inline-block';

        try {
            const res = await fetch(`/api/agents/${agentId}?edit=true`);
            const agent = await res.json();

            document.getElementById('modalAgentId').value = agent.id;
            document.getElementById('modalName').value = agent.name || '';
            document.getElementById('modalRole').value = agent.role || '';
            document.getElementById('modalTeam').value = agent.team || 'management';
            document.getElementById('modalLevel').value = agent.level || 4;
            document.getElementById('modalSupervisor').value = agent.supervisor || '';
            document.getElementById('modalDesc').value = agent.description || '';
            document.getElementById('modalPersonality').value = agent.personality || '';
            document.getElementById('modalSkills').value = (agent.skills || []).join(', ');
            document.getElementById('modalKeywords').value = (agent.keywords || []).join(', ');
            document.getElementById('modalColor').value = agent.avatar_color || '#3B82F6';
            setColorSwatch(agent.avatar_color);
            setModalModelServer(agent.model_server || 'default', agent.model || 'gpt-4o-mini');
        } catch (e) {
            console.error('Failed to load agent:', e);
        }
    } else {
        // Add mode
        title.textContent = '새 직원 추가';
        deleteBtn.style.display = 'none';
        document.getElementById('modalAgentId').value = '';
        document.getElementById('modalName').value = '';
        document.getElementById('modalRole').value = '';
        document.getElementById('modalTeam').value = 'build';
        document.getElementById('modalLevel').value = '4';
        document.getElementById('modalSupervisor').value = '';
        document.getElementById('modalDesc').value = '';
        document.getElementById('modalPersonality').value = '';
        document.getElementById('modalSkills').value = '';
        document.getElementById('modalKeywords').value = '';
        document.getElementById('modalColor').value = '#3B82F6';
        setColorSwatch('#3B82F6');
        setModalModelServer('default', 'gpt-4o-mini');
    }

    modal.style.display = 'flex';
}

function setColorSwatch(color) {
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.color === color);
    });
}

function initAgentModal() {
    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.addEventListener('click', () => {
            document.getElementById('modalColor').value = s.dataset.color;
            setColorSwatch(s.dataset.color);
        });
    });

    // Close
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('agentModal').style.display = 'none';
    });
    document.getElementById('modalCancel').addEventListener('click', () => {
        document.getElementById('agentModal').style.display = 'none';
    });

    // Save
    document.getElementById('modalSave').addEventListener('click', saveAgent);

    // Delete
    document.getElementById('modalDelete').addEventListener('click', deleteAgent);

    // Close on overlay click
    document.getElementById('agentModal').addEventListener('click', (e) => {
        if (e.target.id === 'agentModal') {
            document.getElementById('agentModal').style.display = 'none';
        }
    });
}

async function saveAgent() {
    const agentId = document.getElementById('modalAgentId').value;
    const data = {
        name: document.getElementById('modalName').value.trim(),
        role: document.getElementById('modalRole').value.trim(),
        team: document.getElementById('modalTeam').value,
        level: parseInt(document.getElementById('modalLevel').value),
        supervisor: document.getElementById('modalSupervisor').value || null,
        description: document.getElementById('modalDesc').value.trim(),
        personality: document.getElementById('modalPersonality').value.trim(),
        skills: document.getElementById('modalSkills').value.split(',').map(s => s.trim()).filter(Boolean),
        keywords: document.getElementById('modalKeywords').value.split(',').map(s => s.trim()).filter(Boolean),
        avatar_color: document.getElementById('modalColor').value,
        model_server: document.getElementById('modalModelServer').value || 'default',
        model: document.getElementById('modalModel').value || 'gpt-4o-mini',
    };

    if (!data.name) {
        showToast('이름을 입력해주세요');
        return;
    }

    try {
        let res;
        if (agentId) {
            res = await fetch(`/api/agents/${agentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } else {
            res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        }

        if (res.ok) {
            document.getElementById('agentModal').style.display = 'none';
            showToast(agentId ? '직원 정보가 수정되었습니다' : '새 직원이 추가되었습니다');
            await reloadAgents();
        }
    } catch (e) {
        console.error('Save agent failed:', e);
        showToast('저장 실패');
    }
}

async function deleteAgent() {
    const agentId = document.getElementById('modalAgentId').value;
    if (!agentId) return;

    const name = document.getElementById('modalName').value;
    if (!confirm(`'${name}' 직원을 삭제하시겠습니까?`)) return;

    try {
        const res = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
        if (res.ok) {
            document.getElementById('agentModal').style.display = 'none';
            showToast(`${name} 직원이 삭제되었습니다`);
            await reloadAgents();
        }
    } catch (e) {
        console.error('Delete agent failed:', e);
    }
}

async function reloadAgents() {
    try {
        const [agentsRes, orgRes] = await Promise.all([
            fetch('/api/agents'),
            fetch('/api/org'),
        ]);
        state.agents = await agentsRes.json();
        state.orgData = await orgRes.json();

        // Re-render affected views
        preRenderAgentSprites();
        initAgentAnims();
        renderOrgChart();
        renderAgentStatusBar();
        renderChatSidebar();
    } catch (e) {
        console.error('Reload agents failed:', e);
    }
}

// ===== CUSTOMIZE =====
function renderCustomize() {
    const toolbar = document.querySelector('.customize-toolbar');

    // Inject mode toggle once
    let modeDiv = document.getElementById('editModeToggle');
    if (!modeDiv) {
        modeDiv = document.createElement('div');
        modeDiv.id = 'editModeToggle';
        modeDiv.className = 'edit-mode-toggle';
        const h3 = toolbar.querySelector('h3');
        h3.after(modeDiv);
    }
    modeDiv.innerHTML = `
        <button class="mode-btn ${state.editMode !== 'room' ? 'active' : ''}" id="modeFurnitureBtn">🪑 가구 배치</button>
        <button class="mode-btn ${state.editMode === 'room' ? 'active' : ''}" id="modeRoomBtn">🏗️ 구역 편집</button>
    `;
    document.getElementById('modeFurnitureBtn').onclick = () => { state.editMode = 'furniture'; renderCustomize(); };
    document.getElementById('modeRoomBtn').onclick = () => { state.editMode = 'room'; renderCustomize(); };

    if (state.editMode === 'room') {
        renderRoomTypePalette();
    } else {
        renderFurnitureCategories();
        renderFurnitureItems(state.activeCategory || '전체');
    }

    renderCustomizeGrid();
}

const ROOM_TYPE_OPTIONS = [
    { type: 'main', label: '메인 오피스', bg: '#d8d0c0' },
    { type: 'meet', label: '회의실',      bg: '#c8c0d8' },
    { type: 'exec', label: '임원실',      bg: '#d8c0a0' },
    { type: 'dev',  label: '개발 팀룸',   bg: '#c8d8e0' },
    { type: 'cont', label: '콘텐츠 팀룸', bg: '#c0d8c8' },
    { type: 'acad', label: '교육 팀룸',   bg: '#d0c8d8' },
    { type: 'hall', label: '복도',        bg: '#b0b0c0' },
    { type: 'wall', label: '벽',          bg: '#6a6a7a' },
];

function renderRoomTypePalette() {
    const catContainer = document.getElementById('furnitureCategories');
    const itemContainer = document.getElementById('furnitureItems');

    catContainer.innerHTML = '<div style="font-size:10px;color:var(--text-secondary);margin-bottom:6px;">구역 유형 선택 후 셀을 클릭해 구역을 변경하세요.</div>';

    itemContainer.innerHTML = `
        <div class="room-type-palette">
            ${ROOM_TYPE_OPTIONS.map(opt => `
                <div class="room-type-btn ${state.selectedRoomType === opt.type ? 'active' : ''}"
                     data-type="${opt.type}"
                     style="background:${opt.bg}">
                    ${opt.label}
                </div>
            `).join('')}
        </div>
        <div class="room-edit-hint">💡 드래그하려면 마우스를 누른 채 셀 위를 지나가세요.</div>
    `;

    itemContainer.querySelectorAll('.room-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedRoomType = btn.dataset.type;
            renderCustomize();
        });
    });

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
    state.activeCategory = category;
    const container = document.getElementById('furnitureItems');
    const items = state.furniture.filter(f => category === '전체' || f.category === category);

    container.innerHTML = '';
    items.forEach(item => {
        const display = FURNITURE_DISPLAY[item.icon] || { emoji: '📦', label: item.name };
        const div = document.createElement('div');
        div.className = `furniture-item ${state.selectedFurniture === item.id ? 'selected' : ''}`;
        div.dataset.id = item.id;

        // Render pixel art thumbnail instead of emoji
        const iconDiv = document.createElement('div');
        iconDiv.className = 'furniture-icon';
        if (FURNITURE_DISPLAY[item.icon]) {
            const thumb = createFurnitureThumbnail(item.icon);
            iconDiv.appendChild(thumb);
        } else {
            iconDiv.textContent = display.emoji;
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'furniture-name';
        nameDiv.textContent = item.name;

        div.appendChild(iconDiv);
        div.appendChild(nameDiv);
        container.appendChild(div);

        div.addEventListener('click', () => {
            container.querySelectorAll('.furniture-item').forEach(e => e.classList.remove('selected'));
            div.classList.add('selected');
            state.selectedFurniture = item.id;
        });
    });
}

function renderCustomizeGrid() {
    const grid = document.getElementById('customizeGrid');
    grid.innerHTML = '';

    const isRoomMode = state.editMode === 'room';
    grid.className = 'customize-grid' + (isRoomMode ? ' room-edit-mode' : '');

    for (let row = 0; row < state.layout.length; row++) {
        for (let col = 0; col < state.layout[row].length; col++) {
            const cellType = state.layout[row][col];
            const cell = document.createElement('div');
            const key = `${col},${row}`;
            const hasItem = state.placedItems[key];

            cell.className = `customize-cell ${ROOM_CLASSES[cellType] || ''} ${(!isRoomMode && hasItem) ? 'has-item' : ''}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (cellType === 'wall' && !isRoomMode) {
                cell.style.cursor = 'not-allowed';
            }

            if (!isRoomMode && hasItem) {
                const fData = FURNITURE_DISPLAY[hasItem];
                if (fData) {
                    cell.innerHTML = `<span class="placed-item">${fData.emoji}</span>`;
                }
            }

            // Drag-paint for room-edit mode
            if (isRoomMode) {
                cell.addEventListener('mouseenter', () => {
                    if (!_roomPainting) return;
                    state.layout[row][col] = state.selectedRoomType;
                    cell.className = `customize-cell ${ROOM_CLASSES[state.selectedRoomType] || ''} room-edit-mode-cell`;
                });
            }

            cell.addEventListener('click', () => {
                if (isRoomMode) {
                    // Room-edit mode: paint cell with selected room type
                    state.layout[row][col] = state.selectedRoomType;
                    cell.className = `customize-cell ${ROOM_CLASSES[state.selectedRoomType] || ''}`;
                } else {
                    // Furniture mode
                    if (cellType === 'wall') return;
                    if (state.selectedFurniture) {
                        state.placedItems[key] = state.selectedFurniture;
                        renderCustomizeGrid();
                        showToast(`${FURNITURE_DISPLAY[state.selectedFurniture]?.label || '아이템'} 배치 완료!`);
                    } else if (hasItem) {
                        delete state.placedItems[key];
                        renderCustomizeGrid();
                        showToast('아이템 제거됨');
                    }
                }
            });

            grid.appendChild(cell);
        }
    }

    document.getElementById('saveOffice').onclick = saveOfficeLayout;
}

async function saveOfficeLayout() {
    try {
        const res = await fetch('/api/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: state.layout, placed: state.placedItems }),
        });
        if (res.ok) {
            showToast('✅ 저장 완료! 사무실에 반영되었습니다.');
        }
    } catch (e) {
        console.error('Save failed:', e);
        showToast('저장 실패');
    }
}

// ===== AMBIENT BEHAVIORS =====
function startAmbientBehaviors() {
    // Context-aware speech bubbles based on behavior
    setInterval(() => {
        const agent = state.agents[Math.floor(Math.random() * state.agents.length)];
        if (!agent) return;
        const anim = agentAnims[agent.id];
        if (!anim) return;

        let bubbles;
        if (anim.sitting && anim.behavior === 'working') {
            bubbles = [
                '코드 리뷰 중...', '데이터 분석 중...', '문서 작성 중...',
                '보고서 작성 중...', '테스트 실행 중...', '코드 배포 준비!',
                '집중 모드! 🎧', 'API 설계 중...', '버그 수정 중...',
            ];
        } else if (anim.behavior === 'meeting') {
            bubbles = [
                '회의 진행 중 📋', '좋은 아이디어네요!', '다음 단계는...?',
                '일정 조율 중...', '피드백 공유!', '전략 논의 중...',
            ];
        } else {
            bubbles = [
                '커피 한 잔 ☕', '잠깐 휴식~', '아이디어 정리 중!',
                '팀 미팅 곧 시작!', '점심 뭐 먹지...', '오늘 날씨 좋다 ☀️',
                '간식 타임! 🍪', '스트레칭~',
            ];
        }
        showSpeechBubble(agent.id, bubbles[Math.floor(Math.random() * bubbles.length)]);
    }, 8000);

    // Status changes — only show 'working' if agent has active tasks
    setInterval(() => {
        state.agents.forEach(agent => {
            const hasPending = state.tasks.some(t =>
                t.agent === agent.id && t.status !== 'completed'
            );
            if (hasPending) {
                agent.status = 'working';
            } else {
                // Idle agents randomly switch between idle and meeting
                const roll = Math.random();
                agent.status = roll < 0.7 ? 'idle' : 'meeting';
            }
        });
    }, 10000);
}

// ===== POLLING SYSTEM =====
function startPolling() {
    setInterval(async () => {
        try {
            // Poll for new chat messages
            const res = await fetch(`/api/chat/new?after=${state.lastMsgId}`);
            const newMsgs = await res.json();

            if (newMsgs.length > 0) {
                let hasNewReport = false;
                newMsgs.forEach(msg => {
                    // Avoid duplicates
                    if (!state.chatMessages.find(m => m.msg_id === msg.msg_id)) {
                        state.chatMessages.push(msg);
                        if (msg.msg_id > state.lastMsgId) {
                            state.lastMsgId = msg.msg_id;
                        }
                        if (msg.type === 'result') {
                            hasNewReport = true;
                            const agent = state.agents.find(a => a.id === msg.agent);
                            showToast(`📋 ${agent?.name || 'AI'} 보고서 도착!`);
                            showSpeechBubble(msg.agent, '보고서 완료!');
                        }
                    }
                });

                if (newMsgs.length > 0) {
                    renderChatMessages();
                }

                if (hasNewReport) {
                    // Refresh tasks (only if not currently viewing task board)
                    await loadTasks();
                    const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab;
                    if (activeTab === 'tasks') {
                        renderTaskBoard();
                    }
                    updateTaskBadge();
                }
            }
        } catch (e) {
            // Silently ignore polling errors
        }
    }, 3000);

    // Also poll tasks periodically (only re-render if changed)
    setInterval(async () => {
        const prevCount = state.tasks.length;
        const prevPending = state.tasks.filter(t => t.status === '진행중').length;
        await loadTasks();
        const newCount = state.tasks.length;
        const newPending = state.tasks.filter(t => t.status === '진행중').length;
        // Only re-render if tasks actually changed
        if (newCount !== prevCount || newPending !== prevPending) {
            renderTaskBoard();
        }
        updateTaskBadge();
    }, 5000);
}

async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        state.tasks = await res.json();
    } catch (e) {
        // ignore
    }
}

function updateTaskBadge() {
    const badge = document.getElementById('taskBadge');
    if (!badge) return;

    const pendingCount = state.tasks.filter(t => t.status === '진행중').length;
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// ===== TASK BOARD =====
function initTaskBoard() {
    // Filter buttons
    document.querySelectorAll('.task-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.task-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTaskFilter = btn.dataset.filter;
            renderTaskBoard();
        });
    });

    loadTasks().then(() => {
        renderTaskBoard();
        updateTaskBadge();
    });
}

function renderTaskBoard() {
    const board = document.getElementById('tasksBoard');
    if (!board) return;

    let tasks = state.tasks;
    if (state.activeTaskFilter !== 'all') {
        tasks = tasks.filter(t => t.status === state.activeTaskFilter);
    }

    if (tasks.length === 0) {
        board.innerHTML = `
            <div class="tasks-empty">
                <p>📭 ${state.activeTaskFilter === 'all' ? '아직 지시한 업무가 없습니다.' : `'${state.activeTaskFilter}' 상태의 업무가 없습니다.`}</p>
                <p>팀 채팅에서 AI 직원에게 업무를 지시해보세요!</p>
            </div>
        `;
        return;
    }

    board.innerHTML = '';
    board.innerHTML = tasks.map(task => {
        const isPending = task.status === '진행중';
        const stages = task.stages || [];
        const totalStages = task.total_stages || stages.length || 3;
        const completedStages = stages.filter(s => s.status === '완료').length;
        const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        // Build stages HTML
        const stagesHtml = stages.map((stage, idx) => {
            const stClass = stage.status === '완료' ? 'done' : stage.status === '진행중' ? 'active' : 'waiting';
            const resultHtml = stage.result ? stage.result.replace(/\n/g, '<br>') : '';
            return `
                <div class="stage-item ${stClass}">
                    <div class="stage-header">
                        <span class="stage-icon">${stage.icon || '📌'}</span>
                        <span class="stage-name">${stage.stage_num}단계: ${stage.name}</span>
                        <span class="stage-status-badge ${stClass}">
                            ${stage.status === '완료' ? '✅ 완료' : stage.status === '진행중' ? '⏳ 진행중' : '⏸ 대기'}
                        </span>
                        ${stage.completed_at ? `<span class="stage-time">${stage.completed_at}</span>` : ''}
                    </div>
                    ${stage.result ? `
                        <div class="stage-result-toggle" data-toggle-stage="${task.id}-${idx}">
                            결과 보기 ▾
                        </div>
                        <div class="stage-result-body" id="stage-${task.id}-${idx}" style="display:none">
                            ${resultHtml}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="task-card ${isPending ? 'pending' : 'completed'}" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="task-card-status ${isPending ? 'pending' : 'completed'}">
                        ${isPending ? `<span class="task-spinner"></span> 진행중 (${completedStages}/${totalStages})` : '✅ 전체 완료'}
                    </div>
                    <div class="task-card-agent">
                        <span class="task-agent-dot" style="background: ${task.agent_color}"></span>
                        ${task.agent_name}
                    </div>
                    <div class="task-card-time">${isPending ? task.created_at + ' 시작' : task.completed_at + ' 완료'}</div>
                </div>
                <div class="task-card-title">${task.title}</div>
                <div class="task-progress-bar">
                    <div class="task-progress-fill-real" style="width: ${progressPct}%"></div>
                </div>
                <div class="task-progress-label">${progressPct}% 완료 (${completedStages}/${totalStages} 단계)</div>
                <div class="task-stages">
                    ${stagesHtml}
                </div>
            </div>
        `;
    }).join('');

    // Attach toggle handlers for stage results
    board.querySelectorAll('.stage-result-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.toggleStage;
            const el = document.getElementById(`stage-${key}`);
            if (!el) return;
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? 'block' : 'none';
            btn.textContent = isHidden ? '결과 접기 ▴' : '결과 보기 ▾';
        });
    });
}

function toggleReport(taskId) {
    const el = document.getElementById(`report-${taskId}`);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';

    // Update toggle text
    const toggle = el.previousElementSibling;
    if (toggle) {
        toggle.textContent = isHidden ? '📋 보고서 접기 ▴' : '📋 보고서 보기 ▾';
    }
}

// Make toggleReport globally accessible
window.toggleReport = toggleReport;

// ===== SETTINGS TAB =====

async function renderSettings() {
    const cardsEl = document.getElementById('serverCards');
    if (!cardsEl) return;

    let servers = [];
    try {
        const res = await fetch('/api/model-servers');
        const data = await res.json();
        servers = Array.isArray(data) ? data : Object.values(data);
    } catch (e) {
        cardsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:12px">서버 목록을 불러올 수 없습니다.</p>';
        return;
    }

    if (servers.length === 0) {
        cardsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:12px">등록된 서버가 없습니다.</p>';
        return;
    }

    cardsEl.innerHTML = servers.map(srv => {
        const modelsHtml = (srv.models || []).map(m => `<span class="server-model-tag">${m}</span>`).join('');
        const isDefault = srv.id === 'default';
        return `
            <div class="server-card" data-server-id="${srv.id}">
                <div class="server-card-header">
                    <span class="server-card-name">${srv.name}</span>
                    <span class="server-card-type">${srv.type}</span>
                </div>
                <div class="server-card-url">${srv.api_base || ''}</div>
                <div class="server-card-models">${modelsHtml || '<span style="color:var(--text-secondary);font-size:10px">모델 없음</span>'}</div>
                <div class="server-card-actions">
                    <button class="server-action-btn test" onclick="testServer('${srv.id}', this)">테스트</button>
                    <button class="server-action-btn" onclick="openServerModal('${srv.id}')">편집</button>
                    ${isDefault ? '' : `<button class="server-action-btn danger" onclick="deleteServer('${srv.id}')">삭제</button>`}
                </div>
            </div>
        `;
    }).join('');
}

async function testServer(serverId, btn) {
    const orig = btn.textContent;
    btn.textContent = '…';
    btn.disabled = true;
    try {
        const res = await fetch(`/api/model-servers/${serverId}/test`, { method: 'POST' });
        const data = await res.json();
        const dot = btn.closest('.server-card').querySelector('.server-card-header');
        if (data.success) {
            showToast(`연결 성공: ${data.models?.length || 0}개 모델 확인`);
        } else {
            showToast(`연결 실패: ${data.error || '알 수 없는 오류'}`);
        }
    } catch (e) {
        showToast('연결 테스트 오류');
    }
    btn.textContent = orig;
    btn.disabled = false;
}

async function deleteServer(serverId) {
    if (!confirm('이 서버를 삭제하시겠습니까? 해당 서버를 사용하는 직원은 기본 서버로 변경됩니다.')) return;
    await fetch(`/api/model-servers/${serverId}`, { method: 'DELETE' });
    renderSettings();
    showToast('서버가 삭제되었습니다');
}

async function openServerModal(serverId) {
    const modal = document.getElementById('serverModal');
    document.getElementById('serverModalTitle').textContent = serverId ? 'LLM 서버 편집' : 'LLM 서버 추가';
    document.getElementById('serverModalId').value = serverId || '';

    if (serverId) {
        try {
            const res = await fetch('/api/model-servers');
            const rawData = await res.json();
            const servers = Array.isArray(rawData) ? rawData : Object.values(rawData);
            const srv = servers.find(s => s.id === serverId);
            if (srv) {
                document.getElementById('serverName').value = srv.name || '';
                document.getElementById('serverType').value = srv.type || 'openai';
                document.getElementById('serverApiBase').value = srv.api_base || '';
                document.getElementById('serverApiKey').value = '';  // masked
                document.getElementById('serverModels').value = (srv.models || []).join(', ');
                document.getElementById('serverDefaultModel').value = srv.default_model || '';
            }
        } catch (e) {}
    } else {
        document.getElementById('serverName').value = '';
        document.getElementById('serverType').value = 'openai';
        document.getElementById('serverApiBase').value = '';
        document.getElementById('serverApiKey').value = '';
        document.getElementById('serverModels').value = '';
        document.getElementById('serverDefaultModel').value = '';
    }

    modal.style.display = 'flex';
}

function initServerModal() {
    document.getElementById('closeServerModal').addEventListener('click', () => {
        document.getElementById('serverModal').style.display = 'none';
    });
    document.getElementById('serverModalCancel').addEventListener('click', () => {
        document.getElementById('serverModal').style.display = 'none';
    });
    document.getElementById('serverModal').addEventListener('click', e => {
        if (e.target.id === 'serverModal') document.getElementById('serverModal').style.display = 'none';
    });

    document.getElementById('serverModalTest').addEventListener('click', async () => {
        const btn = document.getElementById('serverModalTest');
        const serverId = document.getElementById('serverModalId').value;
        if (!serverId) { showToast('저장 후 테스트하세요'); return; }
        btn.textContent = '테스트 중…';
        await testServer(serverId, { textContent: '테스트 중…', disabled: false });
        btn.textContent = '연결 테스트';
    });

    document.getElementById('serverModalSave').addEventListener('click', async () => {
        const serverId = document.getElementById('serverModalId').value;
        const data = {
            name: document.getElementById('serverName').value.trim(),
            type: document.getElementById('serverType').value,
            api_base: document.getElementById('serverApiBase').value.trim(),
            api_key: document.getElementById('serverApiKey').value.trim(),
            models: document.getElementById('serverModels').value.split(',').map(s => s.trim()).filter(Boolean),
            default_model: document.getElementById('serverDefaultModel').value.trim(),
        };
        if (!data.name) { showToast('서버 이름을 입력하세요'); return; }

        const url = serverId ? `/api/model-servers/${serverId}` : '/api/model-servers';
        const method = serverId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            document.getElementById('serverModal').style.display = 'none';
            renderSettings();
            showToast(serverId ? '서버가 수정되었습니다' : '서버가 추가되었습니다');
        } else {
            showToast('저장 실패');
        }
    });

    document.getElementById('addServerBtn').addEventListener('click', () => openServerModal(null));
}

window.testServer = testServer;
window.deleteServer = deleteServer;
window.openServerModal = openServerModal;

// ===== TOAST NOTIFICATION =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
