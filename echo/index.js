const {
    isSTDINActive,
    readStdinAsync,
    ArgvParser,
    parseControlChars,
} = require('../shared');

const help = `
    [echo-js]
        An "echo" command line utility in NodeJS.
        Reads data from STDIN and ARGV and prints to STDOUT.

    Usage:
        node echo [options] <text>
        <stdin> | node echo [options] [-] <text>

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -s | --separator [N]    Writes a separator after each item added (default: '\\n').
        -e | --stderr           Write to STDERR instead of STDOUT.
        -a | --stdall           Write to both STDERR and STDOUT.

    Info:
        When providing data from STDIN, it will be placed at position of '-'.
        Or, if no '-' is provided, and STDIN has data, it will be appended first.

        The default item separator is a newline char '\\n'. To change it, set "-s" to other
        value. And to completely remove the separator, use "-s" without a value.

    Examples:
        echo something                      # Prints "something" to STDOUT
        echo something other                # Concats the 2 texts and print.
        ls | echo a - b                     # Concats: a + (result of ls) + b.
        ls | echo a b                       # Concats: (result of ls) + a + b.`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('stderr', { alias: 'e', allowValue: false });
    parser.option('stdall', { alias: 'a', allowValue: false });
    parser.option('separator', { alias: 's' });
    const args = parser.parseArgv();
    const texts = args._.map(parseControlChars);
    const stdinActive = isSTDINActive();

    if (args.help || (!texts.length && !stdinActive)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    // If no STDIN output token is used, append to the start
    if (stdinActive && !texts.includes('-')) texts.unshift('-');

    const separator = parseControlChars(
        typeof args.separator === 'string'
            ? args.separator
            : typeof args.separator === 'boolean'
            ? ''
            : '\n'
    );
    const useSTDERR = Boolean(args.stderr);
    const useSTDALL = Boolean(args.stdall);
    const stdindata = stdinActive
        ? (await readStdinAsync({ controlChars: true })).toString().trim()
        : '';
    const output = string => {
        if (useSTDERR || useSTDALL) process.stderr.write(string);
        if (!useSTDERR) process.stdout.write(string);
    };

    let item;
    try {
        for (let i = 0; i < texts.length; i++) {
            item = texts[i];

            if (item === '-') {
                if (!stdinActive) continue;
                item = stdindata;
            }

            if (i > 0) output(separator);
            output(item);
        }
    } catch (err) {
        return console.log(
            `Error: Could not read item "${item}" (${err.message})`
        );
    }
})();
