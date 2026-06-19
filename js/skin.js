/**
 * Two content-pane skins: "dark" and "sunny". A skin is just a name plus a
 * set of CSS custom properties all the actual color/spacing/typography
 * decisions live in css/style.css as `[data-skin="..."] { --token: value }`
 * blocks. This module only ever touches one attribute on <html>, so there's
 * a single place that can move the whole site's mood.
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

  // the skin resets to "dark" on a fresh page load by design (no localStorage/sessionStorage dependency).
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
