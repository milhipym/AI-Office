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
        this.renderer.domElement.addEventListener('pointerdown', e => { this.downAt = [e.clientX, e.clientY]; });
        this.renderer.domElement.addEventListener('pointerup', e => this.handleClick(e));
        this.renderer.domElement.addEventListener('pointermove', e => this.handleHover(e));

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);

        this.buildWorld();
        this.update();
        this.resetView();
        this.resize();

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
        for (const segs of segments.values()) {
            const door = Math.floor(segs.length / 2);
            segs.forEach((s, i) => {
                if (i === door) return;
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
        const seats = new Set(agents.map(a => `${a.position?.x},${a.position?.y}`));
        for (const [cell, type] of Object.entries(placedItems)) {
            const make = FURNITURE[type];
            if (!make) continue;
            const [c, r] = cell.split(',').map(Number);
            const [x, z] = this.cellCenter(c, r);
            // Someone sits here: push the furniture in front of them.
            this.furniture.add(at(make(), x, 0, seats.has(cell) ? z + 0.28 : z));
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
                entry = { ...model, label, seed: Math.random() * 10, key: '' };
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
        const t = this.clock.getElapsedTime();
        for (const entry of this.agents.values()) {
            const p = entry.parts;
            const s = t + entry.seed;
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
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.labels.render(this.scene, this.camera);
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
