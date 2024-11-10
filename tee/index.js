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
    [tee-js]
        A "tee" command line utility in NodeJS.
        Redirects output from STDIN to both STDOUT and a file.

    Usage:
        <stdin> | node tee [file] [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the program version and quits.
        -a | --append           Append to FILE, do not overwrite.`;

(async function () {
    const fromSTDIN = isSTDINActive();
    const file = process.argv[2];
    const opts = { v: 'version', h: 'help', a: 'append' };
    const args = parseArgv(opts);

    if (args.help || !file) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;
    let append = args.append;

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) input = Buffer.from('');
    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else input = await readStdinAsync();

    if (append) {
        fs.appendFileSync(file, input);
    } else {
        fs.writeFileSync(file, input);
    }

    process.stdout.write(input);
})();
