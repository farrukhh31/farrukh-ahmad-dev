<div align="center">

# ✅ Submission Checklist

**Everything the brief asks for, and what is still on you.**

</div>

## Deliverables

| Module | Deliverable | Status |
|:--:|---|---|
| 1 | Working portfolio site | 🟡 In the project, **deploy it** |
| 2 | `.blend` + exported GLB | ✅ `avatar/farrukh-avatar.blend`, `public/models/avatar.glb` |
| 3 | Final MP4 | ✅ `public/videos/promo.mp4` (46 s) |
| 3 | After Effects project `.aep` | 🔴 **You:** run `video/build_promo_comp.jsx` in AE, polish, save as `promo.aep` (steps in `video/storyboard.md`), optionally re-export the MP4 from AE |
| 4 | Working chatbot + brief RAG explanation | 🟡 `backend/` (deploy to Render); RAG explained in `docs/PROJECT_REPORT.md` |
| 5 | Working form + evidence of delivery | 🟡 Local evidence in `docs/evidence/`. **You:** add a real-inbox screenshot |
| 6 | Deployed URL + documentation | 🟡 **You:** follow `docs/DEPLOYMENT.md`; docs are written |
| Report | `docs/PROJECT_REPORT.md` | 🔴 Fill in name, course, URLs, screenshots and section 7 |

✅ done &nbsp;·&nbsp; 🟡 needs your action &nbsp;·&nbsp; 🔴 you must produce it

## Do these last, in order

- [ ] **1 · Add your CV** to `backend/knowledge/cv.md` (or `cv.pdf`), then `cd backend && python -m app.ingest`
- [ ] **2 · Test in Chrome:** open `/play`, press `1`–`4` (gestures), open Settings, toggle high contrast, hover skill orbs, visit `/stats?key=...`
- [ ] **3 · Deploy** ([DEPLOYMENT.md](DEPLOYMENT.md)), run the verify list, take screenshots
- [ ] **4 · Replace the placeholders** in the report; export it to PDF/Word if your instructor wants that
- [ ] **5 · Zip the project** *without* `node_modules`, `.next`, `.env.local` and `backend/.venv`
- [ ] **6 · Check for leaks:** never submit or commit real keys. Rotate your Gmail app password if it ever leaks

> [!WARNING]
> `.env.local` contains secrets. Double-check it is not inside the zip you submit or the repo you push.
