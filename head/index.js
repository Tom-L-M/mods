const fs = require('fs');
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

const help = `
    [head-js]
        A "head" command line utility in NodeJS.

    Usage:
        node head [file] [options]
      OR
        <stdin> | node head [options]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -n | --lines <X>        The number of lines to read (default: 10).
        -c | --bytes <X>        The number of bytes to read (instead of lines).

    Examples:
        cat somefile.txt | node head -n 5       # Prints first 5 lines from file
        node head somefile.txt -n 5             # Also prints first 5 lines from file
`;

function slice(data, { lines, bytes } = {}) {
    // bytes have preference over lines
    if (bytes) return data.slice(0, bytes);
    else return data.toString('utf-8').split('\n').slice(0, lines).join('\n');
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
})();
