import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "UNETLoaderRated";
const STAR = 22;
const GAP = 4;

let ratings = {};

async function fetchRatings() {
    try {
        const r = await api.fetchApi("/unet_rating/ratings");
        ratings = await r.json();
    } catch (e) {
        console.warn("[UNET Rating] no s'han pogut carregar les valoracions", e);
    }
}

async function saveRating(name, rating) {
    if (rating) ratings[name] = rating;
    else delete ratings[name];
    try {
        await api.fetchApi("/unet_rating/rate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, rating }),
        });
    } catch (e) {
        console.warn("[UNET Rating] error desant la valoració", e);
    }
}

function starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r : r * 0.45;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
}

const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

// Dibuixa el combo amb les estrelles al final del nom (només mentre pinta).
function decorateComboDraw(widget) {
    for (const key of ["draw", "drawWidget"]) {
        const orig = widget[key];
        if (typeof orig !== "function") continue;
        widget[key] = function (...args) {
            const r = ratings[this.value];
            if (this.__miDecorating || !r) return orig.apply(this, args);
            const real = this.value;
            this.__miDecorating = true;
            // al davant: el nom es trunca per la dreta i les estrelles s'haurien d'amagar
            this.value = `${starsText(r)}  ${real}`;
            try {
                return orig.apply(this, args);
            } finally {
                this.value = real;
                this.__miDecorating = false;
            }
        };
    }
}

// Afegeix les estrelles al final de cada entrada de la llista desplegable.
function decorateMenu(menu) {
    for (const entry of menu.querySelectorAll(".litemenu-entry")) {
        if (entry.querySelector(".mi-stars")) continue;
        const name = entry.dataset.value ?? entry.textContent.trim();
        const r = ratings[name];
        if (!r) continue;
        const span = document.createElement("span");
        span.className = "mi-stars";
        span.textContent = starsText(r);
        span.style.cssText = "margin-left:12px;color:#ffc107;white-space:nowrap;";
        entry.appendChild(span);
    }
}

function watchMenus() {
    new MutationObserver(() => {
        document.querySelectorAll(".litecontextmenu").forEach(decorateMenu);
    }).observe(document.body, { childList: true, subtree: true });
}

app.registerExtension({
    name: "UNETRating.Stars",

    async setup() {
        await fetchRatings();
        watchMenus();
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            const node = this;
            const combo = node.widgets.find((w) => w.name === "unet_name");
            let hover = 0;

            const current = () => ratings[combo.value] || 0;
            decorateComboDraw(combo);

            const widget = {
                name: "rating",
                type: "unet_rating",
                value: 0,
                serialize: false,
                options: { serialize: false },
                computeSize: (width) => [width, STAR + 10],
                draw(ctx, _node, width, y) {
                    const shown = hover || current();
                    const total = 5 * STAR + 4 * GAP;
                    const x0 = (width - total) / 2;
                    const cy = y + (STAR + 10) / 2;
                    for (let i = 0; i < 5; i++) {
                        starPath(ctx, x0 + i * (STAR + GAP) + STAR / 2, cy, STAR / 2);
                        ctx.fillStyle = i < shown ? "#ffc107" : "#3a3a3a";
                        ctx.fill();
                        ctx.strokeStyle = i < shown ? "#b38600" : "#666";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                },
                mouse(event, pos) {
                    const width = node.size[0];
                    const total = 5 * STAR + 4 * GAP;
                    const x0 = (width - total) / 2;
                    const idx = Math.floor((pos[0] - x0) / (STAR + GAP)) + 1;
                    const inside = idx >= 1 && idx <= 5 && pos[0] >= x0 && pos[0] <= x0 + total;

                    if (event.type === "pointermove" || event.type === "mousemove") {
                        const h = inside ? idx : 0;
                        if (h !== hover) {
                            hover = h;
                            node.setDirtyCanvas(true);
                        }
                        return false;
                    }
                    if (event.type === "pointerdown" || event.type === "mousedown") {
                        if (!inside) return false;
                        // clic sobre l'estrella ja activa = esborrar valoració
                        const next = idx === current() ? 0 : idx;
                        saveRating(combo.value, next);
                        node.setDirtyCanvas(true);
                        return true;
                    }
                    if (event.type === "pointerleave" || event.type === "mouseleave") {
                        hover = 0;
                        node.setDirtyCanvas(true);
                    }
                    return false;
                },
            };

            node.addCustomWidget(widget);

            // repinta les estrelles quan canvia el model triat
            const cb = combo.callback;
            combo.callback = function () {
                cb?.apply(this, arguments);
                node.setDirtyCanvas(true);
            };

            fetchRatings().then(() => node.setDirtyCanvas(true));
        };
    },
});
