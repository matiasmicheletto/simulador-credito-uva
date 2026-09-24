const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = __dirname;
const distDir = path.join(root, "dist");

function readSource(fileName) {
    return fs.readFileSync(path.join(root, fileName), "utf8");
}

function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s+/g, " ")
        .replace(/\s*([{}:;,>])\s*/g, "$1")
        .replace(/;}/g, "}")
        .trim();
}

function minifyJavaScript(source) {
    let output = "";
    let state = "code";
    let quote = "";

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        const nextCharacter = source[index + 1];

        if (state === "lineComment") {
            if (character === "\n" || character === "\r") state = "code";
            continue;
        }

        if (state === "blockComment") {
            if (character === "*" && nextCharacter === "/") {
                state = "code";
                index += 1;
            }
            continue;
        }

        if (state === "string") {
            output += character;
            if (character === "\\") {
                output += nextCharacter || "";
                index += 1;
            } else if (character === quote) {
                state = "code";
            }
            continue;
        }

        if (state === "template") {
            output += character;
            if (character === "\\") {
                output += nextCharacter || "";
                index += 1;
            } else if (character === "`") {
                state = "code";
            }
            continue;
        }

        if (character === "/" && nextCharacter === "/") {
            state = "lineComment";
            index += 1;
            continue;
        }

        if (character === "/" && nextCharacter === "*") {
            state = "blockComment";
            index += 1;
            continue;
        }

        if (character === "'" || character === '"') {
            state = "string";
            quote = character;
            output += character;
            continue;
        }

        if (character === "`") {
            state = "template";
            output += character;
            continue;
        }

        output += /\s/.test(character) ? " " : character;
    }

    return output.trim();
}

function minifyHtml(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();
}

const css = minifyCss(readSource("index.css"));
const javascript = minifyJavaScript(readSource("index.js"));

new vm.Script(javascript, { filename: "index.js" });

const html = readSource("index.html")
    .replace(/\s*<link\s+rel="stylesheet"\s+href="index\.css"\s*>/i, `<style>${css}</style>`)
    .replace(/\s*<script\s+src="index\.js"><\/script>/i, `<script>${javascript}</script>`);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), `${minifyHtml(html)}\n`);

console.log(`Generado ${path.relative(root, path.join(distDir, "index.html"))}`);