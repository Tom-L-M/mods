const { ArgvParser } = require('../shared');

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
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('null', { alias: '0', allowValue: false });
    const args = parser.parseArgv();

    if (args.help) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    const lineend = args.null ? '\0' : '\n';

    if (args._invalid.length > 0) {
        return console.log(`Invalid flag "${args._invalid[0]}"`);
    }

    if (args._.length === 0) {
        for (let key in process.env) {
            process.stdout.write(key + '=' + process.env[key] + lineend);
        }
        return;
    }

    for (let nvar of args._) {
        if (process.env[nvar]) {
            process.stdout.write(process.env[nvar] + lineend);
        }
    }
    return;
})();
