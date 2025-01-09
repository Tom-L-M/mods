const fs = require('fs');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

function tryToReadFile(fname) {
    try {
        return fs.readFileSync(fname);
    } catch {
        return null;
    }
}

(async function wrapper() {
    const help = `
    [base64-js]
        A tool for encoding and decoding text in multiple encodings.

    Usage: 
        base64 [options] [data] 
        <stdin> | base64 [options] [data] 
    
    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -d | --decode       Decodes data instead of encoding.
        -f | --file         Treats [data] or <stdin> as a filename instead of a string.
        -u | --b64uri       Encodes in Base64-URI mode ('+' -> '_' and '/' -> '-').`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('decode', { alias: 'd', allowValue: false });
    parser.option('file', { alias: 'f', allowValue: false });
    parser.option('b64uri', { alias: 'u', allowValue: false });
    parser.argument('data');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!isStdinActive() && !args.data)) return console.log(help);

    let input;

    if (isStdinActive()) {
        input = await readStdin();
    }

    if (args.file) {
        if (isStdinActive()) {
            input = tryToReadFile(input.toString().trim());
            if (!input) return console.log('Error: Invalid file path on STDIN');
        } else {
            input = tryToReadFile(args.data);
            if (!input)
                return console.log('Error: Invalid file path -', args.data);
        }
    } else {
        input = input || args.data;
        if (!input) return console.log('Error: No data provided');
    }

    if (!args.decode && !args.b64uri)
        return console.log(Buffer.from(input).toString('base64'));
    if (!args.decode && args.b64uri)
        return console.log(Buffer.from(input).toString('base64url'));

    if (args.decode && !args.b64uri)
        return console.log(
            Buffer.from(input.toString(), 'base64').toString('utf-8')
        );
    if (args.decode && args.b64uri)
        return console.log(
            Buffer.from(input.toString(), 'base64url').toString('utf-8')
        );
})();
