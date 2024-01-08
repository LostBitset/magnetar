import { toHtml } from "./md_to_html";

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

Bun.serve({
    fetch(req) {
        let url = new URL(req.url);
        if (url.pathname === "/") {
            return notFoundResponse("1");
        } else if (url.pathname.startsWith("/edit/")) {
            return notFoundResponse("2");
        } else if (url.pathname.startsWith("/view/")) {
            return htmlResponse(toHtml("# Hello Bun!"));
        } else {
            return notFoundResponse(toHtml("# Page Not Found"));
        }
    },
    port: 7400,
});