function getSignatures(data, signatures, dumpall) {
    const bytes = [...data]
        .map(v => v.toString(16).padStart(2, '0'))
        .join(' ')
        .toUpperCase();
    const results = [];

    // Make an initial search for signatures (with the first bytes only)
    const first20 = [...data.subarray(0, 20)]
        .map(v => v.toString(16).padStart(2, '0'))
        .join(' ')
        .toUpperCase();

    for (const sign in signatures) {
        if (first20.indexOf(sign) >= 0) {
            const index = bytes.indexOf(sign);
            const offset = '0x' + index.toString(16).padStart(8, '0');
            results.push({
                signature: signatures[sign].signature,
                type: signatures[sign].extension,
                offset,
                description: signatures[sign]?.description || '',
            });
            break;
        }
    }

    // If there is no main signature found, then add a default one
    if (results.length === 0) {
        const first5 = [...data.subarray(0, 5)]
            .map(v => v.toString(16).padStart(2, '0'))
            .join(' ')
            .toUpperCase();
        // If the initial contains mostly printable characters, then it's likely to be a text file
        const SLICE_SIZE = 100;
        const PRINTABLE_THRESHOLD = 0.9;
        const printable = [...data.subarray(0, SLICE_SIZE)].filter(
            v => v >= 32 && v <= 126
        );
        if (printable.length >= SLICE_SIZE * PRINTABLE_THRESHOLD) {
            results.push({
                signature: first5,
                type: signatures['PLAINTEXT'].extension,
                offset: '0x00000000',
                description: signatures['PLAINTEXT'].description,
            });
        } else {
            results.push({
                signature: first5,
                type: signatures['DEFAULT'].extension,
                offset: '0x00000000',
                description: signatures['DEFAULT'].description,
            });
        }
    }

    // Make a global search for signatures
    if (dumpall) {
        for (const sign in signatures) {
            if (bytes.indexOf(sign, 20) >= 0) {
                const index = bytes.indexOf(sign, 20);
                const offset = '0x' + index.toString(16).padStart(8, '0');
                results.push({
                    signature: signatures[sign].signature,
                    type: signatures[sign].extension,
                    offset,
                    description: signatures[sign]?.description || '',
                });
            }
        }
    }

    // Sort the results by offset and return the dump
    return results.sort((a, b) => {
        const aoffset = parseInt(a.offset, 16);
        const boffset = parseInt(b.offset, 16);
        if (aoffset < boffset) return -1;
        if (aoffset > boffset) return 1;
        return 0;
    });
}

const fs = require('fs');
const signatures = require('./signatures.json');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

const help = `
    [signatures-js]
        A tool for extracting file signatures (magic numbers)

    Usage:
        node signatures [options] <file>
      OR
        <stdin> | node signatures [options] 

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -V | --verbose          Prints the signature markers with descriptions.
        -a | --all              Prints all signature markers, not only the first.`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('verbose', { alias: 'V', allowValue: false });
    parser.option('all', { alias: 'a', allowValue: false });
    parser.argument('file');
    const args = parser.parseArgv();

    const fromSTDIN = isStdinActive();
    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.file)) return console.log(help);

    try {
        let data;
        if (fromSTDIN) {
            data = await readStdin();
        } else {
            // If not trying to get all extensions,
            // then read only the first 150 bytes instead of entire file
            if (!args.all) {
                const buff = Buffer.alloc(150);
                const fd = fs.openSync(args.file);
                fs.readSync(fd, buff, 0, buff.length, 0);
                data = buff;
            } else {
                data = fs.readFileSync(args.file);
            }
        }

        const lines = getSignatures(data, signatures, args.all);
        let printedInfo = false;

        if (lines[0].description.includes('Plain Text (Partial)')) {
            if (!printedInfo) console.log(); // Print empty line for formatting
            console.log(
                '+ WARN: Many printable characters were found. The file may contain plain text data.'
            );
            printedInfo = true;
        }

        if (lines.length >= 10) {
            if (!printedInfo) console.log(); // Print empty line for formatting
            console.log(
                `+ WARN: Too many signatures found (${lines.length}). The file may contain encrypted or format-free data.`
            );
            printedInfo = true;
        }

        if (printedInfo) console.log(); // Print empty line for formatting

        const longest = Math.max(...lines.map(v => v.signature.length)) + 4;
        lines.forEach(line => {
            const basestring =
                `${line.offset}    ` +
                `${line.signature.padEnd(longest, ' ')}${line.type}`;

            if (args.verbose) {
                console.log(
                    `\n${basestring}\n              ${line.description}`
                );
            } else {
                console.log(basestring);
            }
        });
    } catch (err) {
        console.log('ERROR: Impossible to complete dump');
        console.log('Message:', err.message);
    }
})();
