/**
 * Two content-pane skins: "dark" and "sunny".
 */

const Skin = (() => {
  const SKINS = ['dark', 'sunny'];
  let current = 'dark';

  function list() {
    return SKINS.slice();
  }

  function get() {
    return current;
  }

  function set(name) {
    if (!SKINS.includes(name)) return false;
    current = name;
    document.documentElement.setAttribute('data-skin', name);
    document.dispatchEvent(new CustomEvent('skinchange', { detail: { name } }));
    return true;
  }

  function init() {
    set('dark');
  }

  return { list, get, set, init };
})();

// This is the crucial line Vite was looking for
export default Skin;