const fs = require('fs');
const { isStdinActive, readStdin, ArgvParser } = require('../shared');

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
    const fromSTDIN = isStdinActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('append', { alias: 'a', allowValue: false });
    parser.argument('file');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.file) return console.log(help);

    let input;
    let append = args.append;

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) input = Buffer.from('');
    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else input = await readStdin();

    if (append) {
        fs.appendFileSync(args.file, input);
    } else {
        fs.writeFileSync(args.file, input);
    }

    process.stdout.write(input);
})();
