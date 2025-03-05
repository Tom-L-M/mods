const fs = require('fs');
const { isStdinActive, readStdin, ArgvParser } = require('../shared');

const addressFromIndex = (address, radix) => {
    // The address must accomodate at max a UInt32 (4 bytes -> up to 4294967296)
    // This means, the program can dump files with at max 4294967296 bytes (4 GB)
    // So, the address:
    //   in hexadecimal form, spans 8 chars
    //   in decimal, spans 10 chars
    //   in octal, spans 11 chars
    //   in binary, spans 32 chars
    //
    // To verify how much space a radix takes, use this:
    //  console.log((2 ** 32 - 1).toString(RADIX).length);
    //
    const padLengths = { 2: 32, 8: 11, 10: 10, 16: 8 };
    return address
        .toString(radix)
        .padStart(padLengths[radix], '0')
        .toUpperCase();
};

function hexdump(
    buffer,
    {
        offset,
        count,
        linelength,
        raw,
        radix,
        squeeze,
        noascii,
        nooffset,
        notrailing,
        bDecimal,
        bOctal,
        bBinary,
        noPaint0,
    } = {}
) {
    const CHUNK = linelength || 16; //default: 16 => MUST BE A EVEN NUMBER (2, 4, 8, 16, 32, 64...)
    const OFFSET = offset || 0;
    const COUNT = count || buffer.length;

    let cachedLinesCount = 0;
    let cachedLine = '';
    let i;

    for (i = OFFSET; i < OFFSET + COUNT; i += CHUNK) {
        let address = addressFromIndex(i, radix);
        let block = buffer.subarray(
            i,
            i + CHUNK > OFFSET + COUNT ? OFFSET + COUNT : i + CHUNK
        ); // cut buffer into blocks of the size in CHUNK

        let hexArray = [];
        let asciiArray = [];
        let padding = '';
        let trailingchar = notrailing ? ' ' : '0';

        for (let value of block) {
            let cbyte = value;

            if (bDecimal) {
                cbyte = value.toString(10).padStart(3, trailingchar);
            } else if (bOctal) {
                cbyte = value.toString(8).padStart(3, trailingchar);
            } else if (bBinary) {
                cbyte = value.toString(2).padStart(8, trailingchar);
            } else {
                cbyte = value.toString(16).padStart(2, trailingchar);
            }

            hexArray.push(cbyte);
            asciiArray.push(
                value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : '.'
            );
        }

        // if block is less than CHUNK bytes, calculate remaining space
        if (hexArray.length < CHUNK) {
            let space = CHUNK - hexArray.length;
            let bytesize = bDecimal || bOctal ? 3 : bBinary ? 8 : 2;
            // calculate extra space if CHUNK/2 or less
            padding = ' '.repeat(space * bytesize + space);
        }

        let hexString = hexArray.join(' ');
        let asciiString = asciiArray.join('').padEnd(CHUNK, ' ');

        // Enabling syntax highlight if --raw mode is off:
        // (paint all null bytes (only zeroes) of gray)

        if (!raw && !noPaint0)
            hexString = hexString.replaceAll(
                RegExp('\\b(0+)\\b', 'gi'),
                '\x1b[38;5;239m$1\x1b[0m'
            );

        let line = `${hexString}  ${padding}`;

        if (raw) {
            if (!noascii) line += `|${asciiString}|`;
            if (!nooffset) line = `${address}  ` + line;
        } else {
            line = `${hexString}\x1b[0m  ${padding}`;
            if (!noascii) line += `|\x1b[38;5;87m${asciiString}\x1b[0m|`;
            if (!nooffset) line = `\x1b[38;5;242m${address}\x1b[0m  ` + line;
        }

        // paint offset in light-gray
        // let line = `\x1b[38;5;242m${address}\x1b[0m  ${hexString}\x1b[0m  ${padding}|\x1b[38;5;87m${asciiString}\x1b[0m|`;

        // if (raw) line = `${address}  ${hexString}  ${padding}|${asciiString}|`;

        if (squeeze) {
            let sliced = line.slice(line.indexOf('  '));
            if (sliced === cachedLine) {
                cachedLinesCount++;
            } else {
                if (cachedLinesCount > 0) {
                    console.log('*');
                }
                cachedLine = sliced;
                cachedLinesCount = 0;
                console.log(line);
            }
            continue;
        }

        console.log(line);
    }

    // Print last file offset in the end
    if (!nooffset) {
        if (raw) {
            console.log(addressFromIndex(OFFSET + COUNT, radix));
        } else {
            console.log(
                `\x1b[38;5;242m${addressFromIndex(
                    OFFSET + COUNT,
                    radix
                )}\x1b[0m`
            );
        }
    }
}

