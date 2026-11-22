# Submission checklist

## Deliverables the brief asks for
| Module | Deliverable | Status |
|---|---|---|
| 1 | Working portfolio site | In the project - deploy it |
| 2 | `.blend` + exported GLB | `avatar/farrukh-avatar.blend`, `public/models/avatar.glb` |
| 3 | Final MP4 | `public/videos/promo.mp4` (46 s) |
| 3 | After Effects project `.aep` | **YOU:** run `video/build_promo_comp.jsx` in AE, polish, save as `promo.aep` (steps in `video/storyboard.md`), optionally re-export the MP4 from AE |
| 4 | Working chatbot + brief RAG explanation | `backend/` + `backend/README.md` (deploy to Render) |
| 5 | Working form + evidence of delivery | local evidence in `docs/evidence/`; **YOU:** add a real-inbox screenshot |
| 6 | Deployed URL + documentation | **YOU:** follow `docs/DEPLOYMENT.md`; docs are written |
| Report | `docs/PROJECT_REPORT.md` | fill in name, course, URLs, screenshots, section 7 |

## Do these last, in order
1. Add your CV to `backend/knowledge/cv.md` (or `cv.pdf`) -> `cd backend && python -m app.ingest`.
2. Open `/play` in Chrome and press `1`-`4` (gestures), open Settings, toggle high contrast, hover skill orbs, visit `/stats?key=...`.
3. Deploy (DEPLOYMENT.md), run the verify list, take screenshots.
4. Replace the placeholders in the report; export it to PDF/Word if your instructor wants that.
5. Zip: project **without** `node_modules`, `.next`, `.env.local`, `backend/.venv`.
6. Never submit or commit real keys: rotate your Gmail app password if it ever leaks.
