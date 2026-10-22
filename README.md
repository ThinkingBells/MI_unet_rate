# MI_unet_rate

Node **MI_unet_rate** (categoria `advanced/loaders`).

- Llista els models de `models/diffusion_models` (i `models/unet`).
- Fila de 3 estrelles + corona, independents (es poden combinar: p. ex. 3 estrelles i corona). Clic = valorar el model seleccionat; clic a l'última estrella activa = treu-ne una (la primera la deixa a 0); clic a la corona = posar-la/treure-la.
- Les valoracions es desen a `ratings.json` dins la carpeta del node (persistents i compartides entre workflows).

## Instal·lació
Copia la carpeta `MI_unet_rate` a `ComfyUI/custom_nodes/` i reinicia ComfyUI.
- Sota les estrelles hi ha un camp de **nota personal** d'una sola línia per model (clic per editar). Es desa a `notes.json`.
