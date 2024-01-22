import { toHtml } from "./md_to_html";
import {
    addHeaderLinks, populateHeaderIndex, purgeHeaderIndexByPath, readHeaderRef,
    type HeaderIndex,
} from "./header_links";
import { listMdSources } from "./list_md_sources";
import { mkdir, readdir, unlink } from "fs/promises";
import { rmdir as rmdirCallback } from "fs";

function rmdir(path: PathLike): Promise<void> {
    return new Promise((resolve, reject) => {
        rmdirCallback(path, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

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

const homeNewDir = "# [📚](/new_dir)";

function homeHeader(p1: string): string {
    return `# ${decodeURIComponent(p1)} [📕](/new_doc/${p1})`;
}

function homeLine(p1: string, p2: string): string {
    const link =
        (text: string, path: string) =>
            `[${decodeURIComponent(text)}](/${path}/${p1}/${p2})`
    return `- ${link(p2, "view")} ${link("✏️", "edit")} ${link("🗑️", "confirm_delete")}`;
}

function editableify(path: string, contentNow: string, title?: string): string {
    const fetchpath = `/api.write/${path}?allow_stale_header_index`;
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
    const updatejs =`${fetchjs}.then(() => ${reloadjs});throttledPopulate()`;
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
                <script>
                let populateTimeout = null;
                function throttledPopulate() {
                    if (populateTimeout === null) {
                        fetch("/api.pop_header_index")
                            .then(() => ${reloadjs})
                            .then(() => {
                                populateTimeout = setTimeout(() => {
                                    populateTimeout = null;
                                }, 5000);
                            });
                    }
                }
                </script>
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

function makePromptPage(
    title: string, resultjs: string, pathjs: string, afterjs?: string,
): string {
    const tohomejs = "window.location = '/';";
    return toHtml("", title)
    .replace(
        "<body>",
        `
        <body>
            <script>
            let result = ${resultjs};
            if (result) {
                fetch(${pathjs}, {
                    method: 'POST',
                    cache: 'no-cache',
                    headers: {
                        'X-Csrf-Protection': 'sherbert lemon',
                    },
                })
                    .then(() => {
                        ${afterjs ?? tohomejs}
                    });
            } else {
                window.history.back();
            }
            </script>
        `.trim(),
    );
}

const newDirPage = makePromptPage(
    "Creating a directory...",
    `prompt('Choose a name for your directory:')`,
    '`/api.new_dir/${result}`',
    'window.location = `/new_doc/${result}#new_dir_also`;',
);

function newDocPage(dir: string): string {
    return makePromptPage(
        "Creating a document...",
        `prompt('Choose a name for your document:')`,
        `\`/api.new_doc/${dir}/\${result}\``,
    );
}

function confirmDeletePage(path: string): string {
    return makePromptPage(
        "Are you sure?",
        `confirm('Are you sure you want to delete ${path}?')`,
        `'/api.delete/${path}'`,
    );
}

const allowedOrigins = Bun.env["MAGNETAR_ORIGINS"]!.split(",");
console.log(
    `Registered allowed origins (${allowedOrigins}).`
);

let headerIndex: HeaderIndex = new Map();
await populateHeaderIndex(headerIndex);
let headerIndexStale = false;
console.log(`Created header index (${headerIndex.size} entries).`);

const port = 7400;
console.log(`Serving (on port ${port})...`);

Bun.serve({
    async fetch(req) {
        console.log();
        let url = new URL(req.url);
        console.log(`┏━━ ${url.pathname}`);
        const route = (start: string, exact?: "exact", middle?: string) => {
            const matches = exact ? url.pathname === start : url.pathname.startsWith(start);
            if (matches) {
                if (middle) {
                    console.log(middle);
                }
                console.log(`┗■━ ${exact ? "(exact match)" : `${start}...`}`);
            }
            return matches;
        };
        const repopulateHeaderIndexIfNecessary = () => {
            if (headerIndexStale && !url.searchParams.has("allow_stale_header_index")) {
                populateHeaderIndex(headerIndex);
                headerIndexStale = false;
            }
        };
        if (url.pathname.startsWith("/api.")) {
            const origin = req.headers.get("Origin");
            if (!origin) {
                console.log(`┃\n┗□━ ORIGIN NOT FOUND`);
                return new Response("origin not found", { status: 400 });
            }
            if (!allowedOrigins.includes(origin)) {
                console.log(`┃\n┗□━ ORIGIN (${origin}) NOT ALLOWED`);
                return new Response("origin not allowed", { status: 400 });
            }
            const antiCsrfHeader = req.headers.get("X-Csrf-Protection");
            if (!antiCsrfHeader) {
                console.log(`┃\n┗□━ ANTI-CSRF HEADER NOT FOUND`);
                return new Response("anti-csrf header not found", { status: 400 });
            }
            if (antiCsrfHeader !== "sherbert lemon") {
                console.log(`┃\n┗□━ ANTI-CSRF HEADER INVALID`);
                return new Response("anti-csrf header invalid", { status: 400 });
            }
        }
        if (route("/favicon.ico", "exact", '┃')) {
            return new Response(Bun.file("./favicon.ico"));
        }
        if (route("/", "exact", '┃')) {
            let map = new Map<string, string[]>();
            for await (const pair of listMdSources()) {
                let [k, v] = pair.split("/");
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(v);
            }
            let md = Array.from(map.entries())
            .map(
                ([h, items]) =>
                `${homeHeader(h)}\n${items.map(i => homeLine(h, i)).join("\n")}`
                ).join("\n");
                return htmlResponse(toHtml(`${md}\n${homeNewDir}`, "(Magnetar Home)"));
            }
            if (route("/new_dir", "exact", '┃')) {
                return htmlResponse(newDirPage);
            }
            if (route("/new_doc/", undefined, '┃')) {
            const dir = url.pathname.slice("/new_doc/".length);
            return htmlResponse(newDocPage(dir));
        }
        if (route("/api.pop_header_index")) {
            populateHeaderIndex(headerIndex);
            headerIndexStale = false;
            return new Response("ok");
        }
        let secondSlashIndex = url.pathname.slice(1).indexOf("/");
        let what = url.pathname.slice(secondSlashIndex + 2);
        console.log(`┃   ${" ".repeat(secondSlashIndex + 2)}${"▔".repeat(what.length)}`);
        if (what.includes("..")) {
            console.log(`┗□━ LFI ATTACK DETECTED`);
            return new Response("lfi attack detected", { status: 400 });
        }
        if (route("/edit/")) {
            let file = Bun.file(`./content/${what}.md`);
            let content = await file.text();
            return htmlResponse(
                editableify(
                    what,
                    content,
                    `[Editing] ${decodeURIComponent(what.slice(what.indexOf("/") + 1))}`,
                ),
            );
        }
        if (route("/view/")) {
            repopulateHeaderIndexIfNecessary();
            let file = Bun.file(`./content/${what}.md`);
            return htmlResponse(
                toHtml(addHeaderLinks(await file.text(), headerIndex))
            );
        }
        if (route("/headers/")) {
            repopulateHeaderIndexIfNecessary();
            let refs = headerIndex.get(decodeURIComponent(what));
            if (!refs) return htmlResponse(toHtml("# Something Went Wrong"));
            let md = addHeaderLinks(
                (await Promise.all(refs.map(readHeaderRef))).join("\n"),
                headerIndex,
            );
            return htmlResponse(toHtml(md, `"${decodeURIComponent(what)}"`));
        }
        if (route("/confirm_delete/")) {
            return htmlResponse(confirmDeletePage(decodeURIComponent(what)));
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
            purgeHeaderIndexByPath(headerIndex, what);
            headerIndexStale = true;
            return new Response("ok");
        }
        if (route("/api.delete/")) {
            await unlink(`./content/${what}.md`);
            let slashIndex = what.indexOf("/");
            let dir = what.slice(0, slashIndex);
            let dirFilesystem = `./content/${dir}`;
            let empty = (await readdir(dirFilesystem)).length === 0;
            if (empty) {
                await rmdir(dirFilesystem);
            }
            purgeHeaderIndexByPath(headerIndex, what);
            headerIndexStale = true;
            return new Response("ok");
        }
        if (route("/api.new_dir/")) {
            let dir = url.pathname.slice("/api.new_dir/".length);
            await mkdir(`./content/${dir}`);
            return new Response("ok");
        }
        if (route("/api.new_doc/")) {
            await Bun.write(`./content/${what}.md`, "");
            return new Response("ok");
        }
        console.log("┗□━ NOT FOUND")
        return notFoundResponse(toHtml("# Page Not Found"));
    },
    port: port,
});
