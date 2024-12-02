const fs = require('node:fs');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

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
        node wc [options] <file> 
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

    // TODO: add flag "L: 'max-line-length'"
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('lines', { alias: 'n', allowValue: false });
    parser.option('bytes', { alias: 'c', allowValue: false });
    parser.option('chars', { alias: 'm', allowValue: false });
    parser.option('words', { alias: 'w', allowValue: false });
    parser.argument('file');

    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.file)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    let input;

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
