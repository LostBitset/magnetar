import { toHtml } from "./md_to_html";
import {
    addHeaderLinks, populateHeaderIndex, type HeaderIndex, readHeaderRef,
} from "./header_links";
import { listMdSources } from "./list_md_sources";
import { unlink } from "fs/promises";

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
    const link = (text: string, path: string) => `[${text}](/${path}/${p1}/${p2})`
    return `- ${link(p2, "view")} ${link("✏️", "edit")} ${link("🗑️", "confirm_delete")}`;
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

function confirmDeletePage(path: string): string {
    return toHtml("", "Are you sure?")
        .replace(
            "<body>",
            `
            <body>
                <script>
                let result = confirm('Are you sure you want to delete ${path}?');
                if (result) {
                    fetch('/api.delete/${path}', {
                        method: 'POST',
                        cache: 'no-cache',
                        headers: {
                            'X-Csrf-Protection': 'sherbert lemon',
                        },
                    })
                        .then(() => {
                            window.history.back();
                        });
                } else {
                    window.history.back();
                }
                </script>
            `.trim(),
        )
}

const allowedOrigins = Bun.env["MAGNETAR_ORIGINS"]!.split(",");
console.log(
    `Registered allowed origins (${allowedOrigins}).`
);

let headerIndex: HeaderIndex = new Map();
await populateHeaderIndex(headerIndex);
console.log(`Created header index (${headerIndex.size} entries).`);

const port = 7400;
console.log(`Serving (on port ${port})...`);

Bun.serve({
    async fetch(req) {
        let url = new URL(req.url);
        console.log(`┏━━ ${url.pathname}`);
        const route = (start?: string) => {
            const matches = start ? url.pathname.startsWith(start) : url.pathname === "/";
            if (matches) {
                console.log(`┗■━ ${start ?? "(root)"}...`);
            }
            return matches;
        };
        if (url.pathname.startsWith("/api.")) {
            const origin = req.headers.get("Origin");
            if (!origin) {
                console.log(`┗□━ ORIGIN NOT FOUND`);
                return new Response("origin not found", { status: 400 });
            }
            if (!allowedOrigins.includes(origin)) {
                console.log(`┗□━ ORIGIN (${origin}) NOT ALLOWED`);
                return new Response("origin not allowed", { status: 400 });
            }
            const antiCsrfHeader = req.headers.get("X-Csrf-Protection");
            if (!antiCsrfHeader) {
                console.log(`┗□━ ANTI-CSRF HEADER NOT FOUND`);
                return new Response("anti-csrf header not found", { status: 400 });
            }
            if (antiCsrfHeader !== "sherbert lemon") {
                console.log(`┗□━ ANTI-CSRF HEADER INVALID`);
                return new Response("anti-csrf header invalid", { status: 400 });
            }
        }
        let secondSlashIndex = url.pathname.slice(1).indexOf("/");
        let what = url.pathname.slice(secondSlashIndex + 2);
        if (what.includes("..")) {
            console.log(`┗□━ LFI ATTACK DETECTED`);
            return new Response("lfi attack detected", { status: 400 });
        }
        if (route()) {
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
        }
        if (route("/edit/")) {
            let file = Bun.file(`./content/${what}.md`);
            let content = await file.text();
            return htmlResponse(
                editableify(
                    what,
                    content,
                    `[Editing] ${what.slice(what.indexOf("/") + 1)}`,
                ),
            );
        }
        if (route("/view/")) {
            let file = Bun.file(`./content/${what}.md`);
            return htmlResponse(
                toHtml(addHeaderLinks(await file.text(), headerIndex))
            );
        }
        if (route("/headers/")) {
            let refs = headerIndex.get(what);
            if (!refs) return htmlResponse(toHtml("# Something Went Wrong"));
            let md = addHeaderLinks(
                (await Promise.all(refs.map(readHeaderRef))).join("\n"),
                headerIndex,
            );
            return htmlResponse(toHtml(md, `"${what}"`));
        }
        if (route("/confirm_delete/")) {
            return htmlResponse(confirmDeletePage(what));
        }
        if (route("/api.write/")) {
            if (req.method.toUpperCase() !== "POST") {
                return new Response("please POST", { status: 405 });
            }
            if (!req.body) {
                return new Response("needs a body", { status: 400 });
            }
            let file = Bun.file(`./content/${what}.md`);
            let writer = file.writer();
            for await (const chunk of req.body!) {
                writer.write(chunk);
            }
            writer.end();
            return new Response("ok");
        }
        if (route("/api.delete/")) {
            await unlink(`./content/${what}.md`);
            return new Response("ok");
        }
        console.log("┗□━ NOT FOUND")
        return notFoundResponse(toHtml("# Page Not Found"));
    },
    port: port,
});
