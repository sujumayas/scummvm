/* Grog Engine — boot: one-call game startup. */
(function () {
  'use strict';
  const Grog = window.Grog;

  // Grog.boot(projectOrUrl, container, opts) -> Promise<engine>
  Grog.boot = async function (project, container, opts = {}) {
    if (typeof project === 'string') {
      const res = await fetch(project);
      project = await res.json();
    }
    Grog.clearSpriteCache();
    await Grog.loadAssets(project);
    const engine = new Grog.Engine(project, container || document.body, opts);
    document.title = (project.meta && project.meta.title) || document.title;
    await engine.start();
    return engine;
  };
})();
