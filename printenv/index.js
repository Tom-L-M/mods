const { parseArgv } = require('../shared');

const help = `
    [printenv-js]
        A "printenv" command line utility in NodeJS.

    Usage:
        node printenv [varname] [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -0 | --null             Terminates each ENV variable with a NULL byte.`;

(async function () {
    const opts = {
        h: 'help',
        v: 'version',
        0: 'null',
    };

    const args = parseArgv(opts, { allowWithNoDash: false });

    if (args.help) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    const env = process.env;
    const nvar = (process.argv[2] || '').toUpperCase();
    const terminator = args.null ? '\0' : '\n';

    if (!nvar || nvar.startsWith('-')) {
        for (let key in env) {
            process.stdout.write(key + '=' + env[key] + terminator);
        }
        return;
    }
    return process.stdout.write((env[nvar] || '') + terminator);
})();
