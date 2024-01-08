import { readdir } from "node:fs/promises";

export async function* listMdSources(): AsyncGenerator<string, void> {
    let dirs = await readdir("./content");
    for (const dir of dirs) {
        let files = await readdir(`./content/${dir}`);
        for (const file of files) {
            yield `${dir}/${file.slice(0, -3)}`;
        }
    }
}
