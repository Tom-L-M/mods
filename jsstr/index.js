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
    [jsstr-js]
        A command line utility in NodeJS for manipulating stdin input strings.

    Usage:
        <stdin> | node jsstr [options] <js-code>

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.

    Info:
        > Use the embed variables to manipulate the input:
            > '$' : contains the stdin input as a string, with start/end spaces removed (trimmed).
            > '$s': contains the stdin input as a raw string.
            > '$b': contains the stdin input as a buffer.

        > Tip: The evaluator expects a single expression as <js-code>,
            but it is possible to execute an entire script, as NodeJS
            allows for IIFEs to be run (Immediately Invoked Function Expression).
            So, by using an IIFE wrapper, you can run multiple commands or assign variables.

    Examples:
        Simple string splitting:
            echo "hello world!" | node jsstr "$.split(' ')[0]"       # Prints "hello"

        Using an IIFE to run a block of code: 
        (List the directories in the current cwd recursively) 
            cd | node jsstr "(() => { let f = require('fs'); return f.readdirSync($, {recursive:true}); })()"`;

function customeval(string, buffer) {
    return eval(`
        (function () {
            const $b = Buffer.from('${buffer.toString('hex')}', 'hex');
            const $s = $b.toString('utf8');
            const $ = $s.trim();
            return console.log(${string});
        })();
    `);
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const data = process.argv[2] || '$';
    const opts = { h: 'help', v: 'version' };
    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !data)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) return 'Error: no data on <STDIN> pipe.';
    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else input = await readStdinAsync();

    customeval(data, input);
})();
