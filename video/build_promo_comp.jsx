/*
 * Farrukh Dev Hub - After Effects starter comp builder.
 *
 * File > Scripts > Run Script File...  then choose the "assets" folder.
 * Builds a 1920x1080, 30 fps, 46 s composition that follows storyboard.md:
 * background, scene images with Ken Burns, all titles with fades/slides,
 * a 0 -> 37 counter, scene timing, and the music track.
 *
 * Coordinates below are in the 1280x720 design space of the quick-render
 * MP4; K scales them to 1920x1080.
 * NOTE: written for After Effects CC (ExtendScript / ES3 syntax).
 */
(function () {
  var K = 1.5, W = 1920, H = 1080, FPS = 30, DUR = 46;
  var FONT_BOLD = "Orbitron-Bold", FONT_MED = "Orbitron-Medium";
  var CYAN = [34, 211, 238], VIOLET = [139, 92, 246], PINK = [244, 114, 182],
      GREEN = [52, 211, 153], AMBER = [251, 191, 36], BLUE = [96, 165, 250],
      WHITE = [226, 232, 240], GREY = [148, 163, 184];

  function rgb(c) { return [c[0] / 255, c[1] / 255, c[2] / 255]; }

  var scriptFolder = new File($.fileName).parent;
  var assetsFolder = new Folder(scriptFolder.fsName + "/assets");
  if (!assetsFolder.exists) { assetsFolder = Folder.selectDialog("Select the video/assets folder"); }
  if (!assetsFolder) { return; }
  var audioFile = new File(scriptFolder.fsName + "/audio/promo-music.wav");

  app.beginUndoGroup("Build Farrukh promo comp");
  var proj = app.project;
  var comp = proj.items.addComp("Farrukh Promo", W, H, 1, DUR, FPS);
  comp.bgColor = [0.01, 0.02, 0.05];
  comp.openInViewer();

  /* ---------- import footage ---------- */
  var footage = {};
  function imp(name) {
    var f = new File(assetsFolder.fsName + "/" + name + ".png");
    if (!f.exists) { return null; }
    if (!footage[name]) { footage[name] = proj.importFile(new ImportOptions(f)); }
    return footage[name];
  }

  /* ---------- helpers ---------- */
  function fadeIn(layer, t0, dur) {
    var op = layer.property("Transform").property("Opacity");
    op.setValueAtTime(0, 0);
    op.setValueAtTime(t0, 0);
    op.setValueAtTime(t0 + dur, 100);
  }
  function fadeOut(layer, t1, dur) {
    var op = layer.property("Transform").property("Opacity");
    op.setValueAtTime(t1, 100);
    op.setValueAtTime(t1 + dur, 0);
  }
  function slideIn(layer, t0, dur, dx, dy) {
    var p = layer.property("Transform").property("Position");
    var end = p.value;
    p.setValueAtTime(t0, [end[0] + dx, end[1] + dy]);
    p.setValueAtTime(t0 + dur, end);
    try { p.setTemporalEaseAtKey(2, [new KeyframeEase(0, 80)], [new KeyframeEase(0, 80)]); } catch (e) {}
  }

  /* text(str, x, y, size, color, start, end, opts) - x,y in 1280x720 space (y = top of text) */
  function text(str, x, y, size, color, start, end, opts) {
    opts = opts || {};
    var layer = comp.layers.addText(str);
    var prop = layer.property("Source Text");
    var doc = prop.value;
    doc.resetCharStyle();
    doc.fontSize = size * K * 0.9;
    doc.fillColor = rgb(color);
    doc.applyFill = true;
    doc.applyStroke = false;
    try { doc.font = opts.medium ? FONT_MED : FONT_BOLD; } catch (e) {}
    doc.tracking = (opts.track || 0) * 12;
    doc.justification = opts.center ? ParagraphJustification.CENTER_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
    prop.setValue(doc);
    layer.property("Transform").property("Position").setValue([x * K, (y + size * 0.85) * K]);
    layer.inPoint = start;
    layer.outPoint = end;
    var d = opts.delay || 0;
    fadeIn(layer, start + d, 0.5);
    if (end < DUR) { fadeOut(layer, end - 0.1, 0.5); }
    slideIn(layer, start + d, 0.6, opts.dx === undefined ? 0 : opts.dx, opts.dy === undefined ? 24 : opts.dy);
    layer.name = str.substr(0, 28);
    try {
      var glow = layer.property("Effects").addProperty("ADBE Glow");
      glow.property("ADBE Glow-0002").setValue(40);   // threshold
      glow.property("ADBE Glow-0003").setValue(28);   // radius
      glow.property("ADBE Glow-0004").setValue(1.1);  // intensity
    } catch (e2) {}
    return layer;
  }

  /* picture(name, x, y, w, h, start, end, zoomFrom, zoomTo) - cover-fit with Ken Burns */
  function picture(name, x, y, w, h, start, end, z0, z1, dim) {
    var item = imp(name);
    if (!item) { return null; }
    var layer = comp.layers.add(item);
    var s = Math.max(w * K / item.width, h * K / item.height) * 100;
    var sc = layer.property("Transform").property("Scale");
    sc.setValueAtTime(start, [s * z0, s * z0]);
    sc.setValueAtTime(end, [s * z1, s * z1]);
    layer.property("Transform").property("Position").setValue([(x + w / 2) * K, (y + h / 2) * K]);
    layer.inPoint = start;
    layer.outPoint = end;
    fadeIn(layer, start, 0.5);
    if (end < DUR) { fadeOut(layer, end - 0.1, 0.5); }
    if (dim) { layer.property("Transform").property("Opacity").setValueAtTime(start + 0.6, dim * 100); }
    // crop to the frame with a rectangular mask
    var m = layer.Masks.addProperty("Mask");
    var shape = new Shape();
    var hw = item.width / 2, hh = item.height / 2;
    var cw = (w * K) / (s / 100) / 2, ch = (h * K) / (s / 100) / 2;
    shape.vertices = [[hw - cw, hh - ch], [hw + cw, hh - ch], [hw + cw, hh + ch], [hw - cw, hh + ch]];
    shape.closed = true;
    m.property("Mask Path").setValue(shape);
    layer.name = name;
    return layer;
  }

  function frame(x, y, w, h, color, start, end) {
    var sh = comp.layers.addShape();
    var g = sh.property("Contents").addProperty("ADBE Vector Group");
    var r = g.property("Contents").addProperty("ADBE Vector Shape - Rect");
    r.property("Size").setValue([w * K, h * K]);
    r.property("Roundness").setValue(20);
    var st = g.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    st.property("Color").setValue(rgb(color));
    st.property("Stroke Width").setValue(5);
    sh.property("Transform").property("Position").setValue([(x + w / 2) * K, (y + h / 2) * K]);
    sh.inPoint = start; sh.outPoint = end;
    fadeIn(sh, start, 0.5);
    if (end < DUR) { fadeOut(sh, end - 0.1, 0.5); }
    sh.name = "frame";
    return sh;
  }

  /* ---------- background ---------- */
  var bg = comp.layers.addSolid([0.01, 0.02, 0.05], "Background", W, H, 1, DUR);
  try {
    var ramp = bg.property("Effects").addProperty("ADBE Ramp");
    ramp.property("ADBE Ramp-0001").setValue([W / 2, 0]);
    ramp.property("ADBE Ramp-0002").setValue([2 / 255, 4 / 255, 12 / 255, 1]);
    ramp.property("ADBE Ramp-0003").setValue([W / 2, H]);
    ramp.property("ADBE Ramp-0004").setValue([14 / 255, 20 / 255, 52 / 255, 1]);
  } catch (e) {}
  bg.moveToEnd();

  /* ---------- scenes (times from storyboard.md) ---------- */
  // 1 intro
  text("FARRUKH", 640, 232, 150, CYAN, 0.3, 5.5, { center: true, track: 10, dy: 40 });
  text("GAME DEVELOPER  .  FULL STACK  .  AI", 640, 428, 30, [203, 213, 225], 2.2, 5.5, { center: true, medium: true, track: 5 });
  text("PLAYABLE 3D PORTFOLIO", 640, 502, 22, [196, 181, 253], 3.1, 5.5, { center: true, track: 6 });

  // 2 avatar
  text("01 / THE PLAYER", 70, 62, 20, VIOLET, 5, 12, { medium: true, track: 4 });
  text("MEET MY", 70, 120, 66, WHITE, 5.1, 12);
  text("AVATAR", 70, 196, 96, VIOLET, 5.25, 12);
  text("Modelled & rigged in Blender", 104, 362, 25, [203, 213, 225], 5.9, 12, { medium: true, dx: 30, dy: 0 });
  text("Idle . Walk . Wave animations", 104, 424, 25, [203, 213, 225], 6.35, 12, { medium: true, dx: 30, dy: 0 });
  text("Exported as GLB for the web", 104, 486, 25, [203, 213, 225], 6.8, 12, { medium: true, dx: 30, dy: 0 });
  picture("avatar_front_idle", 720, 66, 470, 590, 5.2, 7.2, 1.18, 1.2);
  picture("avatar_three_quarter_wave", 720, 66, 470, 590, 7.0, 9.1, 1.18, 1.2);
  picture("avatar_walk", 720, 66, 470, 590, 8.9, 12, 1.18, 1.2);
  frame(720, 66, 470, 590, CYAN, 5.2, 12);

  // 3 world
  picture("13-sky-night", 0, 0, 1280, 720, 11.5, 15.4, 1.02, 1.07, 0.55);
  picture("14-sky-day", 0, 0, 1280, 720, 14.9, 19, 1.07, 1.1, 0.55);
  text("02 / THE WORLD", 70, 62, 20, CYAN, 11.5, 19, { medium: true, track: 4 });
  text("A PLAYABLE", 70, 250, 54, WHITE, 11.7, 19);
  text("3D ISLAND", 70, 316, 88, CYAN, 11.9, 19);
  text("9 zones  .  collect XP  .  built with Three.js", 70, 436, 24, [203, 213, 225], 12.4, 19, { medium: true });

  // 4 skills
  text("03 / SKILL GROVE", 70, 62, 20, GREEN, 18.5, 25.5, { medium: true, track: 4 });
  var counter = text("0", 66, 100, 210, GREEN, 18.7, 25.5);
  try {
    counter.property("Source Text").expression =
      'Math.round(linear(time, ' + 19.0 + ', ' + 20.8 + ', 0, 37)).toString()';
  } catch (e) {}
  text("SKILLS TO COLLECT", 74, 338, 36, WHITE, 19.5, 25.5);
  text("walk into an orb  ->  +10 XP", 74, 392, 22, GREY, 19.9, 25.5, { medium: true });
  text("FRONTEND . LANGUAGES . BACKEND . DATABASE", 74, 464, 17, CYAN, 20.3, 25.5, { medium: true, track: 2 });
  text("DEVOPS . GAME DEVELOPMENT . AI", 74, 506, 17, PINK, 20.7, 25.5, { medium: true, track: 2 });
  picture("20-skill-grove", 668, 98, 560, 520, 18.8, 25.5, 1.08, 1.13);
  frame(668, 98, 560, 520, GREEN, 18.8, 25.5);

  // 5 projects
  text("04 / ARCADE HALL", 70, 62, 20, PINK, 25, 32.5, { medium: true, track: 4 });
  text("MY PROJECTS", 70, 104, 62, WHITE, 25.1, 32.5);
  text("search  .  filter  .  quest board", 70, 182, 22, GREY, 25.5, 32.5, { medium: true });
  var titles = ["DEVELOPER PORTFOLIO", "MASK JAM", "EMOTION-AWARE AI CONTAINMENT LAB",
                "FRONTEND DEVELOPMENT PROJECTS", "VR PIT STOP GAME", "RAGDOLL FIGHTING GAME"];
  var tcols = [CYAN, PINK, PINK, CYAN, PINK, PINK];
  for (var i = 0; i < titles.length; i++) {
    text(titles[i], 90, 252 + i * 66, 18, tcols[i], 25.9 + i * 0.28, 32.5, { medium: true, dx: 60, dy: 0 });
  }
  picture("22-arcade-hall", 690, 110, 540, 500, 25.3, 32.5, 1.12, 1.17);
  frame(690, 110, 540, 500, PINK, 25.3, 32.5);

  // 6 journey
  picture("29-quest-road-3d", 0, 0, 1280, 720, 32, 38, 1.04, 1.1, 0.38);
  text("05 / QUEST ROAD", 70, 62, 20, AMBER, 32, 38, { medium: true, track: 4 });
  text("THE JOURNEY", 70, 104, 66, WHITE, 32.1, 38);
  var years = ["2026", "2025", "2025", "2023"];
  var roles = ["FULL STACK WEB DEVELOPMENT INTERN", "DEVOPS INTERN", "FRONTEND DEVELOPER", "BS COMPUTER SCIENCE"];
  for (var j = 0; j < 4; j++) {
    var c = (j === 3) ? BLUE : AMBER;
    text(years[j], 190, 244 + j * 92, 30, c, 32.9 + j * 0.45, 38, { dx: 40, dy: 0 });
    text(roles[j], 338, 249 + j * 92, 24, WHITE, 32.9 + j * 0.45, 38, { medium: true, dx: 40, dy: 0 });
  }
  text("7 certificates earned  .  3 years of learning", 70, 640, 22, GREY, 35.2, 38, { medium: true });

  // 7 features
  text("06 / UNDER THE HOOD", 70, 62, 20, VIOLET, 37.5, 42.5, { medium: true, track: 4 });
  text("MORE THAN A PAGE", 70, 104, 54, WHITE, 37.6, 42.5);
  var fh = ["AI CHATBOT", "CONTACT TERMINAL", "DAY / NIGHT", "MOBILE READY"];
  var fd = ["RAG answers grounded in my CV", "validated form, real email", "themes, sound, accessible", "touch joystick & menu"];
  var fc = [VIOLET, GREEN, AMBER, CYAN];
  for (var k = 0; k < 4; k++) {
    text(fh[k], 104, 214 + k * 106, 26, fc[k], 38.1 + k * 0.35, 42.5, { dx: 50, dy: 0 });
    text(fd[k], 104, 252 + k * 106, 20, [203, 213, 225], 38.2 + k * 0.35, 42.5, { medium: true, dx: 50, dy: 0 });
  }
  picture("42-mobile-home", 880, 66, 290, 590, 37.9, 42.5, 1.0, 1.04);
  frame(880, 66, 290, 590, CYAN, 37.9, 42.5);

  // 8 outro
  text("EXPLORE THE", 640, 190, 56, WHITE, 42, DUR, { center: true, track: 6 });
  text("DEV HUB", 640, 262, 150, CYAN, 42.2, DUR, { center: true, track: 8 });
  text("FARRUKH", 640, 452, 36, VIOLET, 43, DUR, { center: true, track: 14 });
  var ps = text("PRESS START", 640, 548, 30, AMBER, 43.6, DUR, { center: true, track: 8 });
  try { ps.property("Transform").property("Opacity").expression = "50 + 50 * Math.sin(time * 5)"; } catch (e3) {}

  /* ---------- music ---------- */
  if (audioFile.exists) {
    var au = proj.importFile(new ImportOptions(audioFile));
    var al = comp.layers.add(au);
    al.property("Audio").property("Audio Levels").setValueAtTime(0, [-48, -48]);
    al.property("Audio").property("Audio Levels").setValueAtTime(1.2, [-4, -4]);
    al.property("Audio").property("Audio Levels").setValueAtTime(DUR - 2.5, [-4, -4]);
    al.property("Audio").property("Audio Levels").setValueAtTime(DUR, [-48, -48]);
  }

  app.endUndoGroup();
  alert("Starter comp built.\n\nNext: add Glow/Grid/Easy Ease polish (see storyboard.md), then File > Save as promo.aep and export H.264 to public/videos/promo.mp4.");
})();
