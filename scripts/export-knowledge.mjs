/**
 * Turns the portfolio's own TypeScript data files into plain-text knowledge
 * documents for the RAG chatbot, so the website and the chatbot can never
 * drift apart.   Run:  node scripts/export-knowledge.mjs
 *
 * Each document starts with a small header the ingester reads:
 *   <!-- zone: projects | title: ... -->
 * and each "## " section becomes (at least) one retrievable chunk.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

/** Load a .ts/.tsx data module without a bundler (type imports vanish, icon imports are stubbed). */
function loadTs(rel) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, jsx: ts.JsxEmit.React },
  }).outputText;
  const mod = { exports: {} };
  const stub = new Proxy(() => stub, { get: (_, k) => (k === "__esModule" ? true : stub), apply: () => stub });
  const req = (name) => {
    if (name.startsWith(".")) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const p = path.resolve(path.dirname(file), name + ext);
        if (fs.existsSync(p)) return loadTs(path.relative(root, p));
      }
    }
    return stub; // lucide-react, react, ...
  };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: req, console }, { filename: file });
  return mod.exports;
}

const { Projects } = loadTs("components/Projects/Projects-s.ts");
const { skills } = loadTs("components/Skills/skillsData.ts");
const { experience } = loadTs("components/Experience/ExperiencedData.ts");
const { certificates } = loadTs("components/certificates/certificatesData.ts");
const { story } = loadTs("components/About/StoryData.tsx");
const hero = loadTs("components/hero/hero.data.ts");

const out = path.join(root, "backend", "knowledge");
fs.mkdirSync(out, { recursive: true });
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const list = (a) => (a && a.length ? a.join(", ") : "");
const write = (name, zone, title, body) =>
  fs.writeFileSync(path.join(out, name), `<!-- zone: ${zone} | title: ${title} -->\n${body.trim()}\n`);

/* ---------------- profile ---------------- */
{
  const intro = (hero.DESCRIPTION_WORDS || []).map(([w]) => w).join(" ");
  let b = `# Farrukh — profile\n\n## Who is Farrukh?\nFarrukh is a developer and student. ${clean(intro)}\n\n`;
  b += `## Roles\nFarrukh works across these roles: ${list(hero.ROLES)}.\n\n`;
  b += `## Quick stats\n` + (hero.STATS || []).map((s) => `- ${s.label}: ${s.target}${s.suffix ?? ""}`).join("\n") + "\n\n";
  b += `## About this portfolio\nThis portfolio is a playable 3D world built with Three.js (react-three-fiber) and Next.js. Visitors walk a custom Blender-made avatar around an island with zones for About, Skills, Projects, Experience, Certificates, a promo video, an AI chatbot and a contact terminal. A regular scrolling version called Recruiter Mode is also available.\n`;
  write("profile.md", "plaza", "Profile", b);
}

/* ---------------- about / story ---------------- */
write(
  "about.md",
  "about",
  "About Farrukh (story and background)",
  `# About Farrukh\n\n` +
    story
      .map(
        (s) =>
          `## ${clean(s.title)}${s.subtitle ? " — " + clean(s.subtitle) : ""}\n${clean(s.description)}${
            s.tags?.length ? `\nTopics: ${list(s.tags)}.` : ""
          }`,
      )
      .join("\n\n"),
);

/* ---------------- projects ---------------- */
write(
  "projects.md",
  "projects",
  "Projects",
  `# Farrukh's projects\n\nFarrukh has built ${Projects.length} showcased projects: ${Projects.map((p) => p.title).join("; ")}.\n\n` +
    Projects.map((p) => {
      let s = `## Project: ${clean(p.title)}\nCategory: ${p.category}${p.featured ? " (featured project)" : ""}.\n${clean(p.description)}`;
      if (p.highlight) s += `\nHighlight: ${clean(p.highlight)}`;
      if (p.technologies?.length) s += `\nTechnologies used: ${list(p.technologies)}.`;
      if (p.github && p.github !== "#") s += `\nSource code on GitHub: ${p.github}`;
      if (p.demo && p.demo !== "#") s += `\nDemo website: ${p.demo}`;
      return s;
    }).join("\n\n"),
);

/* ---------------- skills ---------------- */
{
  const byCat = {};
  for (const s of skills) (byCat[s.category] ||= []).push(s);
  let b = `# Farrukh's skills\n\nFarrukh lists ${skills.length} skills and technologies across ${Object.keys(byCat).length} categories.\n\n`;
  for (const [cat, items] of Object.entries(byCat)) {
    b += `## ${cat} skills\nIn the ${cat} category Farrukh works with: ${items.map((s) => `${s.name} (${s.level})`).join(", ")}.\n\n`;
  }
  for (const s of skills) {
    b += `## Skill: ${s.name}\n${s.name} is a ${s.category} skill. Level: ${s.level}. Experience: ${s.experience}. ${clean(s.description)}\n\n`;
  }
  write("skills.md", "skills", "Skills & Technologies", b);
}

/* ---------------- experience & education ---------------- */
write(
  "experience.md",
  "quest",
  "Experience & Education",
  `# Experience and education\n\nSummary of Farrukh's experience and education, newest first: ` +
    experience.map((e) => `${e.year} ${clean(e.role)}${e.current ? " (current)" : ""}`).join("; ") +
    `.\n\n` +
    experience
      .map((e) => {
        const kind = e.type === "education" ? "Education" : "Experience";
        return `## ${kind}: ${clean(e.role)} (${e.year})\n${kind} entry for ${e.year}${e.current ? " (current)" : ""}: ${clean(e.role)}${
          e.company ? " — " + clean(e.company) : ""
        }.\n${clean(e.description)}${e.technologies?.length ? `\nTechnologies: ${list(e.technologies)}.` : ""}`;
      })
      .join("\n\n"),
);

/* ---------------- certificates ---------------- */
write(
  "certificates.md",
  "trophy",
  "Certificates & Achievements",
  `# Certificates and achievements\n\nFarrukh has ${certificates.filter((c) => c.status === "completed").length} completed certificates and ${
    certificates.filter((c) => c.status !== "completed").length
  } in progress. Completed: ${certificates.filter((c) => c.status === "completed").map((c) => clean(c.title)).join("; ")}. In progress: ${
    certificates.filter((c) => c.status !== "completed").map((c) => clean(c.title)).join("; ") || "none"
  }.\n\n` +
    certificates
      .map(
        (c) =>
          `## Certificate: ${clean(c.title)}\nIssued by ${clean(c.issuer)} in ${c.year}. Status: ${c.status === "completed" ? "completed" : "in progress"}.\n${clean(c.description)}${
            c.skills?.length ? `\nSkills covered: ${list(c.skills)}.` : ""
          }`,
      )
      .join("\n\n"),
);

console.log("knowledge exported to", path.relative(root, out));
for (const f of fs.readdirSync(out)) console.log(" -", f, fs.statSync(path.join(out, f)).size, "bytes");
