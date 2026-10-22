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

async function saveRating(name, stars, crown) {
    if (stars || crown) ratings[name] = { stars, crown };
    else delete ratings[name];
    try {
        await api.fetchApi("/unet_rating/rate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, stars, crown }),
        });
    } catch (e) {
        console.warn("[UNET Rating] error desant la valoració", e);
    }
}

let notes = {};

async function fetchNotes() {
    try {
        const r = await api.fetchApi("/unet_rating/notes");
        notes = await r.json();
    } catch (e) {
        console.warn("[UNET Rating] no s'han pogut carregar les notes", e);
    }
}

async function saveNote(name, note) {
    if (note) notes[name] = note;
    else delete notes[name];
    try {
        await api.fetchApi("/unet_rating/note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, note }),
        });
    } catch (e) {
        console.warn("[UNET Rating] error desant la nota", e);
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

// valoració = 0-3 estrelles + corona (independents, es poden combinar)
const CROWN = 4; // posició de la corona a la fila
const SLOTS = 4;
const SLOT_GAP = 10; // espai extra abans de la corona

function crownPath(ctx, cx, cy, r) {
    const w = r * 1.0, h = r * 0.8;
    const l = cx - w, rt = cx + w, top = cy - h, bot = cy + h;
    ctx.beginPath();
    ctx.moveTo(l, bot);
    ctx.lineTo(l, top + h * 0.2);
    ctx.lineTo(cx - w * 0.5, cy);
    ctx.lineTo(cx, top);
    ctx.lineTo(cx + w * 0.5, cy);
    ctx.lineTo(rt, top + h * 0.2);
    ctx.lineTo(rt, bot);
    ctx.closePath();
}

const slotX = (i) => i * (STAR + GAP) + (i === CROWN - 1 ? SLOT_GAP : 0);
const rowX0 = (width) => (width - slotX(SLOTS - 1) - STAR) / 2;

const starsOnly = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const starsText = (r) => (r.crown ? "👑" : "") + starsOnly(r.stars);

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
    const entries = [...menu.querySelectorAll(".litemenu-entry")].filter((e) => !e.querySelector(".mi-stars"));
    const nameOf = (e) => e.dataset.value ?? e.textContent.trim();
    // només si el menú conté algun model valorat (evita tocar altres menús)
    if (!entries.some((e) => ratings[nameOf(e)])) return;
    for (const entry of entries) {
        const r = ratings[nameOf(entry)];
        const span = document.createElement("span");
        span.className = "mi-stars";
        span.style.cssText = "margin-right:12px;white-space:nowrap;font-family:monospace;";
        // la corona i les estrelles sense valorar reserven espai (invisible) per alinear els noms
        const crown = document.createElement("span");
        crown.textContent = "👑";
        crown.style.cssText = "margin-right:4px;" + (r?.crown ? "" : "visibility:hidden;");
        const stars = document.createElement("span");
        stars.textContent = starsOnly(r?.stars || 3);
        stars.style.cssText = r?.stars ? "color:#ffc107;" : "visibility:hidden;";
        span.append(crown, stars);
        entry.prepend(span);
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

            const current = () => ratings[combo.value] || { stars: 0, crown: false };
            decorateComboDraw(combo);

            const widget = {
                name: "rating",
                type: "unet_rating",
                value: 0,
                serialize: false,
                options: { serialize: false },
                computeSize: (width) => [width, STAR + 10],
                draw(ctx, _node, width, y) {
                    const cur = current();
                    // sempre mostra l'estat real (el mateix que el camp del nom); el ratolí només ressalta la icona
                    const starsShown = cur.stars;
                    const crownShown = cur.crown;
                    const x0 = rowX0(width);
                    const cy = y + (STAR + 10) / 2;
                    for (let i = 0; i < SLOTS; i++) {
                        const cx = x0 + slotX(i) + STAR / 2;
                        const lit = i === CROWN - 1 ? crownShown : i < starsShown;
                        if (i === CROWN - 1) crownPath(ctx, cx, cy, STAR / 2);
                        else starPath(ctx, cx, cy, STAR / 2);
                        const hot = hover === i + 1;
                        ctx.fillStyle = lit ? "#ffc107" : hot ? "#5a5a5a" : "#3a3a3a";
                        ctx.fill();
                        ctx.strokeStyle = lit ? "#b38600" : hot ? "#aaa" : "#666";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                },
                mouse(event, pos) {
                    const width = node.size[0];
                    const x0 = rowX0(width);
                    let idx = 0;
                    for (let i = 0; i < SLOTS; i++) {
                        const sx = x0 + slotX(i);
                        if (pos[0] >= sx - GAP / 2 && pos[0] <= sx + STAR + GAP / 2) idx = i + 1;
                    }
                    const inside = idx > 0;

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
                        const cur = current();
                        if (idx === CROWN) {
                            // la corona s'activa/desactiva sense tocar les estrelles
                            saveRating(combo.value, cur.stars, !cur.crown);
                        } else {
                            // clic sobre l'estrella ja activa = esborrar les estrelles
                            saveRating(combo.value, idx === cur.stars ? 0 : idx, cur.crown);
                        }
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

            // nota personal d'una sola línia, guardada per model
            const noteWidget = node.addWidget(
                "text",
                "nota",
                "",
                (value) => {
                    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
                    noteWidget.value = clean;
                    saveNote(combo.value, clean);
                },
                { serialize: false }
            );
            noteWidget.serialize = false;

            // mantén la nota sincronitzada amb el model triat (també en carregar un workflow)
            let shownFor = null;
            const drawStars = widget.draw;
            widget.draw = function (...args) {
                if (shownFor !== combo.value) {
                    shownFor = combo.value;
                    noteWidget.value = notes[combo.value] || "";
                }
                return drawStars.apply(this, args);
            };

            // repinta les estrelles quan canvia el model triat
            const cb = combo.callback;
            combo.callback = function () {
                cb?.apply(this, arguments);
                node.setDirtyCanvas(true);
            };

            Promise.all([fetchRatings(), fetchNotes()]).then(() => {
                shownFor = null;
                node.setDirtyCanvas(true);
            });
        };
    },
});
