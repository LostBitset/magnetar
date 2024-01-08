import { toHtml } from "./md_to_html";
import {
    addHeaderLinks, populateHeaderIndex, type HeaderIndex, readHeaderRef,
} from "./header_links";

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

let headerIndex: HeaderIndex = new Map();

populateHeaderIndex(headerIndex);

Bun.serve({
    async fetch(req) {
        let url = new URL(req.url);
        if (url.pathname === "/") {
            let md = "# This is the home page";
            return htmlResponse(toHtml(md));
        } else if (url.pathname.startsWith("/edit/")) {
            return notFoundResponse("2");
        } else if (url.pathname.startsWith("/view/")) {
            let what = url.pathname.slice("/view/".length);
            let file = Bun.file(`./content/${what}.md`)
            return htmlResponse(
                toHtml(addHeaderLinks(await file.text(), headerIndex))
            );
        } else if (url.pathname.startsWith("/headers/")) {
            let what = decodeURIComponent(url.pathname.slice("/headers/".length));
            let refs = headerIndex.get(what);
            if (!refs) return htmlResponse(toHtml("# Something Went Wrong"));
            return htmlResponse(
                toHtml(addHeaderLinks(
                    (await Promise.all(refs.map(readHeaderRef))).join(),
                    headerIndex,
                ))
            );
        } else {
            return notFoundResponse(toHtml("# Page Not Found"));
        }
    },
    port: 7400,
});