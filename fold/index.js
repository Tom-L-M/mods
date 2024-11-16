const fs = require('node:fs');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

const help = `
    [fold-js]
        A "fold" command line utility in NodeJS.

    Usage:
        fold <file> [options]
      OR
        <stdin> | fold [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -w | --width N          Splits the input into lines of width N.
        -i | --ignore-lf        Ignores newlines when splitting with fixed width.
        -s | --spaces           Break at word boundaries, the last blank before the max length.`;

// const chunkify = (string, chunkSize = 1) =>
//     string.match(new RegExp(`.{1,${chunkSize >= 1 ? chunkSize : 1}}`, 'gim')) ??
//     [];

// function splitStringWithSpaces(inputString) {
//     const result = [];
//     let buffer = ''; // To accumulate words or spaces

//     for (let char of inputString) {
//         if (char === ' ') {
//             // If we encounter a space, check if buffer has a word
//             if (buffer && buffer !== ' ') {
//                 result.push(buffer);
//                 buffer = '';
//             }
//             // Accumulate spaces
//             buffer += char;
//         } else {
//             // If we encounter a non-space, check if buffer has spaces
//             if (buffer.startsWith(' ')) {
//                 result.push(buffer);
//                 buffer = '';
//             }
//             // Accumulate non-space characters
//             buffer += char;
//         }
//     }

//     // Push the final buffer content, if any
//     if (buffer) {
//         result.push(buffer);
//     }

//     return result;
// }

// function foldString(input, width) {
//     if (width < 1) throw new Error('Width must be at least 1');

//     // const words = input.split(/( )/).map(v => (v === '' ? ' ' : v)); // Split input by whitespace
//     const words = splitStringWithSpaces(input);
//     let lines = []; // To hold each line of the final output
//     let currentLine = ''; // The current line being built

//     for (let i = 0; i < words.length; i++) {
//         let word = words[i];
//         // Check if adding this word would exceed the width
//         if ((currentLine + word).length > width || word.includes('\n')) {
//             // Push the current line and reset it
//             lines.push(currentLine);
//             if (word.startsWith(' ')) word = word.slice(1);
//             currentLine = word; // Start a new line with the current word
//         } else {
//             // Otherwise, add the word to the current line
//             currentLine += word;
//         }
//     }

//     // Push the last line if it has any content
//     if (currentLine.trim()) {
//         lines.push(currentLine);
//     }

//     return lines
//         .map(v => v.split('\n'))
//         .flat()
//         .join('\n');
// }

function fold(string, width = 80, { force = false, ignoreLf = false } = {}) {
    const chunkify = (s, w) =>
        s.match(new RegExp(`.{1,${w >= 1 ? w : 1}}`, 'gim')) ?? [];

    if (!width) width === 10000;
    if (ignoreLf) string = string.replaceAll(/\r?\n/gi, ' ');

    const lines = string.split(/\r?\n\r?/gi);
    const result = [];
    for (let line of lines) {
        if (force) {
            result.push(...chunkify(line, width));
            continue;
        }
        while (line.length > width) {
            let maxslice = line.slice(0, width);
            let spaceindex = maxslice.lastIndexOf(' ');
            if (spaceindex >= 0) {
                result.push(maxslice.slice(0, spaceindex));
            } else {
                maxslice = line;
                spaceindex = maxslice.indexOf(' ');
                if (spaceindex >= 0) {
                    result.push(maxslice.slice(0, spaceindex));
                } else {
                    result.push(...maxslice.split(' '));
                    spaceindex = maxslice.length;
                }
            }
            line = line.slice(spaceindex + 1);
        }
        if (line.length <= width) result.push(line);
    }
    return result;
}

function formatInput(input, { width = 80, preserveWords = false, ignoreLf }) {
    // if (ignoreLf) input = input.replaceAll(/\r?\n/gi, ' ');
    // if (preserveWords) return fold(input, width, { force: preserveWords });
    // return chunkify(input, width).join('\n');
    return fold(input, width, { force: !preserveWords, ignoreLf }).join('\n');
}

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('spaces', { alias: 's', allowValue: false });
    parser.option('width', { alias: 'w', allowCasting: true });
    parser.option('ignore-lf', { alias: 'i', allowValue: false });
    parser.argument('file');

    const args = parser.parseArgv();

    if (args.help || (!fromSTDIN && !args.file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;
    const ignoreLf = Boolean(args['ignore-lf']);

    let width = parseInt(args.width);
    if (isNaN(width) || !width) width = undefined;
    let preserveWords = Boolean(args['spaces']);

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(args.file);
        } catch {
            return console.log(`Error: Could not read file ${args.file}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
    }

    process.stdout.write(
        formatInput(input.toString('utf-8'), { width, preserveWords, ignoreLf })
    );
})();
