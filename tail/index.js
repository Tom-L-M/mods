const fs = require('node:fs');
const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

const help = `
    [tail-js]
        A "tail" command line utility in NodeJS.

    Usage:
        node tail [file] [options]
      OR
        <stdin> | node tail [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -n | --lines <X>        The number of lines to read (default: 10).
        -c | --bytes <X>        The number of bytes to read (instead of lines).

    Examples:
        cat somefile.txt | node tail -n 5       # Prints last 5 lines from file
        node tail somefile.txt -n 5             # Also prints last 5 lines from file`;

function slice(data, { lines, bytes } = {}) {
    if (bytes)
        // bytes have preference over lines
        return data.slice(-bytes - 1);
    else return data.toString('utf-8').split('\n').slice(-lines).join('\n');
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const file = process.argv[2];
    const opts = { n: 'lines', h: 'help', c: 'bytes', v: 'version' };
    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;
    let lines = parseInt(args.lines) || 10;
    let bytes = parseInt(args.bytes) || null;

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

    process.stdout.write(slice(input, { lines, bytes }));
    // process.stdout.');
})();
