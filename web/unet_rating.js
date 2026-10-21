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

app.registerExtension({
    name: "UNETRating.Stars",

    async setup() {
        await fetchRatings();
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
