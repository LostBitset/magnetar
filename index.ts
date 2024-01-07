import { toHtml } from "./md_to_html";

function htmlResponse(src: string): Response {
    let html: string;
    if (src.startsWith("<!DOCTYPE html>")) {
        html = src;
    } else {
        html = `<!DOCTYPE html><html>${src}</html>`;
    }
    return new Response(html, {headers:{"Content-Type":"text/html"}});
}

Bun.serve({
    fetch(request) {
        return htmlResponse(toHtml("# Hello Bun!"));
    },
    port: 7400,
});