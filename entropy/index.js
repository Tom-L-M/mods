const fs = require('fs');

const {
    isStdinActive,
    validateFile,
    readStdin,
    ArgvParser,
} = require('../shared');

function computeEntropySync(buffer) {
    const frequencymap = new Map();
    let entropy = 0;

    for (let i = 0; i < buffer.length; i++) {
        let previous = frequencymap.get(buffer[i]);
        frequencymap.set(buffer[i], previous ? previous + 1 : 1);
    }

    [...frequencymap.values()].forEach(value => {
        const probability = value / buffer.length;
        entropy -= probability * Math.log2(probability);
    });

    return entropy;
}

(async function main() {
    const help = `
    [entropy-js]
        A tool for calculating Shannon Entropy (in bits/symbol) of a file or sequence of files

    Usage:
        node entropy [options] <file>
        <stdin> | node entropy [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -q | --quiet            Prints only the numeric value.
        -d | --digits <N>       The number of digits after the decimal point.`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('quiet', { alias: 'q', allowValue: false });
    parser.option('digits', {
        alias: 'd',
        allowValue: true,
        allowCasting: true,
    });
    parser.argument('file');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!args.file && !isStdinActive())) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    const stdindata = isStdinActive() ? await readStdin() : null;

    const filedata =
        args.file && validateFile(args.file)
            ? fs.readFileSync(args.file)
            : null;

    const finaldata =
        stdindata && filedata
            ? Buffer.concat([stdindata, filedata])
            : stdindata || filedata;

    try {
        let result = computeEntropySync(finaldata);
        if (!isNaN(args.digits)) result = result.toFixed(args.digits);
        else result = result.toFixed(5);

        if (args.quiet) {
            console.log(result);
            return;
        }

        const filename =
            args.file && stdindata
                ? '|stdin| + ' + args.file
                : args.file || '|stdin|';
        console.log(`${filename} (${finaldata.length} bytes) :: ${result}`);
        return;
    } catch (err) {
        console.log('<> Error during entropy calculation -', err.message);
    }
})();
