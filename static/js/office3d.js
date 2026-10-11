/**
 * AI Office - 3D voxel office (three.js).
 *
 * Builds the office from the same data the 2D grid uses (state.office rooms,
 * state.placedItems furniture, state.agents staff) and exposes
 * window.Office3D for app.js. Labels (names, status, speech bubbles) are DOM
 * elements via CSS2DRenderer so text stays crisp and escaped like the rest
 * of the page.
 */

// Loaded dynamically at the bottom so a CDN failure can be reported to app.js
// (a failed static import would fail silently).
let THREE, OrbitControls, CSS2DRenderer, CSS2DObject;

// Bright pastel floors per room, matching the page's light theme.
const ROOM_FLOOR = {
    lobby: 0xfff1c9,
    records: 0xd3f1e6,
    meeting: 0xe6e0fa,
    library: 0xffe3d4,
    studio: 0xdcebfb,
};
const HALL_FLOOR = 0xe4e8ef;
const WALL = 0xfbfaf7;
const WALL_TRIM = 0xc9c2b6;
const SCENE_BG = 0xeef2f8;
const BASE_SLAB = 0xd5dbe5;
const SKIN = 0xf1c27d;
const STATUS_COLOR = { working: '#10b981', meeting: '#4a90d9', idle: '#a0a0b8' };

// What each staff member physically does while working on a task:
// [furniture to go to, nth nearest of that kind, action there, seconds].
// Staff not listed stay at their desk and type.
const ERRANDS = {
    finder: [['bookshelf', 0, 'search', 1.6], ['bookshelf', 1, 'search', 1.4]],
    coach: [['bookshelf', 0, 'search', 1.8]],
    minutes: [['whiteboard', 0, 'write', 2.2]],
    reporter: [['whiteboard', 0, 'write', 2.4]],
};
// Staff who carry their finished record to a bookshelf themselves.
const FILERS = new Set(['archivist', 'minutes']);
const WALK_SPEED = 1.8;  // world units per second
const SUB = 0.5;         // navigation grid: half a floor tile

const box = (w, h, d, color, opts = {}) => {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color, ...opts }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const at = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    return mesh;
};

// Bottom of every model sits on y = 0.
const FURNITURE = {
    desk() {
        const g = new THREE.Group();
        g.add(at(box(0.8, 0.06, 0.45, 0xb07a4a), 0, 0.42, 0));
        for (const [x, z] of [[-0.35, -0.18], [0.35, -0.18], [-0.35, 0.18], [0.35, 0.18]]) {
            g.add(at(box(0.05, 0.4, 0.05, 0x7a5230), x, 0.2, z));
        }
        g.add(at(box(0.3, 0.02, 0.2, 0xffffff), -0.15, 0.46, 0.05));  // papers
        return g;
    },
    monitor() {
        const g = FURNITURE.desk();
        g.add(at(box(0.05, 0.12, 0.05, 0x333333), 0, 0.51, -0.1));
        g.add(at(box(0.42, 0.28, 0.04, 0x222222), 0, 0.71, -0.1));
        g.add(at(box(0.38, 0.24, 0.01, 0x4aa3ff, { emissive: 0x1a4a88 }), 0, 0.71, -0.075));
        g.add(at(box(0.3, 0.02, 0.1, 0x444444), 0, 0.46, 0.08));  // keyboard
        return g;
    },
    chair() {
        const g = new THREE.Group();
        g.add(at(box(0.34, 0.06, 0.34, 0x3b5bdb), 0, 0.26, 0));
        g.add(at(box(0.34, 0.34, 0.06, 0x3b5bdb), 0, 0.46, -0.15));
        g.add(at(box(0.06, 0.24, 0.06, 0x333333), 0, 0.12, 0));
        g.add(at(box(0.36, 0.03, 0.06, 0x333333), 0, 0.02, 0));
        g.add(at(box(0.06, 0.03, 0.36, 0x333333), 0, 0.02, 0));
        return g;
    },
    bookshelf() {
        const g = new THREE.Group();
        g.add(at(box(0.8, 1.1, 0.3, 0x8b5a2b), 0, 0.55, -0.3));
        const colors = [0xd9480f, 0x2b8a3e, 0x1971c2, 0xf59f00, 0x862e9c, 0xc2255c];
        for (let shelf = 0; shelf < 3; shelf++) {
            const y = 0.2 + shelf * 0.33;
            g.add(at(box(0.74, 0.03, 0.26, 0x6b4421), 0, y - 0.1, -0.28));
            for (let i = 0; i < 6; i++) {
                const h = 0.16 + ((i * 7 + shelf * 3) % 5) * 0.02;
                g.add(at(box(0.09, h, 0.2, colors[(i + shelf) % colors.length]), -0.3 + i * 0.12, y - 0.085 + h / 2, -0.27));
            }
        }
        return g;
    },
    plant() {
        const g = new THREE.Group();
        g.add(at(box(0.26, 0.22, 0.26, 0xc0603a), 0, 0.11, 0));
        const leaves = [[0, 0.36, 0, 0.3], [0.1, 0.5, 0.05, 0.2], [-0.08, 0.48, -0.06, 0.2], [0, 0.62, 0, 0.16]];
        for (const [x, y, z, s] of leaves) g.add(at(box(s, s, s, 0x2f9e44), x, y, z));
        return g;
    },
    cactus() {
        const g = new THREE.Group();
        g.add(at(box(0.22, 0.18, 0.22, 0xc0603a), 0, 0.09, 0));
        g.add(at(box(0.12, 0.5, 0.12, 0x37b24d), 0, 0.43, 0));
        g.add(at(box(0.18, 0.08, 0.08, 0x37b24d), 0.1, 0.42, 0));
        g.add(at(box(0.08, 0.16, 0.08, 0x37b24d), 0.16, 0.52, 0));
        return g;
    },
    coffee() {
        const g = new THREE.Group();
        g.add(at(box(0.6, 0.5, 0.4, 0x8d6e63), 0, 0.25, -0.2));
        g.add(at(box(0.26, 0.32, 0.24, 0x2b2b2b), -0.1, 0.66, -0.22));
        g.add(at(box(0.04, 0.04, 0.02, 0xff4d4f, { emissive: 0xaa0000 }), -0.02, 0.74, -0.09));
        g.add(at(box(0.08, 0.1, 0.08, 0xffffff), 0.16, 0.55, -0.15));
        return g;
    },
    whiteboard() {
        const g = new THREE.Group();
        for (const x of [-0.38, 0.38]) g.add(at(box(0.04, 1.0, 0.04, 0x777777), x, 0.5, -0.3));
        g.add(at(box(0.8, 0.5, 0.04, 0xfafafa), 0, 0.72, -0.3));
        g.add(at(box(0.4, 0.03, 0.01, 0x1971c2), -0.1, 0.82, -0.275));
        g.add(at(box(0.5, 0.03, 0.01, 0xe03131), 0.02, 0.72, -0.275));
        g.add(at(box(0.3, 0.03, 0.01, 0x2f9e44), -0.15, 0.62, -0.275));
        return g;
    },
    sofa() {
        const g = new THREE.Group();
        g.add(at(box(0.9, 0.22, 0.42, 0x1c7c7d), 0, 0.15, 0));
        g.add(at(box(0.9, 0.32, 0.12, 0x1c7c7d), 0, 0.36, -0.16));
        for (const x of [-0.42, 0.42]) g.add(at(box(0.08, 0.3, 0.42, 0x166566), x, 0.25, 0));
        return g;
    },
    lamp() {
        const g = new THREE.Group();
        g.add(at(box(0.2, 0.03, 0.2, 0x333333), 0, 0.015, 0));
        g.add(at(box(0.04, 0.8, 0.04, 0x555555), 0, 0.42, 0));
        g.add(at(box(0.26, 0.18, 0.26, 0xffe066, { emissive: 0xb08900 }), 0, 0.88, 0));
        return g;
    },
    bin() {
        const g = new THREE.Group();
        g.add(at(box(0.2, 0.26, 0.2, 0x868e96), 0, 0.13, 0));
        g.add(at(box(0.08, 0.04, 0.08, 0xffffff), 0.02, 0.28, 0));
        return g;
    },
    rug() {
        const g = new THREE.Group();
        const rug = at(box(0.9, 0.02, 0.9, 0xb5651d), 0, 0.01, 0);
        rug.castShadow = false;
        g.add(rug);
        return g;
    },
};

