const fs = require('fs');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

function tryToReadFile(fname) {
    try {
        return fs.readFileSync(fname);
    } catch {
        return null;
    }
}

const vID = () =>
    '################'.replace(/[#]/gm, () => Math.random().toString(16)[6]);

(async function wrapper() {
    const help = `
    [base64-js]
        A tool for encoding and decoding text in multiple encodings.

    Usage: 
        base64 [options] [data] 
        <stdin> | base64 [options] [data] 
    
    Options:
        -h | --help           Prints the help message and quits.
        -v | --version        Prints the version info and quits.
        -d | --decode         Decodes data instead of encoding.
        -f | --file           Treats [data] or <stdin> as a filename instead of a string.
        -u | --b64uri         Encodes/Decodes in Base64-URI mode ('+' -> '_' and '/' -> '-').
        -o | --output [file]  Outputs data to [file] instead of STDOUT. If [file] is ommitted,
                              creates a file automatically with the '.b64' extension.`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('decode', { alias: 'd', allowValue: false });
    parser.option('file', { alias: 'f', allowValue: false });
    parser.option('b64uri', { alias: 'u', allowValue: false });
    parser.option('output', { alias: 'o', allowValue: true });
    parser.argument('data');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!isStdinActive() && !args.data)) return console.log(help);

    let input;
    let localfname = null;

    if (isStdinActive()) {
        input = await readStdin();
    }

    if (args.file) {
        localfname = input || args.data;
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

    let targetdata = null;

    if (args.output === undefined || args.output === null) {
        if (!args.decode && !args.b64uri)
            targetdata = Buffer.from(input).toString('base64');
        else if (!args.decode && args.b64uri)
            targetdata = Buffer.from(input).toString('base64url');
        else if (args.decode && !args.b64uri)
            targetdata = Buffer.from(input.toString(), 'base64').toString(
                'utf-8'
            );
        else if (args.decode && args.b64uri)
            targetdata = Buffer.from(input.toString(), 'base64url').toString(
                'utf-8'
            );

        return console.log(targetdata);
    } else {
        if (!args.decode && !args.b64uri) {
            targetdata = Buffer.from(input).toString('base64');
        } else if (!args.decode && args.b64uri) {
            targetdata = Buffer.from(input).toString('base64url');
        } else if (args.decode && !args.b64uri) {
            targetdata = Buffer.from(input.toString(), 'base64');
        } else if (args.decode && args.b64uri) {
            targetdata = Buffer.from(input.toString(), 'base64url');
        }

        // If the output flag is requested, but with no value
        if (args.output === '' || args.output === '.') {
            if (args.file && localfname) {
                const fname = localfname.replaceAll('\\', '/').split('/').pop();
                return fs.writeFileSync(fname + '.b64', targetdata);
            }
            const fname = vID();
            return fs.writeFileSync(fname + '.b64', targetdata);
        }

        // If the output flag is requested, with a valid file name
        else {
            const fname = args.output;
            return fs.writeFileSync(fname, targetdata);
        }
    }
})();
