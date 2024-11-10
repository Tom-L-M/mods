const fs = require('fs');
const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

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
