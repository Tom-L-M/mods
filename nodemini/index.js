const { parseArgv } = require('../shared');

const help = `
    [nodemini]
        A wrapper for NodeJS to be included in executables and run custom scripts.

    Usage:
        nodemini [options] [script]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -V | --node-version     Prints NodeJS version and quits.
        -e | --eval <CODE>      Execute code and quits.

    Info:
        - This is basically a portable NodeJS executable
        - Not passing any argument will result in accessing the NodeJS REPL
        - Passing multiple '-e' flags concatenate them, joining with a newline '\\n'.`;

(async function () {
    const argv = parseArgv({
        e: 'eval',
    });

    if (
        process.argv.slice(2)[0] === '-h' ||
        process.argv.slice(2)[0] === '--help'
    )
        return console.log(help);
    if (
        process.argv.slice(2)[0] === '-v' ||
        process.argv.slice(2)[0] === '--version'
    )
        return console.log(require('./package.json')?.version);
    if (
        process.argv.slice(2)[0] === '-V' ||
        process.argv.slice(2)[0] === '--node-version'
    )
        return console.log(process.version);

    const repl = require('node:repl');

    if (argv.eval && typeof argv.eval === 'string') {
        return eval(argv.eval);
    }

    if (argv.eval && Array.isArray(argv.eval)) {
        return eval(argv.eval.join('\n'));
    }

    if (process.argv.slice(2).length > 0) {
        // Resolve script path to absolute path
        let script = require('node:path').resolve(process.argv[2]);

        // Remove process argv 1, that is the script name
        process.argv = [process.argv[0], script, ...process.argv.slice(3)];

        try {
            return require(script);
        } catch {
            console.log(
                '\nError: Invalid script path provided (' + script + ')\n'
            );
        }
    } else {
        console.log(
            `Entering custom NodeJS ${process.version} REPL, use CTRL+C or ".exit" to quit.\n` +
                'Use .editor to enter interactive editor mode.\n' +
                'Quit and use "--help" flag for help.'
        );
        repl.start('$ ');
    }
})();
