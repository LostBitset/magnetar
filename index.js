let demo = `

# This is a test

Here's a paragraph. 

And some code:
\`\`\`js
console.log([] + {});
console.log({} + []);
\`\`\`

Some inline math, which looks like this: $\\vec{u} \\cdot \\vec{v} = \\sum_i u_i v_i$. You can also have display math:

$$\\vec{u} \\cdot \\vec{v} = \\sum_i u_i v_i$$

Last but not least, here's the cool GFM thingies:

> [!NOTE]
> These are GFM-specific, and the options are:
> * Note
> * Tip
> * Important
> * Warning
> * Caution

`.trim();

import { Marked } from 'marked';
import markedAlert from 'marked-alert';
import markedKatex from 'marked-katex-extension';

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

const head = `
<style>
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
h1 {
    font-size: 40px;
}
p {
    font-size: 18px;
}
body {
    background-color: #111;
    color: white;
}
</style>
`.trim();

let converted = new Marked()
    .use(markedAlert({
        className: "gfm-alert",
    }))
    .use(markedKatex({
        output: "mathml",
    }))
    .parse(demo);

await Bun.write("demo.html", head + `<body>${converted}</body>`);
