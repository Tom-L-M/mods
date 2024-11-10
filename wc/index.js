const fs = require('node:fs');
const { parseArgv } = require('../shared');

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            return true;
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}

const isSTDINActive = () => !process.stdin.isTTY;

/**
 * @param {buffer} input
 */
function countBytes(input) {
    return input.length.toString();
}

/**
 * @param {buffer} input
 */
function countChars(input) {
    return (input.toString('ascii').match(/.|\s|\r|\n/g) || []).length;
}

/**
 * @param {buffer} input
 */
function countWords(input) {
    return input
        .toString('utf-8')
        .replaceAll(/\s+/g, ' ')
        .split(' ')
        .filter(v => !!v.trim())
        .length.toString();
}

/**
 * @param {buffer} input
 */
function countLines(input) {
    return (input.toString('utf-8').split('\n').length - 1).toString();
}

const help = `
    [wc-js]
        A "wc" command line utility in NodeJS.
        It stands for a word/line/byte counting utility.
    Usage:
        node wc [file] [options]
      OR
        <stdin> | node wc [options]

    Options:  
        -h | --help                 Print the help message and quits.
        -v | --version              Prints the version info and quits.
        -n | --lines                Print the newline counts.
        -c | --bytes                Print the byte counts.
        -m | --chars                Print the character counts.
        -w | --words                Print the word counts.

    Info:
        Multiple options can be selected at a time, and printing 
        is always in the following order: line, word, character, byte.`;

(async function () {
    const fromSTDIN = isSTDINActive();
    const file = process.argv[2];
    const opts = {
        h: 'help',
        v: 'version',
        n: 'lines',
        c: 'bytes',
        m: 'chars',
        w: 'words',
        L: 'max-line-length',
    };

    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;

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
    else input = await readStdinAsync();

    // Precedence:
    //  lines >> words >> chars >> bytes

    let output = [];

    if (args.lines) output.push(countLines(input));
    if (args.words) output.push(countWords(input));
    if (args.chars) output.push(countChars(input));
    if (args.bytes) output.push(countBytes(input));
    if (!args.lines && !args.words && !args.chars && !args.bytes) {
        return console.log(
            [countLines(input), countWords(input), countChars(input)].join(' ')
        );
    } else {
        return console.log(output.join(' '));
    }
})();
