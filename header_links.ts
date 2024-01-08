import { listMdSources } from "./list_md_sources";

export function addHeaderLinks(md: string, headerIndex: HeaderIndex): string {

}

export type HeaderIndex = Map<string, HeaderRef[]>;

type HeaderRef = {
    path: string,
    start: number,
    end: number,
};

function countOccurences(s: string, c: string, start: number & keyof typeof s): number {
    let i = start;
    let count = 0;
    while (s.slice(i, i + c.length) === c) {
        i += c.length;
        count += 1;
    }
    return count;
}

const headerRegexes = [1, 2, 3, 4, 5, 6].map(
    i => new RegExp(`^#{1,${i}} `)
);

export async function populateHeaderIndex(headerIndex: HeaderIndex) {
    for await (const path of listMdSources()) {
        let file = Bun.file(`./content/${path}.md`);
        let text = await file.text();
        let start: number & keyof typeof text = 0;
        let end: number & keyof typeof text = 0;
        let octothorpes: number & keyof typeof text = 0;
        contentLoop: 
            while (true) {
                start = text.slice(start + octothorpes).search(/^#+ /);
                console.log(start + octothorpes);
                console.log("---");
                if (start >= 0) {
                    start += end;
                } else {
                    break contentLoop;
                }
                octothorpes = countOccurences(text, "#", start);
                end = text.slice(start + octothorpes).search(headerRegexes[octothorpes - 1]);
                if (end === -1) {
                    end = text.length;
                } else {
                    end += start;
                }
                console.log(start, end);
            }
    }
}