function cardboardBoxes() {
    const g = new THREE.Group();
    const spots = [[0, 0.15, 0, 0.3], [0.22, 0.12, 0.12, 0.24], [0.05, 0.4, 0.02, 0.22]];
    for (const [x, y, z, s] of spots) {
        g.add(at(box(s, s, s, 0xc8a165), x, y, z));
        g.add(at(box(s + 0.005, 0.02, 0.06, 0xa5844f), x, y + s / 2, z));  // tape
    }
    return g;
}

// Rotate `from` toward `to` by `k` of the shortest angular distance.
function turnToward(from, to, k) {
    let d = to - from;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return from + d * k;
}

function character(color) {
    const g = new THREE.Group();
    const parts = {};
    const dark = new THREE.Color(color).multiplyScalar(0.7).getHex();
    parts.legL = at(box(0.1, 0.26, 0.1, 0x343a40), -0.07, 0.13, 0);
    parts.legR = at(box(0.1, 0.26, 0.1, 0x343a40), 0.07, 0.13, 0);
    parts.body = at(box(0.3, 0.3, 0.18, color), 0, 0.41, 0);
    parts.armL = at(box(0.08, 0.26, 0.1, dark), -0.19, 0.42, 0);
    parts.armR = at(box(0.08, 0.26, 0.1, dark), 0.19, 0.42, 0);
    parts.head = at(box(0.24, 0.24, 0.24, SKIN), 0, 0.68, 0);
    parts.hair = at(box(0.26, 0.08, 0.26, 0x4a3426), 0, 0.82, -0.01);
    parts.eyeL = at(box(0.04, 0.04, 0.01, 0x222222), -0.05, 0.69, 0.121);
    parts.eyeR = at(box(0.04, 0.04, 0.01, 0x222222), 0.05, 0.69, 0.121);
    Object.values(parts).forEach(p => g.add(p));
    return { group: g, parts };
}

