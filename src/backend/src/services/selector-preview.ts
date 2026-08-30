import * as cheerio from 'cheerio';
import { createClient, fetchHtml } from '../scraper-engine/http.js';

/**
 * Injected into the previewed page. Hovering highlights nodes; clicking sends a
 * generated CSS selector plus XPath back to the builder through postMessage.
 */
const INSPECTOR = [
  '<style id="sf-inspector-style">',
  '.sf-hover { outline: 2px solid #bd93f9 !important; outline-offset: 1px !important; cursor: crosshair !important; }',
  '.sf-picked { outline: 2px solid #50fa7b !important; outline-offset: 1px !important; }',
  '#sf-badge { position: fixed; z-index: 2147483647; left: 12px; bottom: 12px; font: 12px/1.4 ui-monospace, Menlo, monospace; background: #282a36; color: #f8f8f2; padding: 8px 10px; border-radius: 8px; border: 1px solid #44475a; max-width: 60vw; pointer-events: none; white-space: pre-wrap; }',
  '</style>',
  '<script>',
  '(function () {',
  '  var badge = document.createElement("div");',
  '  badge.id = "sf-badge";',
  '  badge.textContent = "ScrapeForge picker: hover an element, click to capture";',
  '  var last = null;',
  '  function cssPath(el) {',
  '    if (!el || el.nodeType !== 1) return "";',
  '    if (el.id) return "#" + CSS.escape(el.id);',
  '    var parts = [];',
  '    var node = el;',
  '    while (node && node.nodeType === 1 && parts.length < 6) {',
  '      var part = node.tagName.toLowerCase();',
  '      var raw = (node.className || "").toString().trim().split(/\\s+/);',
  '      var classes = raw.filter(function (c) { return c && c !== "sf-hover" && c !== "sf-picked" && !/[0-9]{4,}/.test(c); }).slice(0, 2);',
  '      if (classes.length) part += "." + classes.map(function (c) { return CSS.escape(c); }).join(".");',
  '      var parent = node.parentElement;',
  '      if (parent && !classes.length) {',
  '        var twins = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });',
  '        if (twins.length > 1) part += ":nth-of-type(" + (twins.indexOf(node) + 1) + ")";',
  '      }',
  '      parts.unshift(part);',
  '      if (node.id) { parts[0] = "#" + CSS.escape(node.id); break; }',
  '      node = node.parentElement;',
  '    }',
  '    return parts.join(" > ");',
  '  }',
  '  function xPath(el) {',
  '    if (el.id) return "//*[@id=\'" + el.id + "\']";',
  '    var segs = [];',
  '    for (var node = el; node && node.nodeType === 1; node = node.parentNode) {',
  '      var i = 1;',
  '      for (var sib = node.previousSibling; sib; sib = sib.previousSibling) {',
  '        if (sib.nodeType === 1 && sib.nodeName === node.nodeName) i++;',
  '      }',
  '      segs.unshift(node.nodeName.toLowerCase() + "[" + i + "]");',
  '    }',
  '    return "/" + segs.join("/");',
  '  }',
  '  document.addEventListener("mouseover", function (e) {',
  '    if (last && last.classList) last.classList.remove("sf-hover");',
  '    last = e.target;',
  '    if (last && last.classList) last.classList.add("sf-hover");',
  '  }, true);',
  '  document.addEventListener("click", function (e) {',
  '    e.preventDefault();',
  '    e.stopPropagation();',
  '    var el = e.target;',
  '    var attrs = {};',
  '    Array.prototype.forEach.call(el.attributes || [], function (a) { attrs[a.name] = a.value; });',
  '    var selector = cssPath(el);',
  '    var matches = 0;',
  '    try { matches = document.querySelectorAll(selector).length; } catch (err) { matches = 0; }',
  '    Array.prototype.forEach.call(document.querySelectorAll(".sf-picked"), function (n) { n.classList.remove("sf-picked"); });',
  '    el.classList.add("sf-picked");',
  '    badge.textContent = selector + "  (" + matches + " matches)";',
  '    parent.postMessage({',
  '      source: "scrapeforge-picker",',
  '      selector: selector,',
  '      xpath: xPath(el),',
  '      tag: el.tagName.toLowerCase(),',
  '      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 200),',
  '      attributes: attrs,',
  '      matches: matches',
  '    }, "*");',
  '  }, true);',
  '  function mount() { if (document.body) document.body.appendChild(badge); }',
  '  document.addEventListener("DOMContentLoaded", mount);',
  '  mount();',
  '})();',
  '</script>',
].join('\n');

/** Fetch a page, neutralise its scripts, and inject the element picker. */
export async function buildPreview(url: string) {
  const client = createClient({});
  const html = await fetchHtml(client, url);
  const $ = cheerio.load(html);

  $('script').remove();
  $('noscript').remove();
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('form').attr('onsubmit', 'return false');
  $('a').attr('target', '_self');

  if (!$('base').length) $('head').prepend('<base href="' + url + '">');
  $('head').append(INSPECTOR);

  return $.html();
}

/** Test a selector against the live page: match count plus sample values. */
export async function describeSelector(url: string, selector: string) {
  const client = createClient({});
  const html = await fetchHtml(client, url);
  const $ = cheerio.load(html);
  const nodes = $(selector);

  return {
    selector,
    matches: nodes.length,
    samples: nodes
      .slice(0, 5)
      .toArray()
      .map((el) => {
        const node = $(el);
        return {
          text: node.text().replace(/\s+/g, ' ').trim().slice(0, 160),
          html: (node.html() ?? '').slice(0, 240),
          attributes: 'attribs' in el ? el.attribs : {},
        };
      }),
  };
}
