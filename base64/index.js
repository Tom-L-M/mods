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
        base64 [data] [options]
    
    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -d | --decode       Decodes data instead of encoding.
        -f | --file         Treats "[data]" as a filename instead of data string.
        -u | --b64uri       Encodes in Base64-URI mode ('+' -> '_' and '/' -> '-').`;

    const argv = process.argv.slice(2);
    const args = parseArgv({
        h: 'help',
        v: 'version',
        d: 'decode',
        f: 'file',
        u: 'b64uri',
    });

    if (args.help || process.argv.slice(2).length < 1) return console.log(help);

    if (args.version) return console.log(require('./package.json')?.version);

    let decode = Boolean(args.decode);
    let file = Boolean(args.file);
    let uri = Boolean(args.b64uri);
    let input;

    if (isSTDINActive()) input = await readStdinAsync();
    else if (!file) input = argv[0];
    else {
        input = tryToReadFile(argv[0]);
        if (!input)
            return console.log('Error: Invalid file path provided:', argv[0]);
    }

    if (!decode && !uri)
        return console.log(Buffer.from(input).toString('base64'));
    if (!decode && uri)
        return console.log(Buffer.from(input).toString('base64url'));

    if (decode && !uri)
        return console.log(
            Buffer.from(input.toString(), 'base64').toString('utf-8')
        );
    if (decode && uri)
        return console.log(
            Buffer.from(input.toString(), 'base64url').toString('utf-8')
        );
})();
