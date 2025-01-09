const fs = require('node:fs');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

const help = `
    [tail-js]
        A "tail" command line utility in NodeJS.

    Usage:
        node tail [options] [file]...
      OR
        <stdin> | node tail [options] [file]...

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -n | --lines <[+]N>     The number of lines to read (default: 10).
        -c | --bytes <[+]N>     The number of bytes to read (instead of lines).
        -V | --verbose          Always print the file name separator header.    
        -q | --quiet            Never print the file name separator header.    
             --silent

    Info:
      - When multiple 'file's are provided, or when 'file' is '-', reads from each one and
        prints the sequences with a separator: "==> FILENAME <==".
      - Line and byte numeric options may be prefixed with '+' in order
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
    const fromSTDIN = isStdinActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('lines', { alias: 'n' });
    parser.option('bytes', { alias: 'c' });
    parser.option('verbose', { alias: 'V', allowValue: false });
    parser.option('silent', { alias: ['q', 'quiet'], allowValue: false });

    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args._.length)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    let input,
        reverse = args.bytes?.startsWith('+') || args.lines?.startsWith('+');
    let lines = parseInt(args.lines) || 10;
    let bytes = parseInt(args.bytes) || null;
    let verbose = args.verbose;

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    let inputFromSTDIN = fromSTDIN ? await readStdin() : '';

    if (inputFromSTDIN && !args._.includes('-')) args._.unshift('-');

    for (let i = 0; i < args._.length; i++) {
        let file = args._[i];
        try {
            if (file === '-') {
                file = 'standard input';
                input = inputFromSTDIN;
            } else {
                input = fs.readFileSync(file);
            }
        } catch {
            return console.log(`Error: Could not read file ${args.file}`);
        }

        if (!args.silent && (args._.length > 1 || verbose)) {
            if (i > 0) process.stdout.write('\n');
            process.stdout.write('==> ' + file + ' <==\n');
        }

        process.stdout.write(slice(input, { lines, bytes, reverse }));
    }
})();