class Office3D {
    constructor(container, ctx) {
        this.container = container;
        this.ctx = ctx;  // { getState, onAgentClick, escapeHtml }
        this.agents = new Map();  // id -> { group, parts, label, seed }
        this.effects = [];        // running motion effects: { update(dt) -> alive }
        this.spots = [];          // furniture positions, for "file it on the shelf" motion
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.furnitureKey = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SCENE_BG);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.labels = new CSS2DRenderer();
        this.labels.domElement.className = 'office3d-labels';
        container.appendChild(this.labels.domElement);

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minPolarAngle = 0.35;
        this.controls.maxPolarAngle = 1.2;
        this.controls.minZoom = 0.7;
        this.controls.maxZoom = 2.5;

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2d6, 1.5));
        const sun = new THREE.DirectionalLight(0xfff8ee, 1.2);
        sun.position.set(-4, 9, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
        this.scene.add(sun);

        this.world = new THREE.Group();
        this.furniture = new THREE.Group();
        this.scene.add(this.world, this.furniture);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.renderer.domElement.addEventListener('pointerdown', e => {
            this.downAt = [e.clientX, e.clientY];
            this.intro = null;  // the user takes the camera: stop the fly-in
        });
        this.renderer.domElement.addEventListener('pointerup', e => this.handleClick(e));
        this.renderer.domElement.addEventListener('pointermove', e => this.handleHover(e));

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);

        this.buildWorld();
        this.update();
        this.resetView();
        this.resize();

        this.startIntro();
        this.clock = new THREE.Clock();
        this.renderer.setAnimationLoop(() => this.frame());
    }

    cellCenter(col, row) {
        const { cols, rows } = this.ctx.getState().office.grid;
        return [col - cols / 2 + 0.5, row - rows / 2 + 0.5];
    }

    buildWorld() {
        const { office } = this.ctx.getState();
        const { cols, rows } = office.grid;
        const roomAt = (c, r) => office.rooms.find(rm =>
            c >= rm.x && c < rm.x + rm.w && r >= rm.y && r < rm.y + rm.h) || null;

        // Base slab and floor tiles (checkered by a shade per room).
        this.world.add(at(box(cols + 0.3, 0.2, rows + 0.3, BASE_SLAB), 0, -0.15, 0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const room = roomAt(c, r);
                const base = new THREE.Color(room ? ROOM_FLOOR[room.theme] ?? HALL_FLOOR : HALL_FLOOR);
                if ((r + c) % 2) base.multiplyScalar(0.95);
                if (room?.planned) base.lerp(new THREE.Color(0xc4cad6), 0.35);
                const [x, z] = this.cellCenter(c, r);
                const tile = at(box(1, 0.1, 1, base.getHex()), x, -0.05, z);
                tile.castShadow = false;
                this.world.add(tile);
            }
        }

        // Back walls (north + west), dollhouse style: front stays open.
        const H = 1.3;
        this.world.add(at(box(cols + 0.2, H, 0.1, WALL), 0, H / 2, -rows / 2 - 0.05));
        this.world.add(at(box(0.1, H, rows + 0.2, WALL), -cols / 2 - 0.05, H / 2, 0));
        this.world.add(at(box(cols + 0.2, 0.06, 0.12, WALL_TRIM), 0, H, -rows / 2 - 0.05));
        this.world.add(at(box(0.12, 0.06, rows + 0.2, WALL_TRIM), -cols / 2 - 0.05, H, 0));
        // Windows on the north wall.
        for (let c = 1; c < cols; c += 3) {
            const [x] = this.cellCenter(c, 0);
            this.world.add(at(box(0.7, 0.45, 0.02, 0x9bd4ff, { emissive: 0x204060 }), x, 0.85, -rows / 2 + 0.01));
        }

        // Low partitions between rooms, with a doorway gap in each.
        const segments = new Map();
        const push = (key, seg) => (segments.get(key) || segments.set(key, []).get(key)).push(seg);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = roomAt(c, r);
                const right = c + 1 < cols ? roomAt(c + 1, r) : undefined;
                const down = r + 1 < rows ? roomAt(c, r + 1) : undefined;
                if (right !== undefined && right?.id !== a?.id) {
                    push(`v${c}|${[a?.id, right?.id].sort()}`, { c, r, vertical: true });
                }
                if (down !== undefined && down?.id !== a?.id) {
                    push(`h${r}|${[a?.id, down?.id].sort()}`, { c, r, vertical: false });
                }
            }
        }
        // Doorway: the segment with no furniture on either side, nearest the
        // middle, so people can actually walk through it. Walls and doors are
        // recorded for path finding (keys: v<c>,<r> = between (c,r)|(c+1,r),
        // h<c>,<r> = between (c,r)|(c,r+1)).
        const placed = this.ctx.getState().placedItems || {};
        const solid = (c, r) => { const t = placed[`${c},${r}`]; return !!t && t !== 'rug'; };
        this.doors = new Set();
        this.roomGrid = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) this.roomGrid.push(roomAt(c, r)?.id ?? null);
        }
        for (const segs of segments.values()) {
            const mid = (segs.length - 1) / 2;
            let door = 0;
            let best = Infinity;
            segs.forEach((s, i) => {
                const blockedSides = solid(s.c, s.r) + (s.vertical ? solid(s.c + 1, s.r) : solid(s.c, s.r + 1));
                const score = blockedSides * 10 + Math.abs(i - mid);
                if (score < best) {
                    best = score;
                    door = i;
                }
            });
            segs.forEach((s, i) => {
                if (i === door) {
                    this.doors.add(`${s.vertical ? 'v' : 'h'}${s.c},${s.r}`);
                    return;
                }
                const [x, z] = this.cellCenter(s.c, s.r);
                const wall = s.vertical
                    ? at(box(0.08, 0.45, 1, WALL), x + 0.5, 0.225, z)
                    : at(box(1, 0.45, 0.08, WALL), x, 0.225, z + 0.5);
                this.world.add(wall);
            });
        }

        // Room name plates, and boxes in rooms not opened yet.
        for (const room of office.rooms) {
            const [x, z] = this.cellCenter(room.x, room.y);
            const el = document.createElement('div');
            el.className = `office3d-room${room.planned ? ' planned' : ''}`;
            el.textContent = room.name;
            const label = new CSS2DObject(el);
            label.center.set(0, 0.5);
            label.position.set(x - 0.45, 0.05, z - 0.4);
            this.world.add(label);
            if (room.planned) {
                const [bx, bz] = this.cellCenter(room.x + room.w - 1, room.y + room.h - 1);
                this.world.add(at(cardboardBoxes(), bx, 0, bz));
            }
        }
    }

    buildFurniture() {
        const { placedItems, agents } = this.ctx.getState();
        const key = JSON.stringify(placedItems);
        if (key === this.furnitureKey) return;
        this.furnitureKey = key;
        // Free GPU buffers of the old layout before rebuilding (office edits).
        this.furniture.traverse(o => {
            o.geometry?.dispose();
            o.material?.dispose();
        });
        this.furniture.clear();
        this.spots = [];
        const seats = new Set(agents.map(a => `${a.position?.x},${a.position?.y}`));
        for (const [cell, type] of Object.entries(placedItems)) {
            const make = FURNITURE[type];
            if (!make) continue;
            const [c, r] = cell.split(',').map(Number);
            const [x, z] = this.cellCenter(c, r);
            // Someone sits here: push the furniture in front of them.
            const fz = seats.has(cell) ? z + 0.28 : z;
            this.furniture.add(at(make(), x, 0, fz));
            this.spots.push({ type, x, z: fz, cell: [c, r], seat: seats.has(cell) });
        }
    }

    labelElement(agent) {
        const el = document.createElement('div');
        el.className = 'office3d-agent';
        el.addEventListener('click', () => this.ctx.onAgentClick(agent.id));
        return el;
    }

    renderLabel(entry, agent, bubble) {
        const esc = this.ctx.escapeHtml;
        entry.label.element.innerHTML = `
            ${bubble ? `<div class="office3d-bubble"><span>${esc(bubble)}</span></div>` : ''}
            <div class="office3d-name">
                <i style="background:${STATUS_COLOR[agent.status] || STATUS_COLOR.idle}"></i>${esc(agent.short_name || agent.name)}
            </div>`;
    }

    update() {
        const state = this.ctx.getState();
        this.buildFurniture();
        for (const agent of state.agents) {
            if (!agent.position) continue;
            let entry = this.agents.get(agent.id);
            if (!entry) {
                const model = character(agent.avatar_color);
                const label = new CSS2DObject(this.labelElement(agent));
                label.center.set(0.5, 1);  // anchor the label's bottom above the head
                label.position.set(0, 0.95, 0);
                model.group.add(label);
                model.group.traverse(o => { o.userData.agentId = agent.id; });
                const [x, z] = this.cellCenter(agent.position.x, agent.position.y);
                model.group.position.set(x, 0, z - 0.12);
                this.scene.add(model.group);
                entry = {
                    ...model, label, seed: Math.random() * 10, key: '', color: agent.avatar_color,
                    home: new THREE.Vector3(x, 0, z - 0.12),
                    homeCell: [agent.position.x, agent.position.y],
                    tasks: [], task: null, walkPhase: 0,
                };
                this.agents.set(agent.id, entry);
            }
            const bubble = state.activity[agent.id] || '';
            const key = `${agent.status}|${bubble}`;
            if (key !== entry.key) {
                entry.key = key;
                entry.status = agent.status;
                this.renderLabel(entry, agent, bubble);
            }
        }
    }

    frame() {
        // Don't spend GPU time while the office tab is hidden.
        if (!this.container.offsetParent) return;
        // Clamp: the first frame after the tab was hidden would jump.
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const t = this.clock.elapsedTime;
        for (const entry of this.agents.values()) {
            const p = entry.parts;
            const s = t + entry.seed;
            if (this.runTask(entry, dt, t)) {
                this.animateRing(entry, t);
                continue;
            }
            if (entry.status === 'working') {
                entry.group.position.y = Math.abs(Math.sin(s * 8)) * 0.03;
                p.armL.rotation.x = -0.9 + Math.sin(s * 16) * 0.25;
                p.armR.rotation.x = -0.9 - Math.sin(s * 16) * 0.25;
                p.head.rotation.y = Math.sin(s * 3) * 0.15;
            } else {
                entry.group.position.y = Math.sin(s * 2) * 0.012;
                p.armL.rotation.x = p.armR.rotation.x = 0;
                p.head.rotation.y = Math.sin(s * 0.7) * 0.35;
            }
            this.animateRing(entry, t);
        }
        this.stepEffects(dt);
        if (this.intro) this.stepIntro(dt);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.labels.render(this.scene, this.camera);
    }

    // Effects may start new effects while updating (a hand-over landing
    // starts the burst): collect those separately so none is dropped.
    stepEffects(dt) {
        const running = this.effects;
        this.effects = [];
        const alive = running.filter(effect => effect.update(dt));
        this.effects = alive.concat(this.effects);
    }

    // ===== Motion =====
    // Every motion stands for something that actually happened: a task handed
    // over, work in progress, a result, a record filed, an event scheduled.

    get animating() {
        return !this.reducedMotion && !!this.container.offsetParent;
    }

    startIntro() {
        if (this.reducedMotion) return;
        this.intro = {
            t: 0,
            duration: 1.6,
            from: new THREE.Vector3(17, 18, 21),
            to: this.camera.position.clone(),
            zoomFrom: 0.7,
        };
        this.camera.position.copy(this.intro.from);
        this.camera.zoom = this.intro.zoomFrom;
        this.camera.updateProjectionMatrix();
    }

    stepIntro(dt) {
        const it = this.intro;
        it.t = Math.min(it.t + dt / it.duration, 1);
        const e = 1 - Math.pow(1 - it.t, 3);  // ease-out cubic
        this.camera.position.lerpVectors(it.from, it.to, e);
        this.camera.zoom = it.zoomFrom + (1 - it.zoomFrom) * e;
        this.camera.updateProjectionMatrix();
        if (it.t >= 1) this.intro = null;
    }

    agentColor(id) {
        return this.ctx.getState().agents.find(a => a.id === id)?.avatar_color || '#94a3b8';
    }

    anchor(id) {
        const g = this.agents.get(id)?.group;
        return g ? new THREE.Vector3(g.position.x, 0.75, g.position.z) : null;
    }

    later(seconds, fn) {
        let left = seconds;
        this.effects.push({ update: dt => ((left -= dt) > 0 ? true : (fn(), false)) });
    }

    // Working: a ring in the staff color spreads from under their feet.
    animateRing(entry, t) {
        if (entry.status !== 'working' || this.reducedMotion) {
            if (entry.ring) entry.ring.visible = false;
            return;
        }
        if (!entry.ring) {
            entry.ring = new THREE.Mesh(
                new THREE.RingGeometry(0.2, 0.26, 40),
                new THREE.MeshBasicMaterial({ color: entry.color, transparent: true, depthWrite: false }),
            );
            entry.ring.rotation.x = -Math.PI / 2;
            this.scene.add(entry.ring);
        }
        const phase = (t * 0.9 + entry.seed) % 1;
        entry.ring.visible = true;
        entry.ring.position.set(entry.group.position.x, 0.015, entry.group.position.z);
        entry.ring.scale.setScalar(1 + phase * 1.8);
        entry.ring.material.opacity = 0.75 * (1 - phase);
    }

    // A sheet of paper flies along an arc, after `delay` seconds.
    // Returns the flight time in seconds (excluding the delay).
    flyPaper(from, to, color, { card = false, delay = 0 } = {}) {
        if (!from || !to) return 0;
        const sheet = new THREE.Group();
        // Big enough to read at the default camera distance.
        const w = card ? 0.38 : 0.34;
        const d = card ? 0.28 : 0.44;
        const body = box(w, 0.03, d, card ? 0xfff1c9 : 0xffffff);
        const band = box(w, 0.04, 0.09, new THREE.Color(color).getHex());
        band.position.z = -(d / 2 - 0.045);
        sheet.add(body, band);
        sheet.position.copy(from);
        sheet.visible = delay <= 0;
        this.scene.add(sheet);

        const dist = from.distanceTo(to);
        const duration = 0.75 + dist * 0.06;
        const control = from.clone().lerp(to, 0.5);
        control.y += 1.1 + dist * 0.12;
        let t = 0;
        let wait = delay;
        this.effects.push({
            update: dt => {
                if (wait > 0) {
                    wait -= dt;
                    return true;
                }
                sheet.visible = true;
                t = Math.min(t + dt / duration, 1);
                const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;  // ease-in-out
                const a = from.clone().multiplyScalar((1 - e) * (1 - e));
                const b = control.clone().multiplyScalar(2 * (1 - e) * e);
                const c = to.clone().multiplyScalar(e * e);
                sheet.position.copy(a.add(b).add(c));
                sheet.rotation.y = e * Math.PI * 2;
                sheet.rotation.z = Math.sin(e * Math.PI) * 0.5;
                sheet.scale.setScalar(t > 0.85 ? 1 - (t - 0.85) / 0.15 * 0.8 : 1);
                if (t < 1) return true;
                this.scene.remove(sheet);
                sheet.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
                return false;
            },
        });
        return duration;
    }

    // Done: a small burst of cubes in the staff color.
    burst(id) {
        const origin = this.anchor(id);
        if (!origin) return;
        // From the waist and mostly sideways: the name tag and bubble (DOM,
        // drawn on top) cover the space above the head.
        origin.y = 0.5;
        const colors = [new THREE.Color(this.agentColor(id)).getHex(), 0xffffff, 0xffd166];
        const count = 18;
        for (let i = 0; i < count; i++) {
            const size = 0.07 + (i % 3) * 0.02;
            const cube = box(size, size, size, colors[i % colors.length], { transparent: true });
            cube.castShadow = false;
            cube.position.copy(origin);
            this.scene.add(cube);
            const angle = (i / count) * Math.PI * 2;
            const spread = 1.1 + Math.random() * 0.7;
            const v = new THREE.Vector3(Math.cos(angle) * spread, 1.3 + Math.random() * 0.6, Math.sin(angle) * spread);
            let life = 0;
            this.effects.push({
                update: dt => {
                    life += dt;
                    v.y -= 6 * dt;
                    cube.position.addScaledVector(v, dt);
                    cube.rotation.x += dt * 6;
                    cube.rotation.y += dt * 5;
                    cube.material.opacity = Math.max(0, 1 - Math.max(0, life - 0.5) / 0.5);
                    if (life < 1) return true;
                    this.scene.remove(cube);
                    cube.geometry.dispose();
                    cube.material.dispose();
                    return false;
                },
            });
        }
    }

    nearestSpot(type, from) {
        let best = null;
        let bestDist = Infinity;
        for (const spot of this.spots) {
            if (spot.type !== type) continue;
            const d = Math.hypot(spot.x - from.x, spot.z - from.z);
            if (d < bestDist) {
                best = spot;
                bestDist = d;
            }
        }
        return best;
    }

    // A message was sent: the task flies in from outside to whoever takes it.
    onSend(agentId) {
        if (!this.animating) return;
        const { rows } = this.ctx.getState().office.grid;
        const duration = this.flyPaper(new THREE.Vector3(0, 3.4, rows / 2 + 1.5), this.anchor(agentId), this.agentColor(agentId));
        // A fast reply must not overtake the task that is still flying in.
        this.inFlightUntil = this.clock.elapsedTime + duration;
    }

    // A reply arrived: celebrate, then file the record / pass on the event.
    onResponse({ agent, filed, scheduled }) {
        if (!this.animating) return;
        this.burst(agent);
        const from = this.anchor(agent);
        if (filed && from) {
            if (FILERS.has(agent)) {
                this.fileRecord(agent);
            } else {
                const shelf = this.nearestSpot('bookshelf', from);
                if (shelf) this.flyPaper(from, new THREE.Vector3(shelf.x, 0.9, shelf.z - 0.25), this.agentColor(agent));
            }
        }
        if (scheduled && from) {
            if (agent === 'scheduler') {
                this.scheduleWrite();
            } else {
                const to = this.anchor('scheduler');
                const d = to ? this.flyPaper(from, to, '#e5b93a', { card: true }) : 0;
                this.later(d, () => this.scheduleWrite());
            }
        }
    }

    // ===== Walking staff =====
    // A small task queue per staff member: go somewhere (path found on a
    // half-tile grid that respects partitions, doorways and furniture), act
    // there, carry a sheet, come back.

    enqueue(id, tasks) {
        const entry = this.agents.get(id);
        if (entry) entry.tasks.push(...tasks);
        return !!entry;
    }

    // While working: walk to the right furniture, do the job there, return.
    startErrand(id) {
        if (!this.animating || !ERRANDS[id]) return;
        const tasks = [{ kind: 'wait' }];
        for (const [spot, nth, name, dur] of ERRANDS[id]) {
            tasks.push({ kind: 'goto', target: { spot, nth } }, { kind: 'act', name, dur });
        }
        tasks.push({ kind: 'goto', target: { home: true } });
        this.enqueue(id, tasks);
    }

    // The dispatcher walks the task over. Resolves when it has been handed over.
    deliver(fromId, toId) {
        if (!this.animating || !this.agents.has(fromId) || !this.agents.has(toId)) return Promise.resolve();
        return new Promise(resolve => {
            let handed = false;
            const done = () => { if (!handed) { handed = true; resolve(); } };
            this.enqueue(fromId, [
                { kind: 'wait' },
                { kind: 'carry', on: true },
                {
                    kind: 'goto',
                    target: { agent: toId },
                    // No way through (furniture moved?): throw it instead.
                    onFail: () => this.later(this.flyPaper(this.anchor(fromId), this.anchor(toId), this.agentColor(toId)), done),
                },
                { kind: 'act', name: 'hand', dur: 0.6 },
                { kind: 'carry', on: false },
                { kind: 'run', fn: done },
                { kind: 'goto', target: { home: true } },
            ]);
        });
    }

    fileRecord(id) {
        this.enqueue(id, [
            { kind: 'carry', on: true },
            { kind: 'goto', target: { spot: 'bookshelf', nth: 0 } },
            { kind: 'act', name: 'file', dur: 0.9 },
            { kind: 'carry', on: false },
            { kind: 'goto', target: { home: true } },
        ]);
    }

    scheduleWrite() {
        this.enqueue('scheduler', [
            { kind: 'goto', target: { spot: 'whiteboard', nth: 0 } },
            { kind: 'act', name: 'write', dur: 1.8 },
            { kind: 'goto', target: { home: true } },
        ]);
    }

    // Runs the current task; returns true while the staff member is busy.
    runTask(entry, dt, t) {
        if (!entry.task) {
            entry.task = entry.tasks.shift() || null;
            if (!entry.task) return false;
            this.beginTask(entry, entry.task);
        }
        if (this.stepTask(entry, entry.task, dt, t)) {
            entry.task = null;
            this.resetPose(entry);
        }
        return true;
    }

    beginTask(entry, task) {
        if (task.kind === 'wait') {
            // Don't leave before the task that is flying in has landed.
            task.left = Math.max(0, (this.inFlightUntil || 0) - this.clock.elapsedTime);
        } else if (task.kind === 'act') {
            task.left = task.dur;
        } else if (task.kind === 'goto') {
            const plan = this.planRoute(entry, task.target);
            if (!plan) {
                task.points = [];
                if (task.target.home) {
                    entry.group.position.copy(entry.home);  // never strand anyone
                } else {
                    task.onFail?.();
                }
                task.face = task.target.home ? 0 : entry.group.rotation.y;
            } else {
                task.points = plan.points;
                task.face = plan.face;
            }
        }
    }

    stepTask(entry, task, dt, t) {
        const p = entry.parts;
        switch (task.kind) {
        case 'wait':
            task.left -= dt;
            return task.left <= 0;
        case 'run':
            task.fn();
            return true;
        case 'carry':
            this.setCarrying(entry, task.on);
            return true;
        case 'act': {
            task.left -= dt;
            entry.group.position.y = 0;
            if (task.name === 'search') {
                p.armR.rotation.x = -2.3 + Math.sin(t * 6) * 0.35;
                p.armL.rotation.x = -1.3 + Math.cos(t * 6) * 0.35;
                p.head.rotation.y = Math.sin(t * 2.2) * 0.5;
            } else if (task.name === 'write') {
                p.armR.rotation.x = -1.9 + Math.sin(t * 9) * 0.15;
                p.armR.rotation.z = Math.sin(t * 4) * 0.3;
                p.head.rotation.y = Math.sin(t * 1.5) * 0.12;
            } else if (task.name === 'file') {
                p.armL.rotation.x = p.armR.rotation.x = -2.2 + Math.sin(t * 8) * 0.1;
            } else {  // hand over
                p.armL.rotation.x = p.armR.rotation.x = -1.4;
            }
            return task.left <= 0;
        }
        case 'goto': {
            const g = entry.group;
            let step = WALK_SPEED * dt;
            while (step > 0 && task.points.length) {
                const target = task.points[0];
                const dx = target.x - g.position.x;
                const dz = target.z - g.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist < 1e-4) {
                    task.points.shift();
                    continue;
                }
                g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), 0.35);
                const move = Math.min(step, dist);
                g.position.x += (dx / dist) * move;
                g.position.z += (dz / dist) * move;
                step -= move;
                if (move >= dist) task.points.shift();
            }
            if (task.points.length) {
                entry.walkPhase += dt * 11;
                const swing = Math.sin(entry.walkPhase);
                p.legL.rotation.x = swing * 0.6;
                p.legR.rotation.x = -swing * 0.6;
                if (entry.carrying) {
                    p.armL.rotation.x = p.armR.rotation.x = -1.0;
                } else {
                    p.armL.rotation.x = -swing * 0.5;
                    p.armR.rotation.x = swing * 0.5;
                }
                g.position.y = Math.abs(swing) * 0.035;
                return false;
            }
            g.rotation.y = task.face;
            return true;
        }
        default:
            return true;
        }
    }

    resetPose(entry) {
        const p = entry.parts;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        p.armL.rotation.x = p.armR.rotation.x = 0;
        p.armR.rotation.z = 0;
        p.head.rotation.y = 0;
        entry.group.position.y = 0;
    }

    setCarrying(entry, on) {
        if (on && !entry.paper) {
            entry.paper = new THREE.Group();
            entry.paper.add(box(0.3, 0.03, 0.38, 0xffffff));
            const band = box(0.3, 0.04, 0.08, new THREE.Color(entry.color).getHex());
            band.position.z = -0.15;
            entry.paper.add(band);
            entry.paper.position.set(0, 0.5, 0.26);
            entry.paper.rotation.x = -0.5;
            entry.group.add(entry.paper);
        }
        if (entry.paper) entry.paper.visible = on;
        entry.carrying = on;
    }

    // --- path finding on a half-tile grid ---

    navSize() {
        const { cols, rows } = this.ctx.getState().office.grid;
        return { cols, rows, w: cols * 2, h: rows * 2 };
    }

    nodeCenter(sx, sy) {
        const { cols, rows } = this.navSize();
        return new THREE.Vector3((sx + 0.5) * SUB - cols / 2, 0, (sy + 0.5) * SUB - rows / 2);
    }

    nodeAt(pos) {
        const { cols, rows, w, h } = this.navSize();
        const sx = Math.min(w - 1, Math.max(0, Math.floor((pos.x + cols / 2) / SUB)));
        const sy = Math.min(h - 1, Math.max(0, Math.floor((pos.z + rows / 2) / SUB)));
        return [sx, sy];
    }

    // Furniture and the other staff standing at their desks block the way.
    blockedGrid(moverEntry) {
        const { w, h } = this.navSize();
        const blocked = new Uint8Array(w * h);
        const mark = (sx, sy) => { blocked[sy * w + sx] = 1; };
        for (const spot of this.spots) {
            if (spot.type === 'rug') continue;
            const [c, r] = spot.cell;
            if (spot.seat) {  // desk in the front half, the person in the back half
                mark(2 * c, 2 * r + 1);
                mark(2 * c + 1, 2 * r + 1);
            } else {
                mark(2 * c, 2 * r); mark(2 * c + 1, 2 * r);
                mark(2 * c, 2 * r + 1); mark(2 * c + 1, 2 * r + 1);
            }
        }
        for (const other of this.agents.values()) {
            if (other === moverEntry) continue;
            const [c, r] = other.homeCell;
            mark(2 * c, 2 * r);
            mark(2 * c + 1, 2 * r);
        }
        return blocked;
    }

    // Can you step between two adjacent nodes without walking through a partition?
    crossable(ax, ay, bx, by) {
        const { cols } = this.navSize();
        const ca = ax >> 1, ra = ay >> 1, cb = bx >> 1, rb = by >> 1;
        if (ca === cb && ra === rb) return true;
        if (this.roomGrid[ra * cols + ca] === this.roomGrid[rb * cols + cb]) return true;
        return ca !== cb
            ? this.doors.has(`v${Math.min(ca, cb)},${ra}`)
            : this.doors.has(`h${ca},${Math.min(ra, rb)}`);
    }

    findPath(start, isGoal, blocked) {
        const { w, h } = this.navSize();
        const startIdx = start[1] * w + start[0];
        const prev = new Int32Array(w * h).fill(-1);
        prev[startIdx] = startIdx;
        const queue = [startIdx];
        for (let qi = 0; qi < queue.length; qi++) {
            const idx = queue[qi];
            const x = idx % w, y = (idx / w) | 0;
            if (isGoal(x, y)) {
                const path = [];
                for (let i = idx; i !== startIdx; i = prev[i]) path.push([i % w, (i / w) | 0]);
                return path.reverse();
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const n = ny * w + nx;
                if (prev[n] !== -1 || blocked[n] || !this.crossable(x, y, nx, ny)) continue;
                prev[n] = idx;
                queue.push(n);
            }
        }
        return null;
    }

    // Free node next to (and not walled off from) a given floor tile.
    nextToCell(tc, tr, blocked) {
        const { w } = this.navSize();
        return (x, y) => {
            if ((x >> 1) === tc && (y >> 1) === tr) return false;
            if (blocked[y * w + x]) return false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if ((nx >> 1) === tc && (ny >> 1) === tr && this.crossable(x, y, nx, ny)) return true;
            }
            return false;
        };
    }

    planRoute(entry, target) {
        if (!this.doors || !this.roomGrid) return null;
        const blocked = this.blockedGrid(entry);
        const start = this.nodeAt(entry.group.position);
        const route = (isGoal, faceCell) => {
            const nodes = this.findPath(start, isGoal, blocked);
            if (!nodes) return null;
            const points = nodes.map(([x, y]) => this.nodeCenter(x, y));
            const last = points[points.length - 1] || entry.group.position.clone();
            let face = 0;
            if (faceCell) {
                const [fx, fz] = this.cellCenter(faceCell[0], faceCell[1]);
                face = Math.atan2(fx - last.x, fz - last.z);
            }
            return { points, face };
        };
        if (target.home) {
            const goal = this.nodeAt(entry.home);
            const plan = route((x, y) => x === goal[0] && y === goal[1]);
            if (plan) plan.points.push(entry.home.clone());
            return plan;
        }
        if (target.agent) {
            const other = this.agents.get(target.agent);
            return other ? route(this.nextToCell(...other.homeCell, blocked), other.homeCell) : null;
        }
        // nth nearest piece of furniture of that type that can be reached
        const from = entry.group.position;
        const spots = this.spots
            .filter(sp => sp.type === target.spot)
            .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
        for (const spot of spots.slice(target.nth || 0).concat(spots.slice(0, target.nth || 0))) {
            const plan = route(this.nextToCell(...spot.cell, blocked), spot.cell);
            if (plan) return plan;
        }
        return null;
    }


    resize() {
        const { clientWidth: w, clientHeight: h } = this.container;
        if (!w || !h) return;
        const { cols, rows } = this.ctx.getState().office.grid;
        // Fit the whole floor plan diagonally in view.
        const span = Math.hypot(cols, rows) * 0.4;
        const aspect = w / h;
        const halfH = aspect > 1 ? span : span / aspect;
        Object.assign(this.camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.labels.setSize(w, h);
    }

    resetView() {
        this.intro = null;
        this.camera.position.set(9, 10, 11);
        this.camera.zoom = 1;
        this.camera.updateProjectionMatrix();
        this.controls.target.set(0, 0, 0.3);
        this.controls.update();
    }

    pick(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const targets = [...this.agents.values()].map(a => a.group);
        const hit = this.raycaster.intersectObjects(targets, true)[0];
        return hit?.object.userData.agentId || null;
    }

    handleClick(e) {
        // A drag rotates the camera; only a near-stationary press is a click.
        if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return;
        const id = this.pick(e);
        if (id) this.ctx.onAgentClick(id);
    }

    handleHover(e) {
        if (e.buttons) return;
        this.renderer.domElement.style.cursor = this.pick(e) ? 'pointer' : 'grab';
    }
}

function webglAvailable() {
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch (e) {
        return false;
    }
}

try {
    [THREE, { OrbitControls }, { CSS2DRenderer, CSS2DObject }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/renderers/CSS2DRenderer.js'),
    ]);
    window.Office3D = {
        supported: webglAvailable(),
        mount(container, ctx) {
            return new Office3D(container, ctx);
        },
    };
    window.dispatchEvent(new Event('office3d-ready'));
} catch (err) {
    console.error('three.js failed to load:', err);
    window.office3dFailed = true;
    window.dispatchEvent(new Event('office3d-failed'));
}
