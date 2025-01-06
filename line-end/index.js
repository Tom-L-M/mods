const {
    ArgvParser,
    isSTDINActive,
    readStdinAsync,
    parseControlChars,
    tryReading,
    tryWriting,
    validateFile,
} = require('../shared');

const help = `
    [line-end-js]
        A command line utility for converting line endings between Windows and UNIX formats.
        Converts from Windows (\\r\\n) to UNIX format (\\n) by default.

    Usage:
        node line-end [options] [file]
      OR
        <stdin> | node line-end [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -w | --windows          Converts from UNIX to Windows format.
        -l | --literals         Interpret CR & LF literals as control chars (\\n & \\r).
        -o | --output <FILE>    Saves the converted data to a file.
                                Set <FILE> to "-" to output to stdout.
                                Set <FILE> to "." to edit the file in-place.`;

/**
 * Converts the line-endings of a string from ('\n' - UNIX, to '\r\n' - WINDOWS)
 * @param {string} sourcedata
 */
function unixToWindows(sourcedata) {
    return sourcedata.replaceAll(/([^\r])\n/gim, (_, g1) => g1 + '\r\n');
}

/**
 * Converts the line-endings of a string from ('\r\n' - WINDOWS, to '\n' - UNIX)
 * @param {string} sourcedata
 */
function windowsToUnix(sourcedata) {
    return sourcedata.split(/\r\n/gim).join('\n');
}

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('windows', { alias: 'w', allowValue: false });
    parser.option('literals', { alias: 'l', allowValue: false });
    parser.option('output', { alias: 'o' });
    parser.argument('source');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.source)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    // If the user specified the in-place edition:
    if (args.output === '.') {
        // If the origin is STDIN, and the user tries in-place edition,
        // then rename args.output to '-' and print to STDOUT
        if (fromSTDIN) {
            args.output = '-';
        }
        // If the origin is a valid file, rename 'args.output' to the original file
        else {
            args.output = args.source;
        }
    }

    let sourceCheck = validateFile(args.source);
    if (args.source && !sourceCheck.ok) {
        return console.log(
            `Error: Invalid file provided as source (${args.source}) - ${sourceCheck.error}`
        );
    }

    let outputCheck = validateFile(args.output, { throwOnMissing: false });
    if (args.output && args.output !== '-' && !outputCheck.ok) {
        return console.log(
            `Error: Invalid file provided as output destination (${args.output}) - ${outputCheck.error}`
        );
    }

    let sourcedata = null;
    if (fromSTDIN) {
        sourcedata = await readStdinAsync({ encoding: 'utf8' });
    } else {
        let readingResult = tryReading(args.source);
        if (!readingResult) {
            return console.log(
                `Error: Invalid file provided as source (${args.source}) - ${readingResult.error}`
            );
        }
        sourcedata = readingResult.result;
    }

    if (args.literals) {
        sourcedata = parseControlChars(sourcedata, {
            all: false,
            lf: true,
            cr: true,
        });
    }

    let result = null;
    if (args.windows) {
        result = unixToWindows(sourcedata);
    } else {
        result = windowsToUnix(sourcedata);
    }

    if (args.output === '-' || !args.output) {
        return process.stdout.write(result);
    } else {
        let writingResult = tryWriting(args.output, result);
        if (!writingResult) {
            return console.log(
                `Error: Invalid file provided as output destination (${args.output}) - ${writingResult.error}`
            );
        }
    }
})();