const help = `
    [hexdump-js]
        A tool for generating file hexdumps

    Usage:
        hexdump FILE_TO_DUMP [OPTIONS]
       OR
        <stdin> | hexdump [OPTIONS]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -r | --raw          Prints the result without coloring.
        -c | --count <N>    Reads N bytes from the document.
        -p | --offset <N>   Reads starting from offset N.
        -n | --length <N>   Prints N bytes per line (default: 16).
        -d | --decimal      Use decimals (base-10) for offsets.
        -o | --octal        Use octals (base-8) for offsets.
        -S | --no-squeeze   Do not replace identical chunks with *
        -A | --no-ascii     Do not show ASCII string chars.
        -T | --no-trailing  Do not add trailing zeroes to bytes.
        -P | --no-offset    Do not show offset numbers.
        -Z | --no-paint-0   Do not paint null bytes different.
        -D | --b-decimal    Show bytes as decimals (base-10).
        -O | --b-octal      Show bytes as octals (base-8).
        -B | --b-binary     Show bytes as binary (base-2).`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('raw', { alias: 'r', allowValue: false });
    parser.option('count', { alias: 'c', allowCasting: true });
    parser.option('offset', { alias: 'p', allowCasting: true });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('length', { alias: 'n', allowCasting: true });
    parser.option('decimal', { alias: 'd', allowValue: false });
    parser.option('octal', { alias: 'o', allowValue: false });
    parser.option('no-squeeze', { alias: 'S', allowValue: false });
    parser.option('no-ascii', { alias: 'S', allowValue: false });
    parser.option('no-trailing', { alias: 'T', allowValue: false });
    parser.option('no-offset', { alias: 'P', allowValue: false });
    parser.option('b-decimal', { alias: 'D', allowValue: false });
    parser.option('b-octal', { alias: 'O', allowValue: false });
    parser.option('b-binary', { alias: 'B', allowValue: false });
    parser.option('no-paint-0', { alias: 'Z', allowValue: false });
    parser.argument('file');

    const args = parser.parseArgv();

    const file = args.file;

    const fromStdin = isStdinActive();

    const count = args.count ? parseInt(args.count) : null;
    const offset = args.offset ? parseInt(args.offset) : null;
    const linelength = args['length'] ? parseInt(args['length']) : null;
    const raw = args.raw || false;
    const radix = args.decimal ? 10 : args.octal ? 8 : 16;
    const squeeze = args['no-squeeze'] ? false : true;
    const noascii = Boolean(args['no-ascii']);
    const nooffset = Boolean(args['no-offset']);
    const notrailing = Boolean(args['no-trailing']);
    const bDecimal = Boolean(args['b-decimal']);
    const bOctal = Boolean(args['b-octal']);
    const bBinary = Boolean(args['b-binary']);
    const noPaint0 = Boolean(args['no-paint-0']);

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromStdin && !file)) return console.log(help);

    let input;
    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromStdin) {
        try {
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }
    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else input = await readStdin();

    return hexdump(input, {
        offset,
        count,
        linelength,
        raw,
        radix,
        squeeze,
        noascii,
        nooffset,
        notrailing,
        bDecimal,
        bOctal,
        bBinary,
        noPaint0,
    });
})();
