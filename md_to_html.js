import { Marked } from 'marked';
import markedAlert from 'marked-alert';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js';
import { markedHighlight } from 'marked-highlight';

import css from 'highlight.js/styles/atom-one-dark.min.css';

const gfmAlertTypes = {
    "note": "#1f6feb",
    "tip": "#3fb950",
    "important": "#a371f7",
    "warning": "#d29922",
    "caution": "#f85149",
};

function gfmAlertCss([name, color]) {
    return `
.gfm-alert-${name} .gfm-alert-title {
    color: ${color};
}
.gfm-alert-${name} .gfm-alert-title path {
    fill: ${color};
}
.gfm-alert-${name} {
    border-left: 2px solid ${color};
}
    `.trim();
}

const head1 = `
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>`;

const head2 = `</title>
<style>
${await Bun.file(css).text()}
${Object.entries(gfmAlertTypes).map(gfmAlertCss).join("\n").trimEnd()}
.gfm-alert {
    padding-left: 10px;
}
.gfm-alert-title {
    font-size: 18px;
}
.gfm-alert-title svg {
    margin-right: 10px;
}
math:not([display="block"]) {
    font-size: 20px;
}
math[display="block"] {
    font-size: 24px;
}
p {
    font-size: 18px;
}
pre {
    width: max-content;
}
body {
    background-color: #111;
    color: white;
}
</style>
`.trim();


let customMarked = new Marked(markedHighlight({
    langPrefix: "hljs language-",
    highlight: (code, lang) => hljs.highlight(code, {language: lang}).value,
}))
    .use(markedAlert({
        className: "gfm-alert",
    }))
    .use(markedKatex({
        output: "mathml",
    }));

export function toHtml(md) {
    let head = head1 + md.match(/^# .*/)[0].slice(2) + head2;
    return head + `<body>${customMarked.parse(md)}</body>`;
}
