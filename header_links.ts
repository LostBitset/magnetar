import { listMdSources } from "./list_md_sources";

export function addHeaderLinks(md: string, headerIndex: HeaderIndex): string {
    let output = md;
    for (const key of headerIndex.keys()) {
        // Credit to http://stackoverflow.com/a/3561711/556609
        let keyEsc = key.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
        let keyRegex = new RegExp(keyEsc, "gi")
        output = output.replaceAll(
            keyRegex,
            match => `[${match}](/headers/${encodeURIComponent(key)})`,
        );
    }
    return output;
}

export type HeaderIndex = Map<string, HeaderRef[]>;

type HeaderRef = {
    path: string,
    start: number,
    end: number,
};

export async function readHeaderRef(ref: HeaderRef): Promise<string> {
    let file = Bun.file(`./content/${ref.path}.md`);
    return (await file.text()).slice(ref.start, ref.end);
}

function countOccurences(s: string, c: string, start: number & keyof typeof s): number {
    let i = start;
    let count = 0;
    while (s.slice(i, i + c.length) === c) {
        i += c.length;
        count += 1;
    }
    return count;
}

function sliceUntil(s: string, c: string, start: number & keyof typeof s): string {
    let end = start;
    while (s.slice(end, end + c.length) !== c) {
        end += 1;
    }
    return s.slice(start, end);
}

const headerRegexes = [1, 2, 3, 4, 5, 6].map(
    i => new RegExp(`^#{1,${i}} `, "m")
);

export async function populateHeaderIndex(headerIndex: HeaderIndex) {
    for await (const path of listMdSources()) {
        console.log(`⮱ ${decodeURIComponent(path)}`);
        let file = Bun.file(`./content/${path}.md`);
        let text = await file.text();
        let start: number & keyof typeof text = 0;
        let end: number & keyof typeof text = 0;
        let octothorpes: number & keyof typeof text = 0;
        contentLoop: 
            while (true) {
                let offset = start + octothorpes;
                start = text.slice(offset).search(/^#+ /m);
                if (start >= 0) {
                    start += offset;
                } else {
                    break contentLoop;
                }
                octothorpes = countOccurences(text, "#", offset);
                offset = start + octothorpes;
                end = text.slice(offset).search(headerRegexes[octothorpes - 1]);
                if (end >= 0) {
                    end += offset;
                } else {
                    end = text.length;
                }
                if (octothorpes === 0) continue;
                let key = sliceUntil(text, "\n", offset + 1);
                if (!headerIndex.has(key)) headerIndex.set(key, []);
                let ref = {
                    path, start, end,
                };
                let array = headerIndex.get(key)!;
                if (!array.includes(ref)) {
                    console.log(`  ⮱ ${key}`);
                    array.push(ref);
                }
            }
    }
}
