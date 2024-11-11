const fs = require('node:fs');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

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
        -n | --lines <[+]N>     The number of lines to read (default: 10).
        -c | --bytes <[+]N>     The number of bytes to read (instead of lines).

    Info:
        Line and byte numeric options may be prefixed with '+' in order
        to reverse counting start. E.g. "-n 2" selects the last 2 lines, while
        "-n +2" selects everything except the first 2 lines.

    Examples:
        cat file.txt | node tail -n 5       # Prints last 5 lines from file
        node tail file.txt -n 5             # Also prints last 5 lines from file
        node tail file.txt -n +5            # Prints everything except the first 5 lines`;

function slice(data, { lines, bytes, reverse } = {}) {
    // bytes have preference over lines
    if (bytes) {
        if (reverse) return data.slice(bytes - 1);
        return data.slice(-bytes);
    }
    if (lines) {
        data = data.toString('utf-8').split('\n');
        if (reverse) return data.slice(lines - 1).join('\n');
        return data.slice(-lines - 1).join('\n');
    }
}

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('lines', { alias: 'n' });
    parser.option('bytes', { alias: 'c' });
    parser.argument('file');

    const args = parser.parseArgv();

    if (args.help || (!fromSTDIN && !args.file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input,
        reverse = args.bytes?.startsWith('+') || args.lines?.startsWith('+');
    let lines = parseInt(args.lines) || 10;
    let bytes = parseInt(args.bytes) || null;

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

    process.stdout.write(slice(input, { lines, bytes, reverse }));
})();
