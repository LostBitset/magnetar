import { toHtml } from "./md_to_html";
import {
    addHeaderLinks, populateHeaderIndex, type HeaderIndex, readHeaderRef,
} from "./header_links";
import { listMdSources } from "./list_md_sources";

function htmlResponse(src: string): Response {
    let html: string;
    if (src.startsWith("<!DOCTYPE html>")) {
        html = src;
    } else {
        html = `<!DOCTYPE html><html>${src}</html>`;
    }
    return new Response(html, {headers: {"Content-Type": "text/html"}});
}

function notFoundResponse(html: string): Response {
    return new Response(html, {
        status: 404,
        headers: {"Content-Type": "text/html"},
    })
}

function homeLine(p1: string, p2: string): string {
    return `- [${p2}](/view/${p1}/${p2}) \([edit](/edit/${p1}/${p2})\)`;
}

function editableify(path: string, contentNow: string, title?: string): string {
    const fetchpath = `/api.write/${path}`;
    const fetchjs = `fetch('${fetchpath}', {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'text/markdown',
            'X-Csrf-Protection': 'sherbert lemon',
        },
        body: this.value,
    })`;
    const reloadjs = "document.getElementById('editresult').contentWindow.location.reload()";
    const updatejs =`${fetchjs}.then(() => ${reloadjs})`;
    return toHtml("", title)
        .replace(
            "<head>",
            `
            <head>
                <style>
                .split-wrapper {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                }
                textarea.editor {
                    position: absolute;
                    width: calc(100% - 16px);
                    height: 100%;
                    color: inherit;
                    background-color: inherit;
                    border: none;
                }
                textarea:focus {
                    outline: none;
                }
                iframe#editresult {
                    border: none;
                    position: absolute;
                    width: 50%;
                    height: 100%;
                }
                </style>
            `.trim(),
        )
        .replace(
            "<body>",
            `
            <body>
                <div class="split-wrapper">
                    <div>
                        <textarea
                            oninput="${updatejs}" class="editor"
                        >${Bun.escapeHTML(contentNow)}</textarea>
                    </div>
                    <div>
                        <iframe src="/view/${path}" id="editresult">
            `.trim(),
        )
        .replace("</body>", "</div></div></body>")
}

let headerIndex: HeaderIndex = new Map();

populateHeaderIndex(headerIndex);

Bun.serve({
    async fetch(req) {
        let url = new URL(req.url);
        if (url.pathname.startsWith("/api.")) {
            if (req.headers.get("X-Csrf-Protection") !== "sherbert lemon") {
                return new Response("no sea surfing", { status: 400 });
            }
        }
        if (url.pathname === "/") {
            let map = new Map<string, string[]>();
            for await (const pair of listMdSources()) {
                let [k, v] = pair.split("/");
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(v);
            }
            let md = Array.from(map.entries()).map(
                ([h, items]) => `# ${h}\n${items.map(i => homeLine(h, i)).join()}`
            ).join();
            return htmlResponse(toHtml(md, "(Magnetar Home)"));
        } else if (url.pathname.startsWith("/edit/")) {
            let what = url.pathname.slice("/edit/".length);
            let file = Bun.file(`./content/${what}.md`);
            let content = await file.text();
            return htmlResponse(
                editableify(
                    what,
                    content,
                    `[Editing] ${what.slice(what.indexOf("/") + 1)}`,
                ),
            );
        } else if (url.pathname.startsWith("/view/")) {
            let what = url.pathname.slice("/view/".length);
            let file = Bun.file(`./content/${what}.md`);
            return htmlResponse(
                toHtml(addHeaderLinks(await file.text(), headerIndex))
            );
        } else if (url.pathname.startsWith("/headers/")) {
            let what = decodeURIComponent(url.pathname.slice("/headers/".length));
            let refs = headerIndex.get(what);
            if (!refs) return htmlResponse(toHtml("# Something Went Wrong"));
            let md = addHeaderLinks(
                (await Promise.all(refs.map(readHeaderRef))).join("\n"),
                headerIndex,
            );
            return htmlResponse(toHtml(md, `"${what}"`));
        } else if (url.pathname.startsWith("/api.write/")) {
            if (req.method.toUpperCase() !== "POST") {
                return new Response("please POST", { status: 405 });
            }
            if (!req.body) {
                return new Response("needs a body", { status: 400 });
            }
            let what = decodeURIComponent(url.pathname.slice("/api.write/".length));
            let file = Bun.file(`./content/${what}.md`);
            let writer = file.writer();
            for await (const chunk of req.body!) {
                writer.write(chunk);
            }
            writer.end();
            return new Response("ok");
        } else {
            return notFoundResponse(toHtml("# Page Not Found"));
        }
    },
    port: 7400,
});