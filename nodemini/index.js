const { isSTDINActive, readStdinAsync, ArgvParser } = require('../shared');
const path = require('node:path');
const repl = require('node:repl');

const help = `
    [nodemini]
        A wrapper for NodeJS to be included in executables and run custom scripts.

    Usage:
        nodemini [options] <script> [-- [script-args]]
       OR
        <stdin> | nodemini [options] [-- [script-args]]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -V | --node-version     Prints NodeJS version and quits.
        -e | --eval <CODE>      Execute code and quits.

    Info:
        - This is basically a portable NodeJS executable
        - Not passing any argument will result in accessing the NodeJS REPL
        - To pass arguments to a script, use '--', followed by the arguments
        
    Examples:
        nodemini script.js -- --version     // Outputs the script version
        nodemini script.js --version        // Outputs nodemini's version`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('node-version', { alias: 'V', allowValue: false });
    parser.option('eval', { alias: 'e', allowMultiple: true });
    parser.argument('script');
    const args = parser.parseArgv();

    const fromSTDIN = isSTDINActive();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args['node-version']) return console.log(process.version);
    if (args.help) return console.log(help);

    process.argv = [process.argv[0], 'temp.js', ...args._];

    if (args.eval && !fromSTDIN) return eval(args.eval.join('\n'));

    if (!fromSTDIN && !args.script) {
        console.log(
            `Entering custom NodeJS ${process.version} REPL, use CTRL+C or ".exit" to quit.\n` +
                'Use .editor to enter interactive editor mode.\n' +
                'Quit and use "--help" flag for help.'
        );
        repl.start('$ ');
    }

    if (args.script) {
        // Resolve script path to absolute path
        const script = path.resolve(args.script);

        // Remove process argv 1, that is the script name
        process.argv[1] = script;

        try {
            return require(script);
        } catch {
            return console.log(
                '\nError: Invalid script path provided "' + script + '"\n'
            );
        }
    }

    if (fromSTDIN) {
        let input = (await readStdinAsync()).toString();
        if (args.eval) input += '\n' + args.eval.join('\n');
        return eval(input);
    }
})();
