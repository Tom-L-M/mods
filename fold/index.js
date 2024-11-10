const fs = require('node:fs');
const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

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

const chunkify = (string, chunkSize = 1) =>
    string.match(new RegExp(`.{1,${chunkSize >= 1 ? chunkSize : 1}}`, 'gim')) ??
    [];

function foldText(input, width, ignoreLF) {
    if (width < 1) throw new Error('Width must be at least 1');

    const words = input.split(ignoreLF ? / +/ : /\s+/); // Split input by whitespace
    let lines = []; // To hold each line of the final output
    let currentLine = ''; // The current line being built

    for (const word of words) {
        // Check if adding this word would exceed the width
        if ((currentLine + word).length > width) {
            // Push the current line and reset it
            lines.push(currentLine.trim());
            currentLine = word + ' '; // Start a new line with the current word
        } else {
            // Otherwise, add the word to the current line
            currentLine += word + ' ';
        }
    }

    // Push the last line if it has any content
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }

    // Join lines with newline characters
    return lines.join('\n');
}

function formatInput(
    input,
    { width = 80, preserveWords = false, ignoreLF = false }
) {
    if (preserveWords) return foldText(input, width, ignoreLF);
    if (ignoreLF) input = input.replaceAll('\n', ' ');
    return chunkify(input, width).join('\n');
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const opts = {
        h: 'help',
        v: 'version',
        w: 'width',
        i: 'ignore-lf',
        s: 'spaces',
    };

    const args = parseArgv(opts, { allowWithNoDash: false });
    const file = process.argv[2];

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;

    let ignoreLF = args['ignore-lf'];

    let width = parseInt(args.width);
    if (isNaN(width) || !width) width = undefined;
    let preserveWords = Boolean(args['spaces']);

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
    }

    process.stdout.write(
        formatInput(input.toString('utf-8'), { width, preserveWords, ignoreLF })
    );
})();
